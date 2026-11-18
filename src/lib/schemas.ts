/**
 * Quy tắc validate dùng chung cho frontend (báo lỗi ngay khi nhập)
 * và backend (server action / webhook – không bao giờ tin dữ liệu client gửi lên).
 */
import { z } from "zod";
import { BANKS, MAX_CONTENT } from "./vietqr";
import { MAX_CODE_LEN, stripDiacritics } from "./text";
import { isTeamless } from "./split";

export const LIMITS = {
  maxMoney: 100_000_000,
  maxPayment: 50_000_000,
  minPayment: 1_000,
  maxScore: 99,
} as const;

/* ---------- kiểu dữ liệu nhỏ ---------- */

const bool = z.preprocess((v) => v === true || v === "on" || v === "true" || v === "1", z.boolean());

const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Chọn ngày hợp lệ")
  .refine((s) => {
    const [y, m, d] = s.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d && y >= 2020 && y <= 2100;
  }, "Ngày không tồn tại");

/** Nhận "172.000", "172000", 172000 → 172000 */
const money = (max: number = LIMITS.maxMoney) =>
  z.preprocess(
    (v) => (typeof v === "string" ? Number(v.replace(/[^\d]/g, "") || 0) : v),
    z
      .number({ error: "Nhập số tiền" })
      .int("Số tiền phải là số nguyên")
      .min(0, "Số tiền không được âm")
      .max(max, `Tối đa ${new Intl.NumberFormat("vi-VN").format(max)}đ`),
  );

