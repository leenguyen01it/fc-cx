import { desc } from "drizzle-orm";
import { CreditCard, HandCoins, Inbox, PenLine, StickyNote, UserRound } from "lucide-react";
import { db, transactions } from "@/db";
import { getMembers, getTeamState } from "@/lib/data";
import { formatDate } from "@/lib/text";
import { addManualPayment } from "../../actions";
import { ActionForm } from "@/components/action-form";
import { Card, CardHeader, Empty, Field, MoneyInput, Select, TextInput, initials, btn, cx } from "@/components/ui";
import { PendingItem, type MemberOption } from "./tx-items";
import { TxHistory } from "./tx-history";
import { SheetButton } from "@/components/sheet-button";

export const dynamic = "force-dynamic";

export default async function TransactionsPage() {
  const [txs, members, state] = await Promise.all([
    db.select().from(transactions).orderBy(desc(transactions.occurredAt)).limit(300),
    getMembers(),
    getTeamState(),
  ]);
  const name = new Map(members.map((m) => [m.id, m.name]));
  const matchDate = new Map(state.bundles.map((b) => [b.match.id, b.match.date]));
  const pending = txs.filter((t) => t.status === "pending");
  const done = txs.filter((t) => t.status !== "pending");

  const memberOptions: MemberOption[] = members
    .filter((m) => m.active || m.guest)
    .map((m) => {
      const bal = state.ledgers.get(m.id)?.balance ?? 0;
      return {
        value: String(m.id),
        label: m.name,
        description: `${m.guest ? "Khách · " : ""}Mã ${m.code}${bal < 0 ? ` · đang nợ ${new Intl.NumberFormat("vi-VN").format(-bal)}đ` : ""}`,
        keywords: m.code,
        initials: initials(m.name),
      };
    });
  // Select cần icon là ReactNode → tạo ở server cho form ghi tay
  const selectOptions = memberOptions.map((o) => ({
    ...o,
    icon: <span className="text-xs font-bold">{o.initials}</span>,
  }));

  return (
    <div className="space-y-3">
      {pending.length > 0 && (
      <Card>
        <CardHeader icon={<Inbox />} title="Chờ xác nhận" subtitle={`${pending.length} giao dịch`} />
        {(
          <ul className="space-y-2 px-3 pb-3">
            {pending.map((t) => (
              <PendingItem
                key={t.id}
                tx={{ id: t.id, amount: t.amount, content: t.content, occurredAt: t.occurredAt.toISOString() }}
                members={memberOptions}
              />
            ))}
          </ul>
        )}
      </Card>
      )}

      <SheetButton label="Ghi tay (tiền mặt…)" icon={<HandCoins />} title="Ghi tay" className={cx(btn.ghost, "w-full")}>
        <ActionForm
          action={addManualPayment}
          schema="manualPayment"
          submit="Ghi nhận"
          submitIcon={<PenLine />}
          resetOnSuccess
          className="space-y-4"
          submitClassName="w-full"
        >
          <Field label="Thành viên" name="memberId">
            <Select name="memberId" title="Ai trả tiền?" placeholder="Chọn thành viên" icon={<UserRound />} searchable options={selectOptions} />
          </Field>
          <Field label="Số tiền" name="amount">
            <MoneyInput name="amount" quick={[100_000, 150_000, 200_000, 300_000, 500_000]} />
          </Field>
          <Field label="Ghi chú" name="note" optional>
            <TextInput name="note" placeholder="VD: Đưa tiền mặt ở sân" maxLength={200} icon={<StickyNote />} />
          </Field>
        </ActionForm>
      </SheetButton>

      {done.length === 0 ? (
        <Card>
          <Empty icon={<CreditCard />} title="Chưa có giao dịch" />
        </Card>
      ) : (
        <TxHistory
          txs={done.map((t) => ({
                  id: t.id,
                  amount: t.amount,
                  status: t.status,
                  source: t.source,
                  label: t.note || t.content,
                  occurredAt: t.occurredAt.toISOString(),
                  memberName: t.memberId ? (name.get(t.memberId) ?? "—") : "—",
                  matchLabel: t.matchId && matchDate.get(t.matchId) ? `Trận ${formatDate(matchDate.get(t.matchId)!).short}` : null,
          }))}
        />
      )}
    </div>
  );
}
