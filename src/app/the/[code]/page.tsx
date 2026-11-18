import Link from "next/link";
import { notFound } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { getTeamState, teamNamesOf } from "@/lib/data";
import { teamName } from "@/lib/split";
import { buildVietQr } from "@/lib/vietqr";
import { transferContent } from "@/lib/reconcile";
import { formatDate, formatK, formatTime, codeFromPath } from "@/lib/text";
import { QrCard } from "@/components/qr-card";
import { PayDialog } from "@/components/pay-dialog";
import { ChevronLeft, CircleCheck, CreditCard, Hourglass, Receipt, Wallet } from "lucide-react";
import { Avatar, Badge, Card, CardHeader, cx } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function MemberPage(props: PageProps<"/the/[code]">) {
  const { code } = await props.params;
  const [state, admin] = await Promise.all([getTeamState(), isAdmin()]);
  const m = state.members.find((x) => x.code === codeFromPath(code));
  if (!m) notFound();

  const st = state.settings;
  const content = transferContent(st.prefix, m.code, st.transferSuffix);
  const ledger = state.ledgers.get(m.id)!;
  // Trận đã công bố mà người này chưa chọn đội (2 đội khác mức → chưa có số tiền)
  const pendingMatches = state.bundles.filter((b) =>
    b.split.players.some((p) => p.memberId === m.id && p.pending && !state.chargeOf(b.match.id, m.id)),
  );
  const bundleById = new Map(state.bundles.map((b) => [b.match.id, b]));
  const history = [...ledger.charges].reverse();
  const staticPayload =
    st.bankBin && st.accountNo ? buildVietQr({ bankBin: st.bankBin, accountNo: st.accountNo, content }) : null;

  return (
    <div className="mx-auto min-h-dvh max-w-md px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-10">
      <div className="mb-4 flex items-center justify-between">
        <Link href="/" className="flex h-10 items-center gap-1 rounded-full border border-line bg-card pr-4 pl-2.5 text-sm font-semibold active:scale-95">
          <ChevronLeft className="size-5" /> Trang đội
        </Link>
        <Link href="/?tab=no" className="flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-muted">
          <Wallet className="size-4" /> Đóng tiền
        </Link>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <Avatar name={m.name} id={m.id} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xl font-extrabold">{m.name}</p>
          <p className="text-sm text-muted">
            Mã: <b className="font-mono">{m.code}</b> · {ledger.charges.length} trận
          </p>
        </div>
      </div>

      <Card className="mb-4 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-muted">
              {ledger.balance < 0 ? "Chưa đóng" : ledger.balance > 0 ? "Trả dư" : "Đóng tiền"}
            </p>
            <p
              className={cx(
                "tabular text-3xl font-extrabold",
                ledger.balance < 0 ? "text-due" : ledger.balance > 0 ? "text-paid" : "",
              )}
            >
              {ledger.balance === 0 ? "Đã đủ" : formatK(Math.abs(ledger.balance))}
            </p>
          </div>
        </div>
        <p className="tabular mt-2 text-xs text-muted">
          Tổng phải trả {formatK(ledger.totalCharged)} · đã trả {formatK(ledger.totalPaid)}
        </p>
      </Card>

      {m.id !== st.treasurerId && <QrCard
        teamName={st.teamName}
        name={m.name}
        content={content}
        payload={staticPayload}
        bankBin={st.bankBin}
        bankName={st.bankName}
        accountNo={st.accountNo}
        accountName={st.accountName}
      />}

      {pendingMatches.length > 0 && (
        <Card className="mt-4">
          <CardHeader icon={<Hourglass />} title="Chưa chọn đội" />
          <ul className="divide-y divide-line">
            {pendingMatches.map((b) => {
              const d = formatDate(b.match.date);
              return (
                <li key={b.match.id}>
                  <Link href={`/?tran=${b.match.id}`} className="flex min-h-14 items-center justify-between gap-2 px-4 py-3 active:bg-card-2">
                    <span className="font-semibold">
                      {d.weekday} {d.full}
                    </span>
                    <Badge tone="due">Chọn đội để trả ›</Badge>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <Card className="mt-4">
        <CardHeader icon={<Receipt />} title="Lịch sử các trận" />
        {history.length === 0 ? (
          <p className="px-4 pb-4 text-sm text-muted">Chưa tham gia trận nào.</p>
        ) : (
          <ul className="divide-y divide-line">
            {history.map((c) => {
              const b = bundleById.get(c.matchId)!;
              const p = b.split.players.find((x) => x.memberId === m.id)!;
              const d = formatDate(b.match.date);
              const result =
                !p.team ? "" : b.split.outcome === "draw" ? "Hoà" : b.split.winner === p.team ? "Thắng" : b.split.loser ? "Thua" : "";
              return (
                <li key={c.matchId} className="flex items-center gap-2 pr-4">
                  <Link href={`/?tran=${b.match.id}`} className="block min-h-16 min-w-0 flex-1 px-4 py-3 active:bg-card-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">
                        {d.weekday} {d.full}
                        <span className="ml-2 text-xs font-medium text-muted">
                          {p.team ? (b.split.teamless ? "Đá" : teamName(p.team, teamNamesOf(st))) : p.pending ? "Chưa chọn đội" : "Chỉ ăn"}
                          {result && ` · ${result}`}
                        </span>
                      </span>
                      {c.status === "paid" && (
                        <Badge tone="paid">
                          <CircleCheck />
                          {c.paidAt ? formatTime(c.paidAt) : "Đủ"}
                        </Badge>
                      )}
                    </div>
                    <p className="tabular mt-0.5 text-xs text-muted">
                      {p.lines.map((l) => `${l.name} ${formatK(l.amount)}`).join(" + ")} ={" "}
                      <b className="text-ink">{formatK(c.amount)}</b>
                    </p>
                  </Link>
                  {c.status !== "paid" && (
                    <PayDialog
                      teamName={st.teamName}
                      cash={admin ? { memberId: m.id, matchId: c.matchId } : undefined}
                      name={m.name}
                      content={content}
                      amount={c.remaining}
                      bank={st}
                      trigger={
                        <>
                          <CreditCard className="size-4" />
                          {formatK(c.remaining)}
                        </>
                      }
                      triggerClassName="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-brand px-3.5 text-xs font-bold text-brand-ink shadow-sm shadow-brand/30 active:scale-95"
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
