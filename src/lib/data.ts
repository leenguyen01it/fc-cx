import "server-only";
import { and, asc, desc, eq, inArray, or } from "drizzle-orm";
import {
  db,
  costItems,
  matches,
  matchPlayers,
  members,
  rsvps,
  settings,
  transactions,
  auditLogs,
  type CostItem,
  type Match,
  type Member,
  type MatchPlayer,
  type Settings,
  type Rsvp,
} from "@/db";
import { computeSplit, settledTotal, type SplitResult, type TeamNames } from "./split";

export const teamNamesOf = (s: Settings): TeamNames => ({ A: s.teamAName, B: s.teamBName });
import { allocate, type AllocatedCharge, type MemberLedger } from "./ledger";

export async function getSettings(): Promise<Settings> {
  const [row] = await db.select().from(settings).where(eq(settings.id, 1));
  if (row) return row;
  const [created] = await db.insert(settings).values({ id: 1 }).onConflictDoNothing().returning();
  return created ?? (await db.select().from(settings).where(eq(settings.id, 1)))[0];
}

export async function getMembers(): Promise<Member[]> {
  return db.select().from(members).orderBy(asc(members.name));
}

export interface MatchBundle {
  match: Match;
  players: MatchPlayer[];
  items: CostItem[];
  split: SplitResult;
}

async function loadBundles(list: Match[], names?: TeamNames): Promise<MatchBundle[]> {
  if (list.length === 0) return [];
  const ids = list.map((m) => m.id);
  const [ps, its] = await Promise.all([
    db.select().from(matchPlayers).where(inArray(matchPlayers.matchId, ids)),
    db.select().from(costItems).where(inArray(costItems.matchId, ids)).orderBy(asc(costItems.sort), asc(costItems.id)),
  ]);
  return list.map((match) => {
    const players = ps.filter((p) => p.matchId === match.id);
    const items = its.filter((i) => i.matchId === match.id);
    return { match, players, items, split: computeSplit(players, items, match.scoreA, match.scoreB, names, { A: match.sizeA, B: match.sizeB }) };
  });
}

export async function getMatchBundle(id: number): Promise<MatchBundle | null> {
  const [[m], st] = await Promise.all([db.select().from(matches).where(eq(matches.id, id)), getSettings()]);
  if (!m) return null;
  return (await loadBundles([m], teamNamesOf(st)))[0];
}

export async function getAllMatches(): Promise<Match[]> {
  return db.select().from(matches).orderBy(desc(matches.date), desc(matches.id));
}

export interface TeamState {
  settings: Settings;
  members: Member[];
  memberById: Map<number, Member>;
  /** Các trận đã công bố, mới nhất trước. */
  bundles: MatchBundle[];
  ledgers: Map<number, MemberLedger>;
  /** Trạng thái trả tiền của một người trong một trận. */
  chargeOf: (matchId: number, memberId: number) => AllocatedCharge | undefined;
}

/** Toàn bộ dữ liệu cho trang công khai: chia tiền từng trận + ví công nợ từng người. */
export async function getTeamState(): Promise<TeamState> {
  const [st, mems, published, pays] = await Promise.all([
    getSettings(),
    getMembers(),
    db
      .select()
      .from(matches)
      .where(and(eq(matches.published, true), eq(matches.cancelled, false)))
      .orderBy(desc(matches.date), desc(matches.id)),
    db
      .select({
        memberId: transactions.memberId,
        amount: transactions.amount,
        at: transactions.occurredAt,
        matchId: transactions.matchId,
      })
      .from(transactions)
      .where(eq(transactions.status, "matched")),
  ]);

  const bundles = await loadBundles(published, teamNamesOf(st));

  const chargesByMember = new Map<number, { matchId: number; date: string; amount: number }[]>();
  for (const b of bundles) {
    for (const p of b.split.players) {
      // Người chưa chọn đội mà 2 đội khác mức → chưa ghi nợ cho đến khi chọn đội
      const amount = settledTotal(p);
      if (amount == null) continue;
      const arr = chargesByMember.get(p.memberId) ?? [];
      arr.push({ matchId: b.match.id, date: b.match.date, amount });
      chargesByMember.set(p.memberId, arr);
    }
  }
  const paysByMember = new Map<number, { amount: number; at: Date; matchId: number | null }[]>();
  for (const p of pays) {
    if (p.memberId == null) continue;
    const arr = paysByMember.get(p.memberId) ?? [];
    arr.push({ amount: p.amount, at: p.at, matchId: p.matchId });
    paysByMember.set(p.memberId, arr);
  }

  const ledgers = new Map<number, MemberLedger>();
  const index = new Map<string, AllocatedCharge>();
  for (const m of mems) {
    const l = allocate(chargesByMember.get(m.id) ?? [], paysByMember.get(m.id) ?? [], {
      selfFunded: m.id === st.treasurerId,
    });
    ledgers.set(m.id, l);
    for (const c of l.charges) index.set(`${c.matchId}:${m.id}`, c);
  }

  return {
    settings: st,
    members: mems,
    memberById: new Map(mems.map((m) => [m.id, m])),
    bundles,
    ledgers,
    chargeOf: (matchId, memberId) => index.get(`${matchId}:${memberId}`),
  };
}

export async function getMatchLogs(matchId: number) {
  return db
    .select()
    .from(auditLogs)
    .where(and(eq(auditLogs.matchId, matchId)))
    .orderBy(desc(auditLogs.at))
    .limit(20);
}

export interface OpenMatch {
  match: Match;
  rsvps: Rsvp[];
}

/** Trận chưa công bố đang hiện trên link chung: đang điểm danh hoặc đã huỷ. */
export async function getOpenMatches(): Promise<OpenMatch[]> {
  const list = await db
    .select()
    .from(matches)
    .where(and(eq(matches.published, false), or(eq(matches.voting, true), eq(matches.cancelled, true))))
    .orderBy(desc(matches.date), desc(matches.id));
  if (!list.length) return [];
  const rs = await db.select().from(rsvps).where(inArray(rsvps.matchId, list.map((m) => m.id)));
  return list.map((match) => ({ match, rsvps: rs.filter((r) => r.matchId === match.id) }));
}

export async function getRsvps(matchId: number): Promise<Rsvp[]> {
  return db.select().from(rsvps).where(eq(rsvps.matchId, matchId));
}