const personName = z
  .string()
  .trim()
  .min(2, "Tên quá ngắn")
  .max(60, "Tên tối đa 60 ký tự")
  .regex(/^[\p{L}\p{M}\s.'-]+$/u, "Tên chỉ gồm chữ cái");

export const memberCode = z
  .string()
  .trim()
  .transform((s) => stripDiacritics(s).toUpperCase().replace(/\s+/g, " ").trim())
  .pipe(
    z
      .string()
      .min(2, "Mã tối thiểu 2 ký tự")
      .max(MAX_CODE_LEN, `Mã tối đa ${MAX_CODE_LEN} ký tự (kể cả dấu cách)`)
      .regex(/^[A-Z0-9]+( [A-Z0-9]+)*$/, "Mã chỉ gồm chữ không dấu và số, VD: QUANG NGOC"),
  );

/** Mã thành viên dài nhất – dùng để kiểm tra nội dung chuyển khoản không vượt 25 ký tự. */
export const MAX_CODE = MAX_CODE_LEN;

/* ---------- form ---------- */

export const loginSchema = z.object({
  password: z.string().min(1, "Nhập mật khẩu").max(200),
});

export const memberCreateSchema = z.object({
  name: personName,
  code: z.union([z.literal(""), memberCode]).optional().default(""),
});

export const memberUpdateSchema = z.object({
  id: z.coerce.number().int().positive(),
  name: personName,
  code: memberCode,
  active: bool,
});

export const settingsSchema = z
  .object({
    teamName: z.string().trim().min(2, "Tên đội quá ngắn").max(40, "Tối đa 40 ký tự"),
    prefix: z
      .string()
      .trim()
      .transform((s) => stripDiacritics(s).toUpperCase())
      .pipe(z.string().regex(/^[A-Z]{2,6}$/, "2–6 chữ cái không dấu, VD: TB")),
    bankBin: z.union([z.literal(""), z.enum(BANKS.map((b) => b.bin) as [string, ...string[]])], {
      error: "Chọn ngân hàng trong danh sách",
    }),
    accountNo: z
      .string()
      .trim()
      .transform((s) => s.replace(/[\s.-]/g, ""))
      .pipe(z.union([z.literal(""), z.string().regex(/^\d{6,19}$/, "Số tài khoản gồm 6–19 chữ số")])),
    accountName: z
      .string()
      .trim()
      .transform((s) => stripDiacritics(s).toUpperCase().replace(/\s+/g, " "))
      .pipe(z.union([z.literal(""), z.string().regex(/^[A-Z ]{2,50}$/, "Tên chủ tài khoản không dấu, VD: NGUYEN VAN A")])),
    dedicatedAccount: bool,
    treasurerId: z.preprocess(
      (v) => (v === "" || v == null ? null : Number(v)),
      z.number({ error: "Chọn thành viên" }).int().positive("Chọn thành viên").nullable(),
    ),
    transferSuffix: z
      .string()
      .trim()
      .transform((s) => stripDiacritics(s).replace(/[^A-Za-z0-9 ]/g, "").replace(/\s+/g, " ").trim())
      .pipe(z.string().max(MAX_CONTENT, "Quá dài")),
    defaultVenue: z.string().trim().max(100, "Tối đa 100 ký tự"),
    defaultTime: z.string().trim().max(40, "Tối đa 40 ký tự"),
    teamAName: z.string().trim().min(1, "Nhập tên đội").max(12, "Tối đa 12 ký tự"),
    teamBName: z.string().trim().min(1, "Nhập tên đội").max(12, "Tối đa 12 ký tự"),
  })
  .superRefine((v, ctx) => {
    if (v.teamAName.toLowerCase() === v.teamBName.toLowerCase())
      ctx.addIssue({ code: "custom", path: ["teamBName"], message: "Tên 2 đội phải khác nhau" });
    // "CX" + " " + mã dài nhất + " " + phần thêm ≤ 25 ký tự (giới hạn của mã QR)
    const len = v.prefix.length + 1 + MAX_CODE + (v.transferSuffix ? 1 + v.transferSuffix.length : 0);
    if (len > MAX_CONTENT) {
      const room = MAX_CONTENT - v.prefix.length - MAX_CODE - 2;
      ctx.addIssue({
        code: "custom",
        path: ["transferSuffix"],
        message: `Nội dung QR tối đa ${MAX_CONTENT} ký tự → phần này tối đa ${Math.max(0, room)} ký tự (VD: "CK da bong")`,
      });
    }
    const any = v.bankBin || v.accountNo || v.accountName;
    if (!any) return;
    if (!v.bankBin) ctx.addIssue({ code: "custom", path: ["bankBin"], message: "Chọn ngân hàng" });
    if (!v.accountNo) ctx.addIssue({ code: "custom", path: ["accountNo"], message: "Nhập số tài khoản" });
    if (!v.accountName) ctx.addIssue({ code: "custom", path: ["accountName"], message: "Nhập tên chủ tài khoản" });
  });

export const manualPaymentSchema = z.object({
  memberId: z.coerce.number({ error: "Chọn thành viên" }).int().positive("Chọn thành viên"),
  amount: money(LIMITS.maxPayment).refine((n) => n >= LIMITS.minPayment, "Tối thiểu 1.000đ"),
  note: z.string().trim().max(200, "Tối đa 200 ký tự").optional().default(""),
});

export const createMatchSchema = z.object({
  date: isoDate,
  preset: z.enum(["standard", "bet", "away", "empty"], { error: "Chọn mẫu kèo" }),
});

export const assignSchema = z.object({
  id: z.coerce.number().int().positive(),
  memberId: z.coerce.number({ error: "Chọn thành viên" }).int().positive("Chọn thành viên"),
});

/* ---------- trận đấu (màn hình sửa trận) ---------- */

const score = z
  .union([z.null(), z.number().int("Tỷ số là số nguyên").min(0, "Không âm").max(LIMITS.maxScore, "Tối đa 99")])
  .default(null);

export const costItemSchema = z.object({
  name: z.string().trim().max(60, "Tối đa 60 ký tự"),
  amount: money(),
  rule: z.enum(["ratio", "eaters", "all", "bet"]),
  loserPct: z.number().int("Nhập số nguyên").min(0, "0–100%").max(100, "0–100%"),
  bearer: z.enum(["loser", "winner"]),
  includeNonEaters: z.boolean(),
  drawMode: z.enum(["half", "all"]),
  eatersOnly: z.boolean().default(false),
  sponsorAmount: money(),
  sponsorName: z.string().trim().max(60, "Tối đa 60 ký tự"),
});

/**
 * "Lưu" (đang điểm danh, chưa đá): chỉ kiểm tra kiểu dữ liệu & giới hạn – được để trống đội hình, chi phí, tỷ số.
 * "Công bố kết quả": kiểm tra đầy đủ để chia tiền đúng.
 */
export const matchSchema = z
  .object({
    date: isoDate,
    venue: z.string().trim().max(100, "Tối đa 100 ký tự"),
    timeRange: z.string().trim().max(40, "Tối đa 40 ký tự"),
    scoreA: score,
    scoreB: score,
    note: z.string().max(1000, "Tối đa 1000 ký tự"),
    published: z.boolean(),
    voting: z.boolean().default(false),
    sizeA: z.number().int().min(0).max(30).nullable().default(null),
    sizeB: z.number().int().min(0).max(30).nullable().default(null),
    players: z
      .array(
        z
          .object({
            memberId: z.number().int().positive(),
            team: z.enum(["A", "B"]).nullable(),
            ate: z.boolean(),
            pending: z.boolean().default(false),
          })
          // có đội thì không còn "chưa chọn"; người chỉ ăn luôn tính là có ăn
          .transform((p) =>
            p.team ? { ...p, pending: false } : p.pending ? p : { ...p, ate: true },
          ),
      )
      .max(60),
    items: z.array(costItemSchema).max(20, "Tối đa 20 khoản"),
  })
  // Đá đối: không chia đội, không tỷ số – mọi người đá vào chung đội A
  .transform((m) =>
    isTeamless(m.items)
      ? {
          ...m,
          scoreA: null,
          scoreB: null,
          sizeA: null,
          sizeB: null,
          players: m.players.map((p) => (p.team || p.pending ? { ...p, team: "A" as const, pending: false } : p)),
        }
      : m,
  )
  .superRefine((m, ctx) => {
    const ids = new Set<number>();
    for (const p of m.players) {
      if (ids.has(p.memberId)) ctx.addIssue({ code: "custom", path: ["players"], message: "Trùng người trong đội hình" });
      ids.add(p.memberId);
    }
    if (!m.published) return;

    // ---- chỉ khi công bố kết quả ----
    const a = m.players.filter((p) => p.team === "A").length;
    const b = m.players.filter((p) => p.team === "B").length;
    const pending = m.players.filter((p) => p.pending).length;
    if (pending > 0) {
      // Còn người chưa chọn đội → cần số người mỗi đội để chia tiền
      if (m.sizeA == null || m.sizeB == null || m.sizeA < 1 || m.sizeB < 1)
        ctx.addIssue({ code: "custom", path: ["sizeA"], message: "Nhập số người mỗi đội" });
      else if (m.sizeA < a || m.sizeB < b)
        ctx.addIssue({ code: "custom", path: ["sizeA"], message: "Số người mỗi đội ít hơn số người đã chọn đội" });
      else if (m.sizeA + m.sizeB !== a + b + pending)
        ctx.addIssue({ code: "custom", path: ["sizeA"], message: `Tổng 2 đội phải bằng ${a + b + pending} người đá` });
    } else if (isTeamless(m.items)) {
      if (a === 0) ctx.addIssue({ code: "custom", path: ["players"], message: "Chưa có người đá" });
    } else if (a === 0 || b === 0)
      ctx.addIssue({ code: "custom", path: ["players"], message: "Mỗi đội cần ít nhất 1 người" });
    if ((m.scoreA == null) !== (m.scoreB == null))
      ctx.addIssue({ code: "custom", path: [m.scoreA == null ? "scoreA" : "scoreB"], message: "Nhập đủ tỷ số 2 đội" });
    if (m.items.length === 0) ctx.addIssue({ code: "custom", path: ["items"], message: "Thêm ít nhất 1 khoản chi" });

    const names = new Set<string>();
    m.items.forEach((it, i) => {
      const k = it.name.trim().toLowerCase();
      if (!k) ctx.addIssue({ code: "custom", path: ["items", i, "name"], message: "Nhập tên khoản" });
      else if (names.has(k)) ctx.addIssue({ code: "custom", path: ["items", i, "name"], message: "Trùng tên khoản" });
      names.add(k);
      if (it.amount <= 0) ctx.addIssue({ code: "custom", path: ["items", i, "amount"], message: "Nhập số tiền" });
      if (it.sponsorAmount > it.amount)
        ctx.addIssue({ code: "custom", path: ["items", i, "sponsorAmount"], message: "Ủng hộ không vượt quá khoản chi" });
      if (it.sponsorAmount > 0 && !it.sponsorName.trim())
        ctx.addIssue({ code: "custom", path: ["items", i, "sponsorName"], message: "Ghi tên người ủng hộ" });
    });
    // Tiền ăn chỉ bổ đầu người đi ăn → không ai ăn thì khoản đó không thu được của ai
    if (!m.players.some((p) => p.ate))
      m.items.forEach((it, i) => {
        const foodOnly = it.rule === "eaters" || (it.rule === "ratio" && it.eatersOnly) || (it.rule === "bet" && !it.includeNonEaters);
        if (foodOnly && it.amount > it.sponsorAmount)
          ctx.addIssue({ code: "custom", path: ["items", i, "amount"], message: "Chưa có ai đi ăn để bổ đầu khoản này" });
      });
    const needsResult = m.items.some((it) => it.rule === "ratio" || it.rule === "bet");
    if (needsResult && m.scoreA == null)
      ctx.addIssue({ code: "custom", path: ["scoreA"], message: "Nhập tỷ số để chia tiền sân / kèo" });
  });

export type MatchInput = z.input<typeof matchSchema>;
export type MatchData = z.output<typeof matchSchema>;

/* ---------- webhook SePay ---------- */

export const sepaySchema = z.object({
  id: z.union([z.number(), z.string().min(1)]),
  transferType: z.enum(["in", "out"]),
  transferAmount: z.coerce.number().nonnegative(),
  content: z.string().max(2000).nullish().transform((v) => v ?? ""),
  description: z.string().max(2000).nullish().transform((v) => v ?? ""),
  transactionDate: z.string().nullish().transform((v) => v ?? undefined),
});

/* ---------- tiện ích ---------- */

export type FieldErrors = Record<string, string>;

/** issues → { "items.2.amount": "Nhập số tiền" } (giữ lỗi đầu tiên của mỗi ô). */
export function toFieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}

export function formDataToObject(form: FormData): Record<string, string> {
  const o: Record<string, string> = {};
  form.forEach((v, k) => {
    if (typeof v === "string") o[k] = v;
  });
  return o;
}

/** Bảng schema theo tên, để client component (ActionForm) validate trước khi gửi. */
export const FORM_SCHEMAS = {
  login: loginSchema,
  memberCreate: memberCreateSchema,
  memberUpdate: memberUpdateSchema,
  settings: settingsSchema,
  manualPayment: manualPaymentSchema,
  createMatch: createMatchSchema,
  assign: assignSchema,
} as const;

export type FormSchemaKey = keyof typeof FORM_SCHEMAS;

export type ActionState =
  | { ok?: boolean; message?: string; error?: string; fieldErrors?: FieldErrors }
  | undefined;
