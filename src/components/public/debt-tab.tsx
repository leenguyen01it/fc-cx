import Link from "next/link";
import type { TeamState } from "@/lib/data";
import type { Member } from "@/db/schema";
import type { MemberLedger } from "@/lib/ledger";
import { formatK, memberPath } from "@/lib/text";
import { ChevronRight, CircleCheck, Hourglass, PiggyBank, Users } from "lucide-react";
import { Avatar, Badge, Card, CardHeader, Empty } from "../ui";

type Row = { m: Member; l: MemberLedger };

function List({ items, tone }: { items: Row[]; tone: "due" | "paid" | "muted" }) {
  return (
    <ul className="divide-y divide-line">
      {items.map(({ m, l }) => {
        const unpaid = l.charges.filter((c) => c.status !== "paid").length;
        return (
          <li key={m.id}>
            <Link href={memberPath(m.code)} className="flex min-h-16 items-center gap-3 px-4 py-2 active:bg-card-2">
              <Avatar name={m.name} id={m.id} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 font-semibold">
                  <span className="truncate">{m.name}</span>
                  {m.guest && <Badge tone="muted">Khách</Badge>}
                </span>
                <span className="block text-xs text-muted">
                  {tone === "due" ? `${unpaid} trận chưa đủ` : `Đã trả ${formatK(l.totalPaid)}`}
                </span>
              </span>
              {tone === "due" && <Badge tone="due">Còn {formatK(-l.balance)}</Badge>}
              {tone === "paid" && <Badge tone="paid">Dư {formatK(l.balance)}</Badge>}
              {tone === "muted" && (
                <Badge tone="muted">
                  <CircleCheck /> Đủ
                </Badge>
              )}
              <ChevronRight className="size-4 text-muted" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

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
      {owing.length > 0 && (
        <Card>
          <CardHeader icon={<Hourglass />} title="Chưa đóng" />
          <List items={owing} tone="due" />
        </Card>
      )}
      {credit.length > 0 && (
        <Card>
          <CardHeader icon={<PiggyBank />} title="Trả dư" />
          <List items={credit} tone="paid" />
        </Card>
      )}
      {clear.length > 0 && (
        <Card>
          <CardHeader icon={<CircleCheck />} title="Đã đủ" />
          <List items={clear} tone="muted" />
        </Card>
      )}
    </div>
  );
}
