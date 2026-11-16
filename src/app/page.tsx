import { ChartColumn, Clock, Handshake, MapPin, ShieldCheck, Trophy, Wallet } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { getMatchLogs, getOpenMatches, getTeamState, teamNamesOf } from "@/lib/data";
import { formatDate } from "@/lib/text";
import { isAdmin } from "@/lib/auth";
import { AutoRefresh } from "@/components/auto-refresh";
import { MatchPicker, type MatchOption } from "@/components/match-picker";
import { RsvpPanel } from "@/components/public/rsvp-panel";
import { MatchTab } from "@/components/public/match-tab";
import { DebtTab } from "@/components/public/debt-tab";
import { StatsTab } from "@/components/public/stats-tab";
import { BallIcon, Empty, cx } from "@/components/ui";

export const dynamic = "force-dynamic";

type Tab = "tran" | "no" | "thongke";

export default async function Home(props: PageProps<"/">) {
  const sp = await props.searchParams;
  const tab: Tab = sp.tab === "no" || sp.tab === "thongke" ? sp.tab : "tran";
  const ngay = typeof sp.ngay === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.ngay) ? sp.ngay : undefined;
  const tranId = typeof sp.tran === "string" ? Number(sp.tran) : NaN;

  const [state, open, admin] = await Promise.all([getTeamState(), getOpenMatches(), isAdmin()]);
  const tn = teamNamesOf(state.settings);

  // Danh sách trận trên link chung: đang điểm danh / đã huỷ / đã đá – mới nhất trước
  type Entry =
    | { kind: "open"; id: number; date: string; open: (typeof open)[number] }
    | {
        kind: "done";
        id: number;
        date: string;
        bundle: (typeof state.bundles)[number];
      };
  const entries: Entry[] = [
    ...open.map((o) => ({
      kind: "open" as const,
      id: o.match.id,
      date: o.match.date,
      open: o,
    })),
    ...state.bundles.map((b) => ({
      kind: "done" as const,
      id: b.match.id,
      date: b.match.date,
      bundle: b,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);

  // Mặc định: trận đang điểm danh (nếu có), không thì trận đã đá gần nhất
  const current =
    entries.find((e) => e.id === tranId) ??
    (ngay ? entries.find((e) => e.date === ngay) : undefined) ??
    entries.find((e) => e.kind === "open" && e.open.match.voting) ??
    entries.find((e) => e.kind === "done") ??
    entries[0];

  const bundle = current?.kind === "done" ? current.bundle : undefined;
  const openMatch = current?.kind === "open" ? current.open : undefined;
  const logs = bundle && tab === "tran" ? await getMatchLogs(bundle.match.id) : [];

  const options: MatchOption[] = entries.map((e) => {
    const d = formatDate(e.date);
    if (e.kind === "open")
      return {
        id: e.id,
        status: e.open.match.cancelled ? "cancelled" : "voting",
        going: e.open.rsvps.filter((r) => r.going).length,
        date: e.date,
        weekday: d.weekday,
        full: d.full,
        score: null,
        unpaid: 0,
      };
    const b = e.bundle;
    return {
      id: e.id,
      status: "done",
      going: 0,
      date: e.date,
      weekday: d.weekday,
      full: d.full,
      score: b.match.scoreA != null ? `${b.match.scoreA} – ${b.match.scoreB}` : null,
      unpaid: b.split.players.filter((p) => state.chargeOf(b.match.id, p.memberId)?.status !== "paid").length,
    };
  });

  const m = bundle?.match ?? openMatch?.match;
  const split = bundle?.split;

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col pb-28">
      <AutoRefresh />
      <header
        className={cx(
          "pitch relative isolate flex flex-col overflow-hidden px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-5 text-white sm:rounded-b-[32px]",
          tab === "tran" && "min-h-[21rem]",
        )}
      >
        <Image
          src="/team/hero.jpg"
          alt=""
          fill
          priority
          sizes="(max-width: 672px) 100vw, 672px"
          className="-z-20 object-cover object-[42%_55%]"
        />
        {/* Tối nhẹ ở trên (logo), trong ở giữa (thấy mặt cả đội), cam đậm ở dưới (tỷ số) */}
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black/50 via-black/0 via-45% to-brand" />
        <div className="flex items-center justify-between">
          <h1 className="flex items-center gap-2.5 text-lg font-extrabold tracking-tight">
            <span className="flex size-9 items-center justify-center rounded-2xl bg-white text-brand shadow-lg shadow-black/10">
              <BallIcon className="size-5" />
            </span>
            {state.settings.teamName}
          </h1>
          <Link
            href="/admin"
            className="flex h-9 items-center gap-1.5 rounded-full bg-white/15 px-3.5 text-xs font-semibold backdrop-blur active:scale-95"
          >
            <ShieldCheck className="size-4" />
            Admin
          </Link>
        </div>

        {tab === "tran" && m && <div className="min-h-24 flex-1" />}
        {tab === "tran" && openMatch && (
          <div className="text-center">
            <p className="text-3xl font-black tracking-tight">{openMatch.match.cancelled ? "Đã huỷ" : "Điểm danh"}</p>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs font-medium">
              {openMatch.match.timeRange && (
                <span className="flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1">
                  <Clock className="size-3.5" />
                  {openMatch.match.timeRange}
                </span>
              )}
              {openMatch.match.venue && (
                <span className="flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1">
                  <MapPin className="size-3.5" />
                  {openMatch.match.venue}
                </span>
              )}
            </div>
          </div>
        )}
        {tab === "tran" && bundle && m && split && (
          <>
            {split.teamless ? (
              <p className="text-center text-3xl font-black tracking-tight">Đá đối</p>
            ) : (
              <div className="flex items-center justify-center gap-5">
                <TeamScore team="A" name={tn.A} winner={split.winner} />
                <div className="tabular flex items-center text-6xl font-black tracking-tight drop-shadow-sm">
                  {m.scoreA ?? "–"}
                  <span className="mx-2.5 text-4xl opacity-50">:</span>
                  {m.scoreB ?? "–"}
                </div>
                <TeamScore team="B" name={tn.B} winner={split.winner} />
              </div>
            )}
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs font-medium">
              {split.outcome === "draw" && (
                <span className="flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1">
                  <Handshake className="size-3.5" /> Hoà
                </span>
              )}
              {!split.outcome && !split.teamless && (
                <span className="rounded-full bg-white/20 px-2.5 py-1">Chưa có kết quả</span>
              )}
              {m.venue && (
                <span className="flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1">
                  <MapPin className="size-3.5" />
                  {m.venue}
                  {m.timeRange && ` · ${m.timeRange}`}
                </span>
              )}
            </div>
          </>
        )}
        {tab !== "tran" && (
          <div className="mt-5 flex items-center gap-3">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-white/20">
              {tab === "no" ? <Wallet className="size-6" /> : <ChartColumn className="size-6" />}
            </span>
            <div>
              <p className="text-2xl font-extrabold">{tab === "no" ? "Đóng tiền" : "Thống kê"}</p>
              {tab === "thongke" && <p className="text-sm text-white/80">{state.bundles.length} trận</p>}
            </div>
          </div>
        )}
      </header>

      <main className="flex-1 space-y-3 px-4 pt-4">
        {tab === "tran" && m && <MatchPicker options={options} current={m.id} teamNames={tn} />}
        {tab === "tran" &&
          (bundle ? (
            <MatchTab state={state} bundle={bundle} logs={logs} admin={admin} />
          ) : openMatch ? (
            <RsvpPanel
              matchId={openMatch.match.id}
              members={state.members.filter((x) => x.active).map((x) => ({ id: x.id, name: x.name }))}
              rsvps={openMatch.rsvps.map((r) => ({
                memberId: r.memberId,
                going: r.going,
                eat: r.eat,
                team: r.team,
              }))}
              open={openMatch.match.voting && !openMatch.match.cancelled}
              cancelled={openMatch.match.cancelled}
              cancelReason={openMatch.match.cancelReason}
            />
          ) : (
            <div className="rounded-3xl border border-line bg-card">
              <Empty icon={<BallIcon />} title="Chưa có trận nào" />
            </div>
          ))}
        {tab === "no" && <DebtTab state={state} />}
        {tab === "thongke" && <StatsTab state={state} />}
      </main>

      <BottomNav tab={tab} tran={current?.id} />
    </div>
  );
}

function TeamScore({ team, name, winner }: { team: "A" | "B"; name: string; winner: "A" | "B" | null }) {
  return (
    <div className="flex w-16 flex-col items-center">
      <span className="relative">
        <span
          className={cx(
            "flex size-14 items-center justify-center rounded-[20px] px-1 text-center text-sm leading-tight font-black shadow-lg ring-2 ring-white/50",
            team === "A" ? "bg-team-a" : "bg-team-b",
          )}
        >
          {name}
        </span>
        {winner === team && (
          <span className="absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full bg-amber-400 text-amber-950 shadow ring-2 ring-white">
            <Trophy className="size-3.5" />
          </span>
        )}
      </span>
    </div>
  );
}

function BottomNav({ tab, tran }: { tab: Tab; tran?: number }) {
  const items = [
    {
      key: "tran" as const,
      Icon: BallIcon,
      label: "Trận",
      href: tran ? `/?tran=${tran}` : "/",
    },
    { key: "no" as const, Icon: Wallet, label: "Đóng tiền", href: "/?tab=no" },
    {
      key: "thongke" as const,
      Icon: ChartColumn,
      label: "Thống kê",
      href: "/?tab=thongke",
    },
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-card/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
      <div className="mx-auto grid max-w-2xl grid-cols-3 px-2">
        {items.map(({ key, Icon, label, href }) => {
          const on = tab === key;
          return (
            <Link
              key={key}
              href={href}
              aria-current={on ? "page" : undefined}
              className={cx(
                "flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold transition",
                on ? "text-brand" : "text-muted",
              )}
            >
              <span
                className={cx(
                  "flex h-8 w-14 items-center justify-center rounded-full transition",
                  on && "bg-brand-soft",
                )}
              >
                <Icon className="size-[22px]" />
              </span>
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
