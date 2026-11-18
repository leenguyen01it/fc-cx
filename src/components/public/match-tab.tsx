import {
  BellRing,
  ChevronDown,
  CircleCheck,
  CreditCard,
  Gift,
  History,
  Landmark,
  Receipt,
  Send,
  StickyNote,
  Users,
  WalletCards,
  Utensils,
} from "lucide-react";
import Link from "next/link";
import type { MatchBundle, TeamState } from "@/lib/data";
import { netAmount, sponsorThanks, summarizeTotals, teamName, type Team } from "@/lib/split";
import { teamNamesOf } from "@/lib/data";
import { formatDate, formatDateTime, formatK, formatTime, formatVnd, memberPath } from "@/lib/text";
import { transferContent } from "@/lib/reconcile";
import { buildReminderText, buildSummaryText } from "@/lib/zalo";
import { RULE_ICONS, ruleDescription } from "@/lib/rule-ui";
import { MessagePreview } from "../message-preview";
import { PayDialog } from "../pay-dialog";
import { PendingPayers, type PendingEntry } from "./pending-payers";
import { MeCard, type MeDebt, type MeEntry } from "./me-card";
import { Avatar, Badge, btn, Card, CardHeader, cx } from "../ui";

const EAT_STYLE = { dot: "bg-brand", text: "text-brand", soft: "bg-brand-soft" };
const styleOf = (t: Team | null) => (t ? TEAM_STYLE[t] : EAT_STYLE);
const TEAM_STYLE: Record<Team, { dot: string; text: string; soft: string }> = {
  A: { dot: "bg-team-a", text: "text-team-a", soft: "bg-team-a-soft" },
  B: { dot: "bg-team-b", text: "text-team-b", soft: "bg-team-b-soft" },
};

