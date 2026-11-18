"use server";

import { and, eq, inArray, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, auditLogs, costItems, matches, matchPlayers, members, settings, transactions } from "@/db";
import { checkPassword, createSession, destroySession, requireAdmin } from "@/lib/auth";
import { getMatchBundle, getSettings } from "@/lib/data";
import { suggestCode, formatK } from "@/lib/text";
import { BANKS } from "@/lib/vietqr";
import { PRESETS } from "@/lib/presets";
import { applyDeclare, findPaymentTarget } from "@/lib/payments";
import {
  assignSchema,
  createMatchSchema,
  formDataToObject,
  loginSchema,
  manualPaymentSchema,
  matchSchema,
  memberCreateSchema,
  memberUpdateSchema,
  settingsSchema,
  toFieldErrors,
  type ActionState,
  type MatchInput,
} from "@/lib/schemas";

function refreshAll() {
  revalidatePath("/", "layout");
}

function parse<T extends z.ZodType>(schema: T, form: FormData) {
  return schema.safeParse(formDataToObject(form)) as z.ZodSafeParseResult<z.output<T>>;
}

const idSchema = z.number().int().positive();

/* ---------------- Đăng nhập ---------------- */

export async function login(_: ActionState, form: FormData): Promise<ActionState> {
  const p = parse(loginSchema, form);
  if (!p.success) return { fieldErrors: toFieldErrors(p.error) };
  if (!checkPassword(p.data.password)) return { fieldErrors: { password: "Sai mật khẩu" } };
  await createSession();
  redirect("/admin");
}

export async function logout() {
  await destroySession();
  redirect("/");
}

/* ---------------- Cài đặt ---------------- */

export async function saveSettings(_: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const p = parse(settingsSchema, form);
  if (!p.success) return { fieldErrors: toFieldErrors(p.error) };
  const v = p.data;
  if (v.treasurerId != null) {
    const [m] = await db.select({ id: members.id }).from(members).where(eq(members.id, v.treasurerId));
    if (!m) return { fieldErrors: { treasurerId: "Không tìm thấy thành viên" } };
  }
  await getSettings();
  await db
    .update(settings)
    .set({
      teamName: v.teamName,
      prefix: v.prefix,
      bankBin: v.bankBin,
      bankName: BANKS.find((b) => b.bin === v.bankBin)?.name ?? "",
      accountNo: v.accountNo,
      accountName: v.accountName,
      dedicatedAccount: v.dedicatedAccount,
      treasurerId: v.treasurerId,
      transferSuffix: v.transferSuffix,
      defaultVenue: v.defaultVenue,
      defaultTime: v.defaultTime,
      teamAName: v.teamAName,
      teamBName: v.teamBName,
      updatedAt: new Date(),
    })
    .where(eq(settings.id, 1));
  refreshAll();
  return { ok: true, message: "Đã lưu cài đặt" };
}

/* ---------------- Thành viên ---------------- */

export async function addMember(_: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const p = parse(memberCreateSchema, form);
  if (!p.success) return { fieldErrors: toFieldErrors(p.error) };
  const { name } = p.data;
  const existing = (await db.select({ code: members.code }).from(members)).map((m) => m.code);
  if (p.data.code && existing.includes(p.data.code))
    return { fieldErrors: { code: `Mã ${p.data.code} đã có người dùng` } };
  const code = p.data.code || suggestCode(name, existing);
  await db.insert(members).values({ name, code });
  refreshAll();
  return { ok: true, message: `Đã thêm ${name} · mã ${code}` };
}

export async function updateMember(_: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const p = parse(memberUpdateSchema, form);
  if (!p.success) return { fieldErrors: toFieldErrors(p.error) };
  const { id, name, code, active } = p.data;
  const clash = await db
    .select({ id: members.id })
    .from(members)
    .where(and(eq(members.code, code), ne(members.id, id)));
  if (clash.length) return { fieldErrors: { code: `Mã ${code} đã có người dùng` } };
  // Bật "Đang hoạt động" cho khách → chuyển thành thành viên chính thức
  const res = await db
    .update(members)
    .set(active ? { name, code, active, guest: false } : { name, code, active })
    .where(eq(members.id, id))
    .returning({ id: members.id });
  if (!res.length) return { error: "Không tìm thấy thành viên" };
  refreshAll();
  return { ok: true, message: `Đã lưu ${name}` };
}

