/**
 * Dữ liệu mẫu để xem thử mọi tình huống: npm run db:seed
 * KHÔNG chạy trên database thật – script xoá sạch dữ liệu cũ.
 */
import { config } from "dotenv";
config({ path: [".env.local", ".env"] });

import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as s from "../src/db/schema";
import { suggestCode } from "../src/lib/text";
import { computeSplit, settledTotal, type SplitItem } from "../src/lib/split";

if (process.env.DATABASE_URL?.includes("neon.tech") && !process.argv.includes("--force")) {
  console.error("Từ chối seed vào Neon (database thật). Thêm --force nếu chắc chắn.");
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });
const db = drizzle(sql, { schema: s });

const NAMES = [
  "Nguyễn Văn Hùng", "Trần Minh Nam", "Lê Anh Tuấn", "Phạm Đức Long", "Hoàng Minh Khoa",
  "Vũ Văn Bình", "Đặng Thanh Tú", "Bùi Quang Minh", "Đỗ Hữu Đức", "Ngô Văn Hải",
  "Dương Anh Quân", "Lý Hoàng Sơn", "Mai Văn Phong", "Trịnh Quốc Việt", "Phan Văn Hùng",
  "Cao Minh Thắng", "Trần Quang Ngọc", "Lê Bảo Ngọc",
];

type Item = Omit<SplitItem, "id">;
const base = { loserPct: 70, bearer: "loser", includeNonEaters: true, drawMode: "half", sponsorAmount: 0, sponsorName: "" } as const;
const san = (amount: number, loserPct = 70): Item => ({ ...base, name: "Tiền sân", amount, rule: "ratio", loserPct });
const an = (amount: number, sponsor?: [string, number]): Item => ({
  ...base,
  name: "Tiền ăn",
  amount,
  rule: "eaters",
  ...(sponsor ? { sponsorName: sponsor[0], sponsorAmount: sponsor[1] } : {}),
});
const keo = (name: string, amount: number): Item => ({ ...base, name, amount, rule: "bet" });
/** Tiền ăn 50/50 theo đội (chỉ tính người ăn) */
const an5050 = (amount: number): Item => ({ ...base, name: "Tiền ăn", amount, rule: "ratio", loserPct: 50, eatersOnly: true });

const at = (d: string, hm = "21:30") => new Date(`${d}T${hm}:00+07:00`);