export function MatchTab({
  state,
  bundle,
  logs,
  admin = false,
  siteUrl,
}: {
  admin?: boolean;
  /** URL gốc của trang, để in link vào tin nhắn Zalo. */
  siteUrl: string;
  state: TeamState;
  bundle: MatchBundle;
  logs: { at: Date; detail: string }[];
}) {
  const { match, split } = bundle;
  const st = state.settings;
  const name = (id: number) => state.memberById.get(id)?.name ?? "?";
  const tn = teamNamesOf(st);

  // Người chưa chọn đội tách riêng; họ chỉ vào sổ khi số tiền đã rõ
  const rows = split.players
    .filter((p) => !p.pending)
    .map((p) => {
      const c = state.chargeOf(match.id, p.memberId);
      return { p, c, paid: !c || c.status === "paid" };
    });
  const pendingPlayers = split.players.filter((p) => p.pending);
  const pendingSettled = pendingPlayers
    .map((p) => ({ p, c: state.chargeOf(match.id, p.memberId) }))
    .filter((x) => x.c);
  // Tổng phải thu cố định ngay khi công bố (số người mỗi đội đã biết), kể cả khi còn người chưa chọn đội
  const totalDue = split.items.reduce(
    (s, b) => s + b.sponsorDue + b.groups.reduce((t, g) => t + g.perPerson * g.count, 0),
    0,
  );
  const collected =
    rows.reduce((s, r) => s + (r.c?.paid ?? 0), 0) + pendingSettled.reduce((s, x) => s + x.c!.paid, 0);
  const paidCount = rows.filter((r) => r.paid).length + pendingSettled.filter((x) => x.c!.status === "paid").length;
  const outcomeOf = (t: Team) =>
    split.outcome === "draw" ? "hoà" : split.winner === t ? "thắng" : split.loser === t ? "thua" : "";
  const pendingEntries: PendingEntry[] = pendingPlayers.map((p) => {
    const m = state.memberById.get(p.memberId)!;
    const c = state.chargeOf(match.id, p.memberId);
    const owe = Math.max(0, -(state.ledgers.get(p.memberId)?.balance ?? 0));
    return {
      memberId: p.memberId,
      name: m.name,
      guest: m.guest,
      ate: p.ate,
      choices: p.choices ?? { A: p.total, B: p.total },
      settled: c ? c.amount : null,
      paid: c?.status === "paid",
      paidAt: c?.paidAt ? c.paidAt.toISOString() : null,
      remaining: c?.remaining ?? 0,
      owe,
      content: transferContent(st.prefix, m.code, st.transferSuffix),
    };
  });
  const pct = totalDue ? Math.min(100, Math.round((collected / totalDue) * 100)) : 0;

  const totals = summarizeTotals(split, tn);
  const thanks = sponsorThanks(split);
  const teamPlayers = (t: Team | null) => split.players.filter((p) => p.team === t);
  const eatOnly = split.players.filter((p) => !p.team && !p.pending);
  const teamOrder: Team[] = split.teamless ? ["A"] : split.loser ? [split.loser, split.winner!] : ["A", "B"];
  const groupName = (t: Team) => (split.teamless ? "Người đá" : teamName(t, tn));
  const bank = { bankBin: st.bankBin, bankName: st.bankName, accountNo: st.accountNo, accountName: st.accountName };

  const matchLink = `${siteUrl}/?tran=${match.id}`;
  const summaryText = buildSummaryText({
    teamName: st.teamName,
    date: match.date,
    venue: match.venue,
    scoreA: match.scoreA,
    scoreB: match.scoreB,
    split,
    names: new Map(split.players.map((p) => [p.memberId, name(p.memberId)])),
    teamNames: tn,
    link: matchLink,
  });
  const unpaid = [
    ...rows.filter((r) => !r.paid).map((r) => ({ name: name(r.p.memberId), remaining: r.c!.remaining })),
    ...pendingEntries.filter((e) => !e.paid).map((e) => ({ name: name(e.memberId), remaining: e.settled != null ? e.remaining : null })),
  ];
  const reminderText = buildReminderText(st.teamName, match.date, unpaid, matchLink);
  const net = split.totalCost - split.totalSponsored;

  // ---- Thẻ "Của bạn" ----
  const pendingLabels = {
    A: `${teamName("A", tn)}${outcomeOf("A") ? ` (${outcomeOf("A")})` : ""}`,
    B: `${teamName("B", tn)}${outcomeOf("B") ? ` (${outcomeOf("B")})` : ""}`,
  };
  const meMembers = state.members
    .filter((m) => m.active || split.players.some((p) => p.memberId === m.id))
    .map((m) => ({ id: m.id, name: m.name }));
  const meEntries: MeEntry[] = split.players.map((p) => {
    const c = state.chargeOf(match.id, p.memberId);
    const m = state.memberById.get(p.memberId)!;
    const role = p.pending
      ? "Chưa chọn đội"
      : p.team
        ? `${groupName(p.team)}${outcomeOf(p.team) ? ` · ${outcomeOf(p.team)}` : ""}`
        : "Chỉ ăn";
    const base = {
      memberId: p.memberId,
      role,
      breakdown: p.pending ? "" : p.lines.map((l) => `${formatK(l.amount)} ${l.name.toLowerCase()}`).join(" + "),
      content: transferContent(st.prefix, m.code, st.transferSuffix),
    };
    if (c)
      return {
        ...base,
        status: c.status === "paid" ? "paid" : c.status,
        amount: c.amount,
        remaining: c.remaining,
        paidAt: c.paidAt ? c.paidAt.toISOString() : null,
      };
    return { ...base, status: "pending", amount: 0, remaining: 0, paidAt: null, choices: p.choices };
  });
  const meDebts: Record<number, MeDebt[]> = {};
  for (const m of meMembers) {
    const list = (state.ledgers.get(m.id)?.charges ?? [])
      .filter((c) => c.status !== "paid" && c.matchId !== match.id)
      .map((c) => ({ matchId: c.matchId, label: `trận ${formatDate(c.date).short}`, amount: c.remaining }));
    if (list.length) meDebts[m.id] = list;
  }

  return (
    <div className="space-y-3">
      <MeCard
        matchId={match.id}
        members={meMembers}
        entries={meEntries}
        debts={meDebts}
        labels={pendingLabels}
        bank={bank}
        teamName={st.teamName}
        admin={admin}
      />

      {/* Tiến độ thu */}
      <Card className="relative p-4 shadow-lg shadow-black/5">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-muted">Đã thu</p>
            <p className="tabular text-[28px] leading-tight font-extrabold">
              {formatK(collected)}
              <span className="text-base font-semibold text-muted"> / {formatK(totalDue)}</span>
            </p>
          </div>
          <div className="text-right">
            <p className="tabular text-[28px] leading-tight font-extrabold text-brand">
              {paidCount}
              <span className="text-base font-semibold text-muted">/{rows.length + pendingPlayers.length}</span>
            </p>
            <p className="text-xs text-muted">người đã trả</p>
          </div>
        </div>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-card-2">
          <div
            className={cx("h-full rounded-full transition-all duration-700", pct === 100 ? "bg-paid" : "bg-brand")}
            style={{ width: `${pct}%` }}
          />
        </div>
        {pct === 100 && totalDue > 0 && (
          <p className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-paid">
            <CircleCheck className="size-4" /> Đã thu đủ, cảm ơn cả đội!
          </p>
        )}
        {split.outcome == null && !split.teamless && (
          <p className="mt-3 rounded-2xl bg-due-soft px-3 py-2 text-xs text-due">
            Chưa có tỷ số
          </p>
        )}
      </Card>


      <PendingPayers
        matchId={match.id}
        entries={pendingEntries}
        labels={pendingLabels}
        bank={bank}
        teamName={st.teamName}
        admin={admin}
      />

      {/* Trạng thái từng người */}
      {[...teamOrder, null].map((t) => {
        const teamRows = rows.filter((r) => r.p.team === t);
        if (teamRows.length === 0) return null;
        const full = t ? groupName(t) : "Chỉ ăn";
        const label = totals.find((x) => x.team === t)?.label ?? full;
        return (
          <Card key={t ?? "eat"}>
            <CardHeader
              icon={t ? <WalletCards /> : <Utensils />}
              title={label === full ? label : `${label} · ${full}`}
              right={
                <Badge tone={t === "A" ? "a" : t === "B" ? "b" : "brand"}>
                  {teamRows.filter((r) => r.paid).length}/{teamRows.length} đã trả
                </Badge>
              }
            />
            <ul className="divide-y divide-line">
              {teamRows
                .sort((a, b) => Number(a.paid) - Number(b.paid) || name(a.p.memberId).localeCompare(name(b.p.memberId)))
                .map(({ p, c, paid }) => {
                  const m = state.memberById.get(p.memberId)!;
                  const ledger = state.ledgers.get(p.memberId)!;
                  const owe = Math.max(0, -ledger.balance);
                  return (
                    <li key={p.memberId} className="flex min-h-16 items-center gap-3 px-4 py-2">
                      <Link href={memberPath(m.code)} className="flex min-w-0 flex-1 items-center gap-3 active:opacity-70">
                        <Avatar name={m.name} id={m.id} />
                        <span className="min-w-0">
                          <span className="flex items-center gap-1.5 font-semibold">
                            <span className="truncate">{m.name}</span>
                            {m.guest && <Badge tone="muted">Khách</Badge>}
                          </span>
                          <span className="tabular block text-xs text-muted">
                            {formatK(p.total)}
                            {!p.ate && " · không ăn"}
                            {c?.status === "partial" && ` · còn ${formatK(c.remaining)}`}
                          </span>
                        </span>
                      </Link>
                      {paid ? (
                        <Badge tone="paid">
                          <CircleCheck />
                          {c?.paidAt ? formatTime(c.paidAt) : "Đã trả"}
                        </Badge>
                      ) : (
                        <PayDialog
                          teamName={st.teamName}
                          cash={admin ? { memberId: m.id, matchId: match.id } : undefined}
                          name={m.name}
                          content={transferContent(st.prefix, m.code, st.transferSuffix)}
                          amount={c!.remaining}
                          bank={bank}
                          note={
                            owe > c!.remaining
                              ? `Còn ${formatK(owe - c!.remaining)} của trận khác – chuyển riêng từng trận.`
                              : undefined
                          }
                          trigger={
                            <>
                              <CreditCard className="size-4" />
                              {formatK(c!.remaining)}
                            </>
                          }
                          triggerClassName="flex h-9 items-center gap-1.5 rounded-full bg-brand px-3.5 text-xs font-bold text-brand-ink shadow-sm shadow-brand/30 active:scale-95"
                        />
                      )}
                    </li>
                  );
                })}
            </ul>
          </Card>
        );
      })}

      {/* Tổng kết trận */}
      <Card>
        <details className="group">
          <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <CardHeader icon={<Receipt />} title="Tổng kết trận" subtitle="Đội hình · chi phí · cách chia"
              right={<ChevronDown className="size-5 text-muted transition group-open:rotate-180" />}
            />
          </summary>
        <div className="space-y-4 px-4 pb-4">
          <div className="grid gap-2 sm:grid-cols-2">
            {teamOrder.map((t) => {
              const ps = teamPlayers(t);
              const role =
                split.outcome === "draw" ? "Hoà" : split.winner === t ? "Thắng" : split.loser === t ? "Thua" : "";
              return (
                <div key={t} className={cx("rounded-2xl p-3", TEAM_STYLE[t].soft)}>
                  <p className={cx("mb-1 flex items-center gap-1.5 text-sm font-bold", TEAM_STYLE[t].text)}>
                    <Users className="size-4" />
                    {groupName(t)}
                    {role && ` · ${role}`}
                    <span className="font-medium opacity-70">({ps.length})</span>
                  </p>
                  <p className="text-sm leading-relaxed">
                    {ps.map((p) => name(p.memberId)).join(", ") || <span className="text-muted">Chưa có ai</span>}
                  </p>
                </div>
              );
            })}
            {pendingPlayers.length > 0 && (
              <div className="rounded-2xl bg-due-soft p-3 sm:col-span-2">
                <p className="mb-1 flex items-center gap-1.5 text-sm font-bold text-due">
                  <Users className="size-4" />
                  Chưa chọn đội <span className="font-medium opacity-70">({pendingPlayers.length})</span>
                </p>
                <p className="text-sm leading-relaxed">{pendingPlayers.map((p) => name(p.memberId)).join(", ")}</p>
              </div>
            )}
            {eatOnly.length > 0 && (
              <div className={cx("rounded-2xl p-3 sm:col-span-2", EAT_STYLE.soft)}>
                <p className={cx("mb-1 flex items-center gap-1.5 text-sm font-bold", EAT_STYLE.text)}>
                  <Utensils className="size-4" />
                  Chỉ ăn <span className="font-medium opacity-70">({eatOnly.length})</span>
                </p>
                <p className="text-sm leading-relaxed">{eatOnly.map((p) => name(p.memberId)).join(", ")}</p>
              </div>
            )}
          </div>

          {thanks.length > 0 && (
            <div className="flex gap-3 rounded-2xl bg-brand-soft p-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand text-brand-ink">
                <Gift className="size-5" />
              </span>
              <div className="text-sm">
                <p className="font-bold text-brand">Cảm ơn nhà tài trợ</p>
                {thanks.map((t) => (
                  <p key={t.name} className="tabular">
                    <b>{t.name}</b> ủng hộ {formatK(t.amount)} ({t.items.join(", ").toLowerCase()})
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Chi phí */}
          <div>
            <p className="mb-2 text-xs font-bold tracking-wide text-muted uppercase">Chi phí</p>
            <ol className="space-y-2">
              {split.items.map((b) => {
                const Icon = b.item.eatersOnly ? Utensils : RULE_ICONS[b.item.rule];
                const sponsored = b.item.amount - netAmount(b.item);
                return (
                  <li key={b.item.id} className="rounded-2xl bg-card-2 p-3">
                    <div className="flex items-center gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-card text-brand">
                        <Icon className="size-[18px]" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="truncate font-semibold">{b.item.name}</span>
                          <span className="tabular font-bold">{formatVnd(b.item.amount)}</span>
                        </div>
                        <p className="text-xs text-muted">{ruleDescription(b.item)}</p>
                      </div>
                    </div>
                    {sponsored > 0 && (
                      <div className="tabular mt-2 space-y-0.5 border-t border-line pt-2 text-sm">
                        <p className="flex justify-between gap-2 text-brand">
                          <span className="flex items-center gap-1.5">
                            <Gift className="size-3.5" />
                            {b.item.sponsorName || "Ủng hộ"}
                            {b.item.sponsorMemberId != null && (
                              <span className="text-xs font-medium text-muted">
                                · {b.item.sponsorCash ? "tiền mặt" : "chuyển cùng tiền trận"}
                              </span>
                            )}
                          </span>
                          <span className="font-semibold">−{formatVnd(sponsored)}</span>
                        </p>
                        <p className="flex justify-between gap-2">
                          <span className="text-muted">Còn chia</span>
                          <span className="font-bold">{formatVnd(netAmount(b.item))}</span>
                        </p>
                      </div>
                    )}
                    {b.groups.length > 0 && (
                      <ul className="mt-2 space-y-0.5 border-t border-line pt-2 text-sm">
                        {b.groups.map((g) => (
                          <li key={g.label} className="flex justify-between gap-2">
                            <span className="text-muted">
                              {g.label} · {g.count} người
                            </span>
                            <span className="tabular font-semibold">{formatK(g.perPerson)}/người</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ol>
            <div className="tabular mt-3 space-y-1 px-1 text-sm">
              <p className="flex justify-between">
                <span className="text-muted">Tổng chi</span>
                <span className="font-semibold">{formatVnd(split.totalCost)}</span>
              </p>
              {split.totalSponsored > 0 && (
                <p className="flex justify-between text-brand">
                  <span>Được ủng hộ</span>
                  <span className="font-semibold">−{formatVnd(split.totalSponsored)}</span>
                </p>
              )}
              <p className="flex justify-between text-base">
                <span className="font-bold">Cả đội chia</span>
                <span className="font-extrabold">{formatVnd(net)}</span>
              </p>
              {split.totalCharged > net && (
                <p className="text-xs text-muted">Dư làm tròn: {formatK(split.totalCharged - net)}</p>
              )}
            </div>
          </div>

          {/* Mỗi người phải trả */}
          {totals.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-bold tracking-wide text-muted uppercase">Mỗi người phải trả</p>
              <div className="space-y-2">
                {totals.map((t) => (
                  <div key={t.team ?? "eat"} className="rounded-2xl border border-line p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 font-semibold">
                        <span className={cx("size-2.5 rounded-full", styleOf(t.team).dot)} />
                        {t.label}
                      </span>
                      <span className="tabular text-xl font-extrabold">{formatK(t.common)}</span>
                    </div>
                    {t.commonLines.length > 1 && (
                      <p className="tabular mt-0.5 text-xs text-muted">
                        {t.commonLines.map((l) => `${formatK(l.amount)} ${l.name.toLowerCase()}`).join(" + ")}
                      </p>
                    )}
                    {t.exceptions.map((e) => (
                      <p key={e.memberId} className="mt-1 flex justify-between text-sm">
                        <span className="text-muted">
                          {name(e.memberId)}
                          {e.reason && ` (${e.reason})`}
                        </span>
                        <span className="tabular font-semibold">{formatK(e.total)}</span>
                      </p>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {st.accountNo && (
            <div className="flex gap-3 rounded-2xl border border-line p-3 text-sm">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
                <Landmark className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="font-semibold">
                  {st.bankName} · <span className="font-mono">{st.accountNo}</span>
                </p>
                <p className="text-muted">{st.accountName}</p>
              </div>
            </div>
          )}

          {match.note && (
            <div className="flex gap-3 rounded-2xl border border-dashed border-line p-3 text-sm">
              <StickyNote className="size-5 shrink-0 text-muted" />
              <p className="whitespace-pre-line">{match.note}</p>
            </div>
          )}

          {logs.length > 0 && (
            <details className="group rounded-2xl bg-card-2 px-3 py-2 text-xs text-muted">
              <summary className="flex cursor-pointer list-none items-center gap-1.5 font-semibold">
                <History className="size-4" />
                Lịch sử chỉnh sửa ({logs.length})
              </summary>
              <ul className="mt-2 space-y-1">
                {logs.map((l, i) => (
                  <li key={i}>
                    <b>{formatDateTime(l.at)}</b>: {l.detail}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
        </details>
      </Card>

      <div className="grid grid-cols-2 gap-2 pt-1">
        <MessagePreview
          text={summaryText}
          title="Tổng kết trận"
          trigger={
            <>
              <Send /> Gửi Zalo
            </>
          }
          triggerClassName={btn.primary}
        />
        <MessagePreview
          text={reminderText}
          title="Nhắc nợ"
          trigger={
            <>
              <BellRing /> Nhắc nợ
            </>
          }
          triggerClassName={btn.ghost}
        />
      </div>
    </div>
  );
}
