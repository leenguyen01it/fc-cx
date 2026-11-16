import {
  boolean,
  date,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

/** Cấu hình chung của đội (chỉ có 1 dòng, id = 1). */
export const settings = pgTable("settings", {
  id: integer("id").primaryKey().default(1),
  teamName: text("team_name").notNull().default("FC CX"),
  /** Mã đội đứng đầu nội dung chuyển khoản, ví dụ "CX" → "CX HUNG". */
  prefix: text("prefix").notNull().default("CX"),
  /** Chữ thêm sau mã thành viên, VD "CK da bong" → "CX HUNG CK da bong". */
  transferSuffix: text("transfer_suffix").notNull().default("CK da bong"),
  /** Mặc định khi tạo trận mới. */
  defaultVenue: text("default_venue").notNull().default("Sân bóng Mai Về"),
  defaultTime: text("default_time").notNull().default("18:00"),
  /** Tên hiển thị của 2 đội (trong DB vẫn là A/B). */
  teamAName: text("team_a_name").notNull().default("Nhất"),
  teamBName: text("team_b_name").notNull().default("Bét"),
  bankBin: text("bank_bin").notNull().default(""),
  bankName: text("bank_name").notNull().default(""),
  accountNo: text("account_no").notNull().default(""),
  accountName: text("account_name").notNull().default(""),
  /** Tài khoản riêng của đội: tiền vào không có mã đội vẫn giữ lại để admin xác nhận. */
  dedicatedAccount: boolean("dedicated_account").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const members = pgTable(
  "members",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    /** Tên ngắn không dấu, dùng trong nội dung chuyển khoản. */
    code: text("code").notNull(),
    active: boolean("active").notNull().default(true),
    /** Người ngoài đội đá ké: không hiện trong điểm danh / danh sách đội. */
    guest: boolean("guest").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("members_code_uq").on(t.code)],
);

export const matches = pgTable(
  "matches",
  {
    id: serial("id").primaryKey(),
    date: date("date", { mode: "string" }).notNull(),
    venue: text("venue").notNull().default(""),
    timeRange: text("time_range").notNull().default(""),
    scoreA: integer("score_a"),
    scoreB: integer("score_b"),
    /** Số người mỗi đội – dùng để chia tiền khi còn người chưa chọn đội. */
    sizeA: integer("size_a"),
    sizeB: integer("size_b"),
    note: text("note").notNull().default(""),
    published: boolean("published").notNull().default(false),
    /** Đang mở điểm danh: hiện trên link chung để mọi người đăng ký đá / ăn. */
    voting: boolean("voting").notNull().default(false),
    /** Trận bị huỷ (VD trời mưa): vẫn hiện trên link chung với lý do, không tính tiền. */
    cancelled: boolean("cancelled").notNull().default(false),
    cancelReason: text("cancel_reason").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("matches_date_idx").on(t.date)],
);

export const matchPlayers = pgTable(
  "match_players",
  {
    id: serial("id").primaryKey(),
    matchId: integer("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    memberId: integer("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "restrict" }),
    /** null = chỉ đi ăn (pending=false) hoặc đá nhưng chưa chọn đội (pending=true). */
    team: text("team", { enum: ["A", "B"] }),
    ate: boolean("ate").notNull().default(true),
    /** Có đá nhưng chưa chọn đội – tự chọn khi đóng tiền, hoặc tự nhận từ số tiền chuyển khoản. */
    pending: boolean("pending").notNull().default(false),
  },
  (t) => [uniqueIndex("match_players_uq").on(t.matchId, t.memberId)],
);

/**
 * Một khoản chi trong trận.
 * rule:
 *  - ratio : chia theo tỷ lệ thắng/thua (tiền sân)
 *  - eaters: chia đều người đi ăn
 *  - all   : chia đều tất cả người đá
 *  - bet   : kèo phụ – một đội chịu
 */
export const costItems = pgTable("cost_items", {
  id: serial("id").primaryKey(),
  matchId: integer("match_id")
    .notNull()
    .references(() => matches.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  amount: integer("amount").notNull(),
  rule: text("rule", { enum: ["ratio", "eaters", "all", "bet"] }).notNull(),
  /** ratio: % đội thua chịu (70 = 7/3). */
  loserPct: integer("loser_pct").notNull().default(70),
  /** bet: đội chịu kèo. */
  bearer: text("bearer", { enum: ["loser", "winner"] }).notNull().default("loser"),
  /** bet: người không đi ăn vẫn góp. */
  includeNonEaters: boolean("include_non_eaters").notNull().default(true),
  /** ratio: chỉ chia cho người có ăn (VD tiền ăn 50/50 theo đội). */
  eatersOnly: boolean("eaters_only").notNull().default(false),
  /** Khi hòa: half = mỗi đội 50%, all = chia đều mọi người. */
  drawMode: text("draw_mode", { enum: ["half", "all"] }).notNull().default("half"),
  /** Số tiền được ủng hộ, trừ vào khoản này trước khi chia. */
  sponsorAmount: integer("sponsor_amount").notNull().default(0),
  /** Ai ủng hộ, ví dụ "Anh Tuấn". */
  sponsorName: text("sponsor_name").notNull().default(""),
  sort: integer("sort").notNull().default(0),
});

/** Điểm danh: mỗi người tự đăng ký đá / ăn cho một trận. */
export const rsvps = pgTable(
  "rsvps",
  {
    id: serial("id").primaryKey(),
    matchId: integer("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    memberId: integer("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    going: boolean("going").notNull(),
    eat: boolean("eat").notNull().default(true),
    /** Tự chọn đội ở sân sau khi oẳn tù tì (chỉ khi đá). */
    team: text("team", { enum: ["A", "B"] }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("rsvps_uq").on(t.matchId, t.memberId)],
);

export const transactions = pgTable(
  "transactions",
  {
    id: serial("id").primaryKey(),
    /** Mã giao dịch phía nhà cung cấp webhook, chống ghi trùng. */
    externalId: text("external_id"),
    amount: integer("amount").notNull(),
    content: text("content").notNull().default(""),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    memberId: integer("member_id").references(() => members.id, { onDelete: "set null" }),
    /** Trận mà khoản này trả cho (khớp đúng số tiền của trận). null = trừ theo thứ tự trận cũ trước. */
    matchId: integer("match_id").references(() => matches.id, { onDelete: "set null" }),
    status: text("status", { enum: ["matched", "pending", "ignored"] }).notNull(),
    source: text("source", { enum: ["webhook", "manual"] }).notNull(),
    note: text("note").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("transactions_external_uq").on(t.externalId)],
);

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  matchId: integer("match_id").references(() => matches.id, { onDelete: "cascade" }),
  action: text("action").notNull(),
  detail: text("detail").notNull().default(""),
});

export type Member = typeof members.$inferSelect;
export type Match = typeof matches.$inferSelect;
export type MatchPlayer = typeof matchPlayers.$inferSelect;
export type CostItem = typeof costItems.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type Settings = typeof settings.$inferSelect;
export type Rsvp = typeof rsvps.$inferSelect;