async function main() {
  // ---- xoá dữ liệu cũ
  await db.delete(s.auditLogs);
  await db.delete(s.transactions);
  await db.delete(s.rsvps);
  await db.delete(s.matches);
  await db.delete(s.members);
  await db.delete(s.settings);

  await db.insert(s.settings).values({
    id: 1,
    teamName: "FC CX",
    prefix: "CX",
    transferSuffix: "CK da bong",
    bankBin: "970422",
    bankName: "MB Bank",
    accountNo: "0123456789",
    accountName: "NGUYEN VAN A",
    defaultVenue: "Sân bóng Mai Về",
    defaultTime: "18:00",
    teamAName: "Nhất",
    teamBName: "Bét",
  });

  // ---- thành viên (+ 1 người đã nghỉ, 1 khách)
  const codes: string[] = [];
  const add = (name: string, extra: Partial<typeof s.members.$inferInsert> = {}) => {
    const code = suggestCode(name, codes);
    codes.push(code);
    return { name, code, ...extra };
  };
  const mem = await db
    .insert(s.members)
    .values([
      ...NAMES.map((n) => add(n)),
      add("Hồ Văn Nghỉ", { active: false }),
      add("Đỗ Văn Tài", { active: false, guest: true }),
    ])
    .returning();
  const M = (name: string) => mem.find((m) => m.name === name)!.id;
  const ids = NAMES.map(M);
  const guest = M("Đỗ Văn Tài");

  const txs: (typeof s.transactions.$inferInsert)[] = [];
  let ext = 0;
  /** Chuyển đúng số tiền trận (gắn trận) */
  const payExact = (memberId: number, amount: number, matchId: number, d: string, hm?: string, cash = false) =>
    txs.push({
      externalId: cash ? null : `seed:${++ext}`,
      amount,
      memberId,
      matchId,
      status: "matched",
      source: cash ? "manual" : "webhook",
      content: cash ? "Tiền mặt" : `CX ${mem.find((m) => m.id === memberId)!.code} CK da bong`,
      occurredAt: at(d, hm),
    });

  /** Tạo trận đã công bố + tính tiền + trả tiền theo kịch bản */
  async function played(o: {
    date: string;
    score: [number, number];
    items: Item[];
    players: { memberId: number; team: "A" | "B" | null; ate: boolean; pending?: boolean }[];
    sizes?: { A: number; B: number };
    note?: string;
    /** memberId → "paid" | "partial" | "cash" | "none" */
    pay: (memberId: number) => "paid" | "partial" | "cash" | "none";
  }) {
    const [m] = await db
      .insert(s.matches)
      .values({
        date: o.date,
        venue: "Sân bóng Mai Về",
        timeRange: "18:00",
        scoreA: o.score[0],
        scoreB: o.score[1],
        published: true,
        sizeA: o.sizes?.A ?? null,
        sizeB: o.sizes?.B ?? null,
        note: o.note ?? "",
      })
      .returning();
    await db.insert(s.matchPlayers).values(o.players.map((p) => ({ ...p, pending: !!p.pending, matchId: m.id })));
    await db.insert(s.costItems).values(o.items.map((it, i) => ({ ...it, matchId: m.id, sort: i })));
    const split = computeSplit(
      o.players,
      o.items.map((it, i) => ({ ...it, id: i })),
      o.score[0],
      o.score[1],
      undefined,
      o.sizes ?? {},
    );
    for (const c of split.players) {
      const amount = settledTotal(c);
      if (amount == null || amount === 0) continue;
      const how = o.pay(c.memberId);
      if (how === "paid") payExact(c.memberId, amount, m.id, o.date, `2${1 + (c.memberId % 3)}:${10 + (c.memberId % 40)}`);
      if (how === "cash") payExact(c.memberId, amount, m.id, o.date, "22:00", true);
      if (how === "partial") payExact(c.memberId, Math.round(amount / 2 / 1000) * 1000, m.id, o.date, "22:15");
    }
    return { match: m, split };
  }

  const teams = (list: number[], half = list.length / 2) =>
    list.map((id, i) => ({ memberId: id, team: (i < half ? "A" : "B") as "A" | "B", ate: true }));

  // ① 25/10 – kèo chuẩn (sân 7/3, ăn 50/50), cả đội đã trả đủ
  await played({
    date: "2026-10-25",
    score: [3, 1],
    items: [san(700_000), an5050(1_100_000)],
    players: teams(ids.slice(0, 14)),
    pay: () => "paid",
  });

  // ② 01/11 – kèo gà (sân 50/50, ăn chia đều, gà đội thua); 1 người không ăn; 1 người trả thiếu, 2 người chưa trả
  await played({
    date: "2026-11-01",
    score: [1, 2],
    items: [san(600_000, 50), an(1_000_000), keo("Tiền gà", 400_000)],
    players: teams(ids.slice(2, 14)).map((p) => (p.memberId === ids[13] ? { ...p, ate: false } : p)),
    pay: (id) => (id === ids[3] ? "partial" : id === ids[4] || id === ids[5] ? "none" : "paid"),
  });

  // ③ 08/11 – hoà; anh Tuấn ủng hộ tiền ăn; khách đá ké; 1 người chỉ ăn; 1 người trả tiền mặt
  await played({
    date: "2026-11-08",
    score: [2, 2],
    items: [san(600_000, 50), an(1_300_000, ["Anh Tuấn", 300_000]), keo("Tiền gà", 300_000)],
    players: [
      ...teams([...ids.slice(0, 11), guest]),
      { memberId: ids[15], team: null, ate: true }, // chỉ ăn
    ],
    note: "Anh Tuấn ủng hộ 300k tiền ăn. Khách Tài đá ké.",
    pay: (id) => (id === ids[2] ? "cash" : [ids[0], ids[1], guest, ids[15]].includes(id) ? "none" : "paid"),
  });

  // ④ 12/11 – huỷ vì trời mưa (đã có người điểm danh)
  const [rain] = await db
    .insert(s.matches)
    .values({ date: "2026-11-12", venue: "Sân bóng Mai Về", timeRange: "18:00", cancelled: true, cancelReason: "Trời mưa" })
    .returning();
  await db.insert(s.rsvps).values(ids.slice(0, 9).map((id) => ({ matchId: rain.id, memberId: id, going: true, eat: true })));
  await db.insert(s.auditLogs).values({ matchId: rain.id, action: "cancel", detail: "Huỷ trận: Trời mưa" });

  // ⑤ 15/11 – vừa đá xong: 4 người đã có đội, 6 người chưa chọn đội (mỗi đội 5 người)
  const m5players = [
    { memberId: ids[0], team: "A" as const, ate: true },
    { memberId: ids[1], team: "A" as const, ate: true },
    { memberId: ids[6], team: "B" as const, ate: true },
    { memberId: ids[7], team: "B" as const, ate: false },
    ...[ids[8], ids[9], ids[10], ids[11], ids[16], ids[17]].map((id) => ({ memberId: id, team: null, ate: true, pending: true })),
    { memberId: ids[12], team: null, ate: true }, // chỉ ăn
  ];
  const m5 = await played({
    date: "2026-11-15",
    score: [4, 3],
    items: [san(600_000), an5050(1_100_000)],
    players: m5players,
    sizes: { A: 5, B: 5 },
    pay: (id) => (id === ids[0] || id === ids[12] ? "paid" : "none"),
  });
  // Quang Ngọc chuyển đúng mức đội thua → được tự xếp vào đội thua
  const ngoc = m5.split.players.find((p) => p.memberId === ids[16])!;
  await db
    .update(s.matchPlayers)
    .set({ team: "B", pending: false })
    .where(and(eq(s.matchPlayers.matchId, m5.match.id), eq(s.matchPlayers.memberId, ids[16])));
  payExact(ids[16], ngoc.choices!.B, m5.match.id, "2026-11-15", "21:45");
  // Đỗ Hữu Đức chuyển sai số (làm tròn) → tiền vào ví, vẫn chưa chọn đội
  txs.push({
    externalId: `seed:${++ext}`,
    amount: 200_000,
    memberId: ids[8],
    status: "matched",
    source: "webhook",
    content: `CX ${mem.find((m) => m.id === ids[8])!.code} CK da bong`,
    occurredAt: at("2026-11-15", "22:05"),
  });

  // ⑥ 22/11 – đang điểm danh
  const [vote] = await db
    .insert(s.matches)
    .values({ date: "2026-11-22", venue: "Sân bóng Mai Về", timeRange: "18:00", voting: true })
    .returning();
  await db.insert(s.rsvps).values([
    ...ids.slice(0, 8).map((id) => ({ matchId: vote.id, memberId: id, going: true, eat: true })),
    { matchId: vote.id, memberId: ids[8], going: true, eat: false },
    { matchId: vote.id, memberId: ids[9], going: true, eat: false },
    { matchId: vote.id, memberId: ids[10], going: false, eat: true }, // chỉ ăn
    { matchId: vote.id, memberId: ids[11], going: false, eat: false }, // bận
  ]);

  // ---- giao dịch lạ
  txs.push(
    { externalId: `seed:${++ext}`, amount: 172_000, content: "chuyen tien da bong", status: "pending", source: "webhook", occurredAt: at("2026-11-15", "22:30") },
    { externalId: `seed:${++ext}`, amount: 45_000, content: "tra tien cafe", memberId: ids[1], status: "ignored", source: "webhook", occurredAt: at("2026-11-10", "08:00") },
  );
  await db.insert(s.transactions).values(txs);

  console.log(`Seed xong: ${mem.length} thành viên, 6 trận, ${txs.length} giao dịch`);
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
