import "server-only";
import { db, members, transactions } from "@/db";
import { applyDeclare, findPaymentTarget } from "./payments";
import { getSettings } from "./data";
import { parseTransferContent } from "./reconcile";

export interface IncomingTransfer {
  externalId: string;
  amount: number;
  content: string;
  occurredAt: Date;
}

export type IngestResult =
  | { status: "matched"; code: string }
  | { status: "pending" }
  | { status: "skipped"; reason: string }
  | { status: "duplicate" };

/**
 * Ghi nhận một khoản tiền vào:
 *  - có mã đội + đúng mã thành viên → matched (tự trừ nợ)
 *  - có mã đội nhưng không rõ ai     → pending (admin chọn tên)
 *  - không có mã đội                 → pending nếu là tài khoản riêng của đội, ngược lại bỏ qua
 */
export async function ingestTransfer(t: IncomingTransfer): Promise<IngestResult> {
  if (!(t.amount > 0)) return { status: "skipped", reason: "not incoming" };
  const st = await getSettings();
  const mems = await db.select({ id: members.id, code: members.code }).from(members);
  const parsed = parseTransferContent(t.content, st.prefix, mems.map((m) => m.code));

  if (!parsed.hasPrefix && !st.dedicatedAccount) return { status: "skipped", reason: "no team prefix" };

  const member = parsed.code ? mems.find((m) => m.code === parsed.code) : undefined;
  const target = member ? await findPaymentTarget(member.id, Math.round(t.amount)) : null;
  const inserted = await db
    .insert(transactions)
    .values({
      externalId: t.externalId,
      amount: Math.round(t.amount),
      content: t.content.slice(0, 500),
      occurredAt: t.occurredAt,
      memberId: member?.id ?? null,
      matchId: target?.matchId ?? null,
      status: member ? "matched" : "pending",
      source: "webhook",
    })
    .onConflictDoNothing({ target: transactions.externalId })
    .returning({ id: transactions.id });

  if (inserted.length === 0) return { status: "duplicate" };
  if (member) await applyDeclare(member.id, target);
  return member ? { status: "matched", code: member.code } : { status: "pending" };
}
