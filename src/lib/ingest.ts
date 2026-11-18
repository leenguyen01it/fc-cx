import "server-only";
import { db, members, transactions } from "@/db";
import { applyDeclare, findPaymentTarget } from "./payments";
import { getSettings } from "./data";
import { matchSenderName, parseTransferContent, senderCandidates } from "./reconcile";

export interface IncomingTransfer {
  externalId: string;
  amount: number;
  content: string;
  occurredAt: Date;
}

export type IngestResult =
  | { status: "matched"; code: string; by?: "name" }
  | { status: "pending" }
  | { status: "skipped"; reason: string }
  | { status: "duplicate" };

/**
 * Ghi nhận một khoản tiền vào:
 *  - có mã đội + đúng mã thành viên → matched (tự trừ nợ)
 *  - có mã đội nhưng không rõ ai     → pending (admin chọn tên)
 *  - không có mã đội                 → pending nếu là tài khoản riêng của đội, ngược lại bỏ qua
 *  - không rõ mã nhưng nội dung có họ tên đúng 1 thành viên VÀ số tiền khớp đúng 1 khoản người đó
 *    đang nợ (VD chuyển cho người nhận đã lưu, ngân hàng tự ghi "NGUYEN VAN HUNG chuyen tien") → matched
 *  - chuyển qua nút của Zalo ("Hung Beo chuyen khoan nhanh qua Zalo") → so thêm tên Zalo, cùng điều kiện số tiền
 */
export async function ingestTransfer(t: IncomingTransfer): Promise<IngestResult> {
  if (!(t.amount > 0)) return { status: "skipped", reason: "not incoming" };
  const st = await getSettings();
  const mems = await db
    .select({ id: members.id, code: members.code, name: members.name, bankHolder: members.bankHolder, zaloName: members.zaloName })
    .from(members);
  const parsed = parseTransferContent(t.content, st.prefix, mems.map((m) => m.code));

  if (!parsed.hasPrefix && !st.dedicatedAccount) return { status: "skipped", reason: "no team prefix" };

  const amount = Math.round(t.amount);
  let member = parsed.code ? mems.find((m) => m.code === parsed.code) : undefined;
  let target = member ? await findPaymentTarget(member.id, amount) : null;
  let byName = false;
  if (!member) {
    // Theo tên chỉ khi số tiền khớp đúng một khoản đang nợ – tránh gán nhầm
    const id = matchSenderName(t.content, senderCandidates(t.content, mems));
    const named = id != null ? await findPaymentTarget(id, amount) : null;
    if (named) {
      member = mems.find((m) => m.id === id);
      target = named;
      byName = true;
    }
  }
  const inserted = await db
    .insert(transactions)
    .values({
      externalId: t.externalId,
      amount,
      content: t.content.slice(0, 500),
      note: byName ? `Nhận theo tên · ${t.content}`.slice(0, 200) : "",
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
  return member ? { status: "matched", code: member.code, ...(byName ? { by: "name" as const } : {}) } : { status: "pending" };
}
