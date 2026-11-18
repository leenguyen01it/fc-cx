/**
 * "Ví công nợ": mỗi thành viên có tổng phải trả (theo các trận) và tổng đã trả.
 * Khoản trả đã gắn trận (chuyển đúng số tiền của trận) → trả cho trận đó trước;
 * còn lại / phần thừa → trận cũ nhất còn nợ trước (FIFO).
 * Hàm thuần – không đụng database.
 */

export interface LedgerCharge {
  matchId: number;
  /** Dùng để sắp xếp: ngày trận rồi id. */
  date: string;
  amount: number;
}

export interface LedgerPayment {
  amount: number;
  at: Date;
  /** Trận mà khoản này trả cho (nếu xác định được). */
  matchId?: number | null;
}

export type ChargeStatus = "paid" | "partial" | "unpaid";

export interface AllocatedCharge extends LedgerCharge {
  paid: number;
  remaining: number;
  status: ChargeStatus;
  /** Thời điểm khoản này được trả đủ. */
  paidAt: Date | null;
}

export interface MemberLedger {
  charges: AllocatedCharge[];
  totalCharged: number;
  totalPaid: number;
  /** > 0: đang trả dư (có số dư); < 0: đang nợ. */
  balance: number;
}

export interface AllocateOptions {
  /**
   * Chủ tài khoản nhận tiền: không tự chuyển cho chính mình → phần còn nợ của mỗi trận
   * coi như đã trả (paidAt = null). Khoản đã ghi trước đó vẫn được tính bình thường.
   */
  selfFunded?: boolean;
}

export function allocate(
  charges: LedgerCharge[],
  payments: LedgerPayment[],
  opts: AllocateOptions = {},
): MemberLedger {
  const sortedCharges = [...charges].sort(
    (a, b) => a.date.localeCompare(b.date) || a.matchId - b.matchId,
  );
  const sortedPayments = [...payments]
    .filter((p) => p.amount > 0)
    .sort((a, b) => a.at.getTime() - b.at.getTime());

  const out: AllocatedCharge[] = sortedCharges.map((c) => ({
    ...c,
    paid: 0,
    remaining: c.amount,
    status: c.amount > 0 ? "unpaid" : "paid",
    paidAt: null,
  }));

  const byMatch = new Map(out.map((c) => [c.matchId, c]));
  const pay = (c: AllocatedCharge, amount: number, at: Date) => {
    const used = Math.min(amount, c.remaining);
    if (used <= 0) return 0;
    c.paid += used;
    c.remaining -= used;
    if (c.remaining === 0) {
      c.status = "paid";
      c.paidAt = at;
    } else c.status = "partial";
    return used;
  };

  // 1) Khoản đã gắn trận → trả cho đúng trận đó; phần thừa để lại
  const leftovers: { amount: number; at: Date }[] = [];
  for (const p of sortedPayments) {
    const target = p.matchId != null ? byMatch.get(p.matchId) : undefined;
    const used = target ? pay(target, p.amount, p.at) : 0;
    if (p.amount - used > 0) leftovers.push({ amount: p.amount - used, at: p.at });
  }
  // 2) Còn lại → trận cũ nhất còn nợ trước
  for (const p of leftovers) {
    let left = p.amount;
    for (const c of out) {
      if (left <= 0) break;
      left -= pay(c, left, p.at);
    }
  }

  let selfPaid = 0;
  if (opts.selfFunded) {
    for (const c of out) {
      if (c.remaining <= 0) continue;
      selfPaid += c.remaining;
      c.paid = c.amount;
      c.remaining = 0;
      c.status = "paid";
    }
  }

  const totalCharged = charges.reduce((s, c) => s + c.amount, 0);
  const totalPaid = sortedPayments.reduce((s, p) => s + p.amount, 0) + selfPaid;
  return { charges: out, totalCharged, totalPaid, balance: totalPaid - totalCharged };
}