const guestName = z
  .string()
  .trim()
  .min(2, "Tên quá ngắn")
  .max(60, "Tên tối đa 60 ký tự")
  .regex(/^[\p{L}\p{M}\s.'-]+$/u, "Tên chỉ gồm chữ cái");

/** Thêm khách (người ngoài đội) ngay trong màn sửa trận. */
export async function addGuest(name: string): Promise<ActionState & { member?: { id: number; name: string; code: string } }> {
  await requireAdmin();
  const p = guestName.safeParse(name);
  if (!p.success) return { fieldErrors: { name: p.error.issues[0].message } };
  const existing = (await db.select({ code: members.code }).from(members)).map((m) => m.code);
  const code = suggestCode(p.data, existing);
  const [m] = await db
    .insert(members)
    .values({ name: p.data, code, active: false, guest: true })
    .returning({ id: members.id, name: members.name, code: members.code });
  refreshAll();
  return { ok: true, message: `Đã thêm khách ${m.name}`, member: m };
}

/* ---------------- Trận đấu ---------------- */

export async function createMatch(_: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const p = parse(createMatchSchema, form);
  if (!p.success) return { fieldErrors: toFieldErrors(p.error) };
  const { date, preset } = p.data;

  const st = await getSettings();
  const id = await db.transaction(async (tx) => {
    const [m] = await tx
      .insert(matches)
      .values({ date, venue: st.defaultVenue, timeRange: st.defaultTime, voting: true })
      .returning({ id: matches.id });
    const items = PRESETS[preset].items;
    if (items.length) await tx.insert(costItems).values(items.map((it, i) => ({ ...it, matchId: m.id, sort: i })));
    return m.id;
  });
  redirect(`/admin/tran/${id}`);
}

export async function saveMatch(id: number, input: MatchInput): Promise<ActionState> {
  await requireAdmin();
  if (!idSchema.safeParse(id).success) return { error: "Mã trận không hợp lệ" };
  const p = matchSchema.safeParse(input);
  if (!p.success) return { fieldErrors: toFieldErrors(p.error) };
  const v = p.data;

  const before = await getMatchBundle(id);
  if (!before) return { error: "Không tìm thấy trận (có thể đã bị xoá)" };

  const sponsorIds = v.items.flatMap((i) => (i.sponsorMemberId != null ? [i.sponsorMemberId] : []));
  const lookupIds = [...new Set([...v.players.map((x) => x.memberId), ...sponsorIds])];
  const nameById = new Map<number, string>();
  if (lookupIds.length) {
    const found = await db
      .select({ id: members.id, name: members.name })
      .from(members)
      .where(inArray(members.id, lookupIds));
    for (const m of found) nameById.set(m.id, m.name);
    if (lookupIds.some((mid) => !nameById.has(mid))) return { error: "Có thành viên không còn tồn tại, tải lại trang" };
  }

  // Người ủng hộ là thành viên: lưu kèm tên để hiện lời cảm ơn
  const items = v.items.map((i, idx) => ({
    ...i,
    sponsorName: i.sponsorMemberId != null ? nameById.get(i.sponsorMemberId)! : i.sponsorName,
    matchId: id,
    sort: idx,
  }));
  const players = v.players.map((x) => ({ ...x, matchId: id }));

  // Ghi lại thay đổi sau khi đã công bố để mọi người thấy, tránh hiểu lầm.
  const changes: string[] = [];
  if (before.match.published) {
    const m = before.match;
    if (m.scoreA !== v.scoreA || m.scoreB !== v.scoreB)
      changes.push(`tỷ số ${m.scoreA ?? "?"}–${m.scoreB ?? "?"} → ${v.scoreA ?? "?"}–${v.scoreB ?? "?"}`);
    const oldItems = new Map(before.items.map((i) => [i.name, i]));
    for (const it of items) {
      const old = oldItems.get(it.name);
      if (!old) changes.push(`thêm ${it.name} ${formatK(it.amount)}`);
      else {
        if (old.amount !== it.amount) changes.push(`${it.name} ${formatK(old.amount)} → ${formatK(it.amount)}`);
        if (old.sponsorAmount !== it.sponsorAmount)
          changes.push(`ủng hộ ${it.name.toLowerCase()} ${formatK(old.sponsorAmount)} → ${formatK(it.sponsorAmount)}`);
        else if (
          it.sponsorAmount > 0 &&
          (old.sponsorName !== it.sponsorName || old.sponsorMemberId !== it.sponsorMemberId || old.sponsorCash !== it.sponsorCash)
        )
          changes.push(`người ủng hộ ${it.name.toLowerCase()}: ${it.sponsorName}${it.sponsorMemberId && !it.sponsorCash ? " (chuyển khoản)" : it.sponsorMemberId ? " (tiền mặt)" : ""}`);
        if (old.rule !== it.rule || old.loserPct !== it.loserPct || old.bearer !== it.bearer)
          changes.push(`cách chia ${it.name.toLowerCase()}`);
      }
      oldItems.delete(it.name);
    }
    for (const [name] of oldItems) changes.push(`bỏ ${name}`);
    const oldIds = new Set(before.players.map((x) => x.memberId));
    const newIds = new Set(players.map((x) => x.memberId));
    const added = players.filter((x) => !oldIds.has(x.memberId)).length;
    const removed = before.players.filter((x) => !newIds.has(x.memberId)).length;
    const moved = players.filter((x) => {
      const o = before.players.find((y) => y.memberId === x.memberId);
      return o && (o.team !== x.team || o.ate !== x.ate);
    }).length;
    if (added || removed || moved) changes.push(`đội hình (+${added} / −${removed} / đổi ${moved})`);
  }

  await db.transaction(async (tx) => {
    await tx
      .update(matches)
      .set({
        date: v.date,
        venue: v.venue,
        timeRange: v.timeRange,
        scoreA: v.scoreA,
        scoreB: v.scoreB,
        // Chỉ cần số người mỗi đội khi còn người chưa chọn đội
        sizeA: v.players.some((p) => p.pending) ? v.sizeA : null,
        sizeB: v.players.some((p) => p.pending) ? v.sizeB : null,
        note: v.note.trim(),
        published: v.published,
        // Công bố kết quả thì khoá điểm danh
        voting: v.published ? false : v.voting,
        updatedAt: new Date(),
      })
      .where(eq(matches.id, id));
    await tx.delete(matchPlayers).where(eq(matchPlayers.matchId, id));
    if (players.length) await tx.insert(matchPlayers).values(players);
    await tx.delete(costItems).where(eq(costItems.matchId, id));
    if (items.length) await tx.insert(costItems).values(items);
    if (changes.length)
      await tx.insert(auditLogs).values({ matchId: id, action: "update", detail: changes.join("; ") });
    if (!before.match.published && v.published)
      await tx.insert(auditLogs).values({ matchId: id, action: "publish", detail: "Công bố trận" });
  });
  refreshAll();
  return {
    ok: true,
    message: v.published ? (before.match.published ? "Đã lưu thay đổi" : "Đã công bố cho cả đội") : "Đã lưu",
  };
}

const reasonSchema = z.string().trim().max(100, "Tối đa 100 ký tự");

/** Huỷ trận (VD trời mưa): vẫn hiện trên link chung với lý do, khoá điểm danh, không tính tiền. */
export async function cancelMatch(id: number, reason: string): Promise<ActionState> {
  await requireAdmin();
  const r = reasonSchema.safeParse(reason);
  if (!idSchema.safeParse(id).success || !r.success) return { error: r.success ? "Mã trận không hợp lệ" : r.error.issues[0].message };
  const res = await db
    .update(matches)
    .set({ cancelled: true, cancelReason: r.data, voting: false, published: false, updatedAt: new Date() })
    .where(eq(matches.id, id))
    .returning({ id: matches.id });
  if (!res.length) return { error: "Không tìm thấy trận" };
  await db.insert(auditLogs).values({ matchId: id, action: "cancel", detail: `Huỷ trận${r.data ? `: ${r.data}` : ""}` });
  refreshAll();
  return { ok: true, message: "Đã huỷ trận" };
}

export async function restoreMatch(id: number): Promise<ActionState> {
  await requireAdmin();
  if (!idSchema.safeParse(id).success) return { error: "Mã trận không hợp lệ" };
  await db
    .update(matches)
    .set({ cancelled: false, cancelReason: "", voting: true, updatedAt: new Date() })
    .where(eq(matches.id, id));
  await db.insert(auditLogs).values({ matchId: id, action: "restore", detail: "Mở lại trận" });
  refreshAll();
  return { ok: true, message: "Đã mở lại trận" };
}

export async function deleteMatch(id: number) {
  await requireAdmin();
  if (!idSchema.safeParse(id).success) return;
  await db.delete(matches).where(eq(matches.id, id));
  refreshAll();
  redirect("/admin");
}

/* ---------------- Giao dịch ---------------- */

async function log(detail: string) {
  await db.insert(auditLogs).values({ action: "transaction", detail });
}

export async function assignTransaction(id: number, memberId: number): Promise<ActionState> {
  await requireAdmin();
  const p = assignSchema.safeParse({ id, memberId });
  if (!p.success) return { error: "Chọn thành viên" };
  const [m] = await db.select().from(members).where(eq(members.id, p.data.memberId));
  if (!m) return { error: "Không tìm thấy thành viên" };
  const [tx] = await db.select({ amount: transactions.amount }).from(transactions).where(eq(transactions.id, p.data.id));
  if (!tx) return { error: "Không tìm thấy giao dịch" };
  const target = await findPaymentTarget(m.id, tx.amount);
  const res = await db
    .update(transactions)
    .set({ memberId: m.id, status: "matched", matchId: target?.matchId ?? null })
    .where(eq(transactions.id, p.data.id))
    .returning({ amount: transactions.amount });
  if (!res.length) return { error: "Không tìm thấy giao dịch" };
  await applyDeclare(m.id, target);
  await log(`Gán giao dịch #${id} cho ${m.name}`);
  refreshAll();
  return { ok: true, message: `Đã ghi ${formatK(res[0].amount)} cho ${m.name}` };
}

export async function ignoreTransaction(id: number): Promise<ActionState> {
  await requireAdmin();
  if (!idSchema.safeParse(id).success) return { error: "Giao dịch không hợp lệ" };
  await db.update(transactions).set({ status: "ignored" }).where(eq(transactions.id, id));
  await log(`Đánh dấu giao dịch #${id} không phải tiền bóng`);
  refreshAll();
  return { ok: true, message: "Đã gỡ khỏi tiền bóng" };
}

export async function restoreTransaction(id: number): Promise<ActionState> {
  await requireAdmin();
  if (!idSchema.safeParse(id).success) return { error: "Giao dịch không hợp lệ" };
  const [t] = await db.select().from(transactions).where(eq(transactions.id, id));
  if (!t) return { error: "Không tìm thấy giao dịch" };
  await db
    .update(transactions)
    .set({ status: t.memberId ? "matched" : "pending" })
    .where(eq(transactions.id, id));
  await log(`Khôi phục giao dịch #${id}`);
  refreshAll();
  return { ok: true, message: "Đã khôi phục" };
}

export async function addManualPayment(_: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const p = parse(manualPaymentSchema, form);
  if (!p.success) return { fieldErrors: toFieldErrors(p.error) };
  const { memberId, amount, note } = p.data;
  const [m] = await db.select().from(members).where(eq(members.id, memberId));
  if (!m) return { fieldErrors: { memberId: "Không tìm thấy thành viên" } };
  const target = await findPaymentTarget(memberId, amount);
  await db.insert(transactions).values({
    amount,
    memberId,
    matchId: target?.matchId ?? null,
    status: "matched",
    source: "manual",
    content: "Tiền mặt / admin ghi tay",
    note,
  });
  await applyDeclare(memberId, target);
  await log(`Ghi tay ${formatK(amount)} cho ${m.name}`);
  refreshAll();
  return { ok: true, message: `Đã ghi ${formatK(amount)} cho ${m.name}` };
}

/** Admin nhận tiền mặt ngay trên trang đội (nút trong sheet "Trả"). */
export async function recordCash(memberId: number, amount: number, matchId?: number): Promise<ActionState> {
  await requireAdmin();
  const p = z
    .object({ memberId: idSchema, amount: z.number().int().min(1_000).max(50_000_000) })
    .safeParse({ memberId, amount });
  if (!p.success) return { error: "Số tiền không hợp lệ" };
  const [m] = await db.select().from(members).where(eq(members.id, p.data.memberId));
  if (!m) return { error: "Không tìm thấy thành viên" };
  await db.insert(transactions).values({
    amount: p.data.amount,
    memberId: m.id,
    matchId: matchId && idSchema.safeParse(matchId).success ? matchId : null,
    status: "matched",
    source: "manual",
    content: "Tiền mặt",
  });
  await log(`Nhận tiền mặt ${formatK(p.data.amount)} của ${m.name}`);
  refreshAll();
  return { ok: true, message: `Đã nhận ${formatK(p.data.amount)} tiền mặt của ${m.name}` };
}
