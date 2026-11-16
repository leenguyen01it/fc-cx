import { CloudRain, Vote, CalendarDays, ChevronRight, CircleCheck, FilePen, Hourglass } from "lucide-react";
import Link from "next/link";
import { getAllMatches, getOpenMatches, getTeamState } from "@/lib/data";
import { formatDate, formatK, todayVN } from "@/lib/text";
import { CreateMatchButton } from "./create-match";
import { BallIcon, Badge, Card, CardHeader, Empty } from "@/components/ui";

export const dynamic = "force-dynamic";


export default async function AdminMatches() {
  const [all, state, open] = await Promise.all([getAllMatches(), getTeamState(), getOpenMatches()]);
  const goingOf = new Map(open.map((o) => [o.match.id, o.rsvps.filter((r) => r.going).length]));
  const byId = new Map(state.bundles.map((b) => [b.match.id, b]));

  return (
    <div className="space-y-3">
      <CreateMatchButton today={todayVN()} />

      <Card>
        <CardHeader icon={<CalendarDays />} title="Các trận" subtitle={`${all.length} trận`} />
        {all.length === 0 ? (
          <Empty icon={<BallIcon />} title="Chưa có trận nào" />
        ) : (
          <ul className="divide-y divide-line">
            {all.map((m) => {
              const d = formatDate(m.date);
              const b = byId.get(m.id);
              const unpaid = b
                ? b.split.players.filter((p) => state.chargeOf(m.id, p.memberId)?.status !== "paid").length
                : 0;
              return (
                <li key={m.id}>
                  <Link href={`/admin/tran/${m.id}`} className="flex min-h-[72px] items-center gap-3 px-4 py-2 active:bg-card-2">
                    <span className="flex size-12 shrink-0 flex-col items-center justify-center rounded-2xl bg-card-2 leading-none">
                      <span className="text-[10px] font-semibold text-muted">{d.weekday}</span>
                      <span className="mt-0.5 text-sm font-extrabold">{d.short}</span>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold">{m.cancelled ? "Đã huỷ" : m.scoreA != null ? `${state.settings.teamAName} ${m.scoreA} – ${m.scoreB} ${state.settings.teamBName}` : m.voting ? "Điểm danh" : "Chưa có tỷ số"}</p>
                      <p className="truncate text-xs text-muted">
                        {m.cancelled
                          ? m.cancelReason || "—"
                          : b
                            ? `${b.split.players.length} người · ${formatK(b.split.totalCost)}`
                            : m.voting
                              ? `${goingOf.get(m.id) ?? 0} người đăng ký đá`
                              : "Nháp"}
                      </p>
                    </div>
                    {m.cancelled ? (
                      <Badge tone="b">
                        <CloudRain /> Huỷ
                      </Badge>
                    ) : m.voting && !m.published ? (
                      <Badge tone="brand">
                        <Vote /> {goingOf.get(m.id) ?? 0} đá
                      </Badge>
                    ) : !m.published ? (
                      <Badge tone="muted">
                        <FilePen /> Nháp
                      </Badge>
                    ) : unpaid ? (
                      <Badge tone="due">
                        <Hourglass /> {unpaid}
                      </Badge>
                    ) : (
                      <Badge tone="paid">
                        <CircleCheck /> Đủ
                      </Badge>
                    )}
                    <ChevronRight className="size-4 shrink-0 text-muted" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
