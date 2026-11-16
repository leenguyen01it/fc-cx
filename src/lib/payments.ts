import "server-only";
import { and, eq } from "drizzle-orm";
import { db, matchPlayers } from "@/db";
import { getTeamState } from "./data";
import { teamFromAmount, type Team } from "./split";

export interface PaymentTarget {
  matchId: number;
  /** Người chưa chọn đội: số tiền khớp mức của đội này → xếp vào đội. */
  declare?: Team;
}

/**
 * Quy định: mỗi trận chuyển đúng số tiền của trận đó.
 * → Tìm trận (cũ nhất trước) mà số tiền khớp đúng:
 *   - số còn nợ của trận đã rõ tiền, hoặc
 *   - 1 trong 2 mức (thắng / thua) của trận mà người này chưa chọn đội.
 * Gọi TRƯỚC khi ghi giao dịch (để số còn nợ chưa bị trừ).
 */
export async function findPaymentTarget(memberId: number, amount: number): Promise<PaymentTarget | null> {
  const state = await getTeamState();
  const candidates: (PaymentTarget & { date: string })[] = [];

  for (const c of state.ledgers.get(memberId)?.charges ?? []) {
    if (c.status !== "paid" && c.remaining === amount) candidates.push({ matchId: c.matchId, date: c.date });
  }
  for (const b of state.bundles) {
    const p = b.split.players.find((x) => x.memberId === memberId && x.pending);
    const team = p && teamFromAmount(p, amount);
    if (team) candidates.push({ matchId: b.match.id, date: b.match.date, declare: team });
  }
  candidates.sort((a, b) => a.date.localeCompare(b.date) || a.matchId - b.matchId);
  const t = candidates[0];
  return t ? { matchId: t.matchId, declare: t.declare } : null;
}

/** Xếp đội cho người chưa chọn đội (sau khi đã ghi giao dịch). */
export async function applyDeclare(memberId: number, target: PaymentTarget | null) {
  if (!target?.declare) return;
  await db
    .update(matchPlayers)
    .set({ team: target.declare, pending: false })
    .where(
      and(eq(matchPlayers.matchId, target.matchId), eq(matchPlayers.memberId, memberId), eq(matchPlayers.pending, true)),
    );
}
