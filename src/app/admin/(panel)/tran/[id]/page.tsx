import Link from "next/link";
import { notFound } from "next/navigation";
import { getMatchBundle, getMembers, getRsvps, getSettings, teamNamesOf } from "@/lib/data";
import { formatDate } from "@/lib/text";
import { siteUrl } from "@/lib/site";
import { MatchEditor } from "./match-editor";

export const dynamic = "force-dynamic";

export default async function EditMatchPage(props: PageProps<"/admin/tran/[id]">) {
  const { id } = await props.params;
  const matchId = Number(id);
  if (!Number.isInteger(matchId)) notFound();
  const [bundle, members, st, rsvps, base] = await Promise.all([
    getMatchBundle(matchId),
    getMembers(),
    getSettings(),
    getRsvps(matchId),
    siteUrl(),
  ]);
  if (!bundle) notFound();
  const { match, players, items } = bundle;
  const d = formatDate(match.date);

  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <Link href="/admin" className="text-sm font-semibold text-muted">
          ‹ Danh sách trận
        </Link>
        <p className="font-extrabold">
          {d.weekday} {d.full}
        </p>
        {match.published || match.voting || match.cancelled ? (
          <Link href={`/?tran=${match.id}`} className="text-sm font-semibold text-brand">
            Xem ›
          </Link>
        ) : (
          <span className="w-12" />
        )}
      </div>
      <MatchEditor
        id={match.id}
        teamNames={teamNamesOf(st)}
        siteUrl={base}
        rsvps={rsvps.map((r) => ({ memberId: r.memberId, going: r.going, eat: r.eat, team: r.team }))}
        cancelled={match.cancelled}
        cancelReason={match.cancelReason}
        members={members.map((m) => ({ id: m.id, name: m.name, code: m.code, active: m.active, guest: m.guest }))}
        initial={{
          date: match.date,
          venue: match.venue,
          timeRange: match.timeRange,
          scoreA: match.scoreA,
          scoreB: match.scoreB,
          note: match.note,
          published: match.published,
          voting: match.voting,
          players: players.map((p) => ({ memberId: p.memberId, team: p.team, ate: p.ate, pending: p.pending })),
          sizeA: match.sizeA,
          sizeB: match.sizeB,
          items: items.map((i) => ({
            name: i.name,
            amount: i.amount,
            rule: i.rule,
            loserPct: i.loserPct,
            bearer: i.bearer,
            includeNonEaters: i.includeNonEaters,
            drawMode: i.drawMode,
            eatersOnly: i.eatersOnly,
            sponsorAmount: i.sponsorAmount,
            sponsorName: i.sponsorName,
          })),
        }}
      />
    </>
  );
}
