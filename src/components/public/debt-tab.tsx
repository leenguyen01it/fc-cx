import type { TeamState } from "@/lib/data";
import { formatK } from "@/lib/text";
import { Users } from "lucide-react";
import { Card, Empty } from "../ui";
import { DebtList, type DebtRow } from "./debt-list";

export function DebtTab({ state }: { state: TeamState }) {
  const rows = state.members
    .map((m) => ({ m, l: state.ledgers.get(m.id)! }))
    .filter(({ m, l }) => m.active || l.balance !== 0);

  const owing = rows.filter((r) => r.l.balance < 0).sort((a, b) => a.l.balance - b.l.balance);
  const credit = rows.filter((r) => r.l.balance > 0).sort((a, b) => b.l.balance - a.l.balance);
  const clear = rows.filter((r) => r.l.balance === 0);
  const totalOwe = owing.reduce((s, r) => s - r.l.balance, 0);

  if (rows.length === 0) return (
      <Card>
        <Empty icon={<Users />} title="Chưa có thành viên" />
      </Card>
    );

  return (
    <div className="space-y-3">
      <Card className="grid grid-cols-2 divide-x divide-line shadow-lg shadow-black/5">
        <div className="p-4">
          <p className="text-xs font-semibold text-muted">Tổng chưa đóng</p>
          <p className="tabular text-2xl font-extrabold text-due">{formatK(totalOwe)}</p>
        </div>
        <div className="p-4">
          <p className="text-xs font-semibold text-muted">Người chưa đóng</p>
          <p className="tabular text-2xl font-extrabold">
            {owing.length}
            <span className="text-base font-semibold text-muted">/{rows.length}</span>
          </p>
        </div>
      </Card>
      <DebtList
        rows={[...owing, ...credit, ...clear].map(
          ({ m, l }): DebtRow => ({
            id: m.id,
            name: m.name,
            code: m.code,
            guest: m.guest,
            balance: l.balance,
            totalPaid: l.totalPaid,
            unpaid: l.charges.filter((c) => c.status !== "paid").length,
          }),
        )}
      />
    </div>
  );
}
