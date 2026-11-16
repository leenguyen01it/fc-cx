import Link from "next/link";
import type { TeamState } from "@/lib/data";
import { formatK, memberPath } from "@/lib/text";
import { ChartColumn, Drumstick, Flame, Trophy } from "lucide-react";
import type { ReactNode } from "react";
import { Avatar, Card, CardHeader, Empty } from "../ui";

export function StatsTab({ state }: { state: TeamState }) {
  const stats = new Map<number, { played: number; w: number; d: number; l: number; bets: number; betMoney: number; spent: number }>();
  const finished = state.bundles.filter((b) => b.split.outcome);
  for (const b of finished) {
    const betIds = new Set(b.items.filter((i) => i.rule === "bet").map((i) => i.id));
    for (const p of b.split.players) {
      if (!p.team) continue; // chỉ ăn – không tính thành tích
      const s = stats.get(p.memberId) ?? { played: 0, w: 0, d: 0, l: 0, bets: 0, betMoney: 0, spent: 0 };
      s.played++;
      if (b.split.outcome === "draw") s.d++;
      else if (b.split.winner === p.team) s.w++;
      else s.l++;
      const betLines = p.lines.filter((l) => betIds.has(l.itemId as number));
      if (betLines.length && b.split.outcome !== "draw") s.bets++;
      s.betMoney += betLines.reduce((x, l) => x + l.amount, 0);
      s.spent += p.total;
      stats.set(p.memberId, s);
    }
  }
  if (finished.length === 0)
    return (
      <Card>
        <Empty icon={<ChartColumn />} title="Chưa có trận nào có kết quả" />
      </Card>
    );

  const rows = [...stats.entries()]
    .map(([id, s]) => ({ m: state.memberById.get(id)!, s, rate: s.played ? s.w / s.played : 0 }))
    .filter((r) => r.m)
    .sort((a, b) => b.rate - a.rate || b.s.played - a.s.played);

  const topBet = [...rows].sort((a, b) => b.s.betMoney - a.s.betMoney)[0];
  const topRate = rows.filter((r) => r.s.played >= 3)[0];
  const topPlayed = [...rows].sort((a, b) => b.s.played - a.s.played)[0];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <Highlight icon={<Flame />} title="Chăm nhất" name={topPlayed?.m.name} value={`${topPlayed?.s.played ?? 0} trận`} />
        <Highlight
          icon={<Trophy />}
          title="Thắng nhiều"
          name={topRate?.m.name}
          value={topRate ? `${Math.round(topRate.rate * 100)}%` : "≥3 trận"}
        />
        <Highlight
          icon={<Drumstick />}
          title="Vua gánh kèo"
          name={topBet && topBet.s.betMoney > 0 ? topBet.m.name : undefined}
          value={topBet && topBet.s.betMoney > 0 ? formatK(topBet.s.betMoney) : "—"}
        />
      </div>
      <Card>
        <CardHeader icon={<ChartColumn />} title="Bảng thành tích" subtitle={`${finished.length} trận có kết quả`} />
        <div className="overflow-x-auto">
          <table className="tabular w-full text-sm">
            <thead className="text-xs text-muted">
              <tr className="border-b border-line">
                <th className="py-2 pl-4 text-left font-semibold">Cầu thủ</th>
                <th className="px-1 font-semibold">Trận</th>
                <th className="px-1 font-semibold">T-H-B</th>
                <th className="px-1 font-semibold">%</th>
                <th className="py-2 pr-4 text-right font-semibold">Gánh kèo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map(({ m, s, rate }) => (
                <tr key={m.id}>
                  <td className="py-2 pl-4">
                    <Link href={memberPath(m.code)} className="flex items-center gap-2">
                      <Avatar name={m.name} id={m.id} size="sm" />
                      <span className="truncate font-semibold">{m.name}</span>
                    </Link>
                  </td>
                  <td className="px-1 text-center">{s.played}</td>
                  <td className="px-1 text-center whitespace-nowrap">
                    <span className="text-paid">{s.w}</span>-<span className="text-muted">{s.d}</span>-
                    <span className="text-team-a">{s.l}</span>
                  </td>
                  <td className="px-1 text-center font-semibold">{Math.round(rate * 100)}</td>
                  <td className="py-2 pr-4 text-right">{s.betMoney ? formatK(s.betMoney) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Highlight({ icon, title, name, value }: { icon: ReactNode; title: string; name?: string; value: string }) {
  return (
    <Card className="p-3 text-center shadow-lg shadow-black/5">
      <span className="mx-auto flex size-10 items-center justify-center rounded-2xl bg-brand-soft text-brand [&>svg]:size-5">
        {icon}
      </span>
      <p className="mt-2 text-[11px] font-semibold text-muted">{title}</p>
      <p className="truncate text-sm font-bold">{name ?? "—"}</p>
      <p className="tabular text-xs text-muted">{value}</p>
    </Card>
  );
}
