"use client";

import { ChevronRight, CircleCheck, CreditCard, LoaderCircle, UserRound, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { declareTeam } from "@/app/actions";
import { formatK, formatTime } from "@/lib/text";
import { PayDialog, type BankInfo } from "../pay-dialog";
import { setMe, useMe } from "../use-me";
import { Avatar, btn, Card, cx, Select, Sheet, toast } from "../ui";

type Team = "A" | "B";

export interface MeEntry {
  memberId: number;
  status: "paid" | "unpaid" | "partial" | "pending";
  /** Số tiền trận này (đã rõ) */
  amount: number;
  remaining: number;
  paidAt: string | null;
  /** Chưa chọn đội (2 đội khác mức) */
  choices?: Record<Team, number>;
  /** "Đội Bét · Thua", "Chỉ ăn"… */
  role: string;
  /** "43k sân + 70k ăn" */
  breakdown: string;
  content: string;
}

export interface MeDebt {
  matchId: number;
  label: string;
  amount: number;
}

/** Thẻ "Của bạn": mở link là thấy ngay mình cần chuyển bao nhiêu. */
export function MeCard({
  matchId,
  members,
  entries,
  debts,
  labels,
  bank,
  teamName,
  admin,
}: {
  matchId: number;
  members: { id: number; name: string }[];
  entries: MeEntry[];
  /** Nợ các trận khác theo người */
  debts: Record<number, MeDebt[]>;
  labels: Record<Team, string>;
  bank: BankInfo;
  teamName: string;
  admin: boolean;
}) {
  const me = useMe();
  const router = useRouter();
  const [picking, setPicking] = useState(false);
  const [confirm, setConfirm] = useState<Team | null>(null);
  const [pending, start] = useTransition();
  const member = members.find((m) => m.id === me);
  const e = entries.find((x) => x.memberId === me);
  const other = (me && debts[me]) || [];

  const picker = (
    <Select
      value={me ? String(me) : ""}
      onChange={(v) => {
        setMe(Number(v));
        setPicking(false);
      }}
      title="Bạn là ai?"
      placeholder="Chọn tên của bạn"
      icon={<UserRound />}
      searchable
      options={members.map((m) => ({ value: String(m.id), label: m.name }))}
    />
  );

  // Chưa chọn tên
  if (!member || picking)
    return (
      <Card className="space-y-3 p-4 shadow-lg shadow-black/5">
        <p className="font-bold">Bạn là ai?</p>
        {picker}
      </Card>
    );

  return (
    <Card className="overflow-hidden shadow-lg shadow-black/5">
      <div className="flex items-center gap-3 px-4 pt-4">
        <Avatar name={member.name} id={member.id} />
        <p className="min-w-0 flex-1 truncate font-bold">{member.name}</p>
        <button type="button" onClick={() => setPicking(true)} className="h-8 rounded-full bg-card-2 px-3 text-xs font-semibold text-muted">
          Đổi
        </button>
      </div>

      <div className="px-4 pt-3 pb-4">
        {!e && <p className="text-sm text-muted">Bạn không có trong trận này</p>}

        {e?.status === "paid" && (
          <div className="flex items-center gap-3 rounded-2xl bg-paid-soft p-3 text-paid">
            <CircleCheck className="size-8 shrink-0" />
            <div>
              <p className="tabular text-xl font-extrabold">Đã trả {formatK(e.amount)}</p>
              <p className="text-xs font-medium opacity-80">
                {e.role}
                {e.paidAt && ` · ${formatTime(new Date(e.paidAt))}`}
              </p>
            </div>
          </div>
        )}

        {(e?.status === "unpaid" || e?.status === "partial") && (
          <>
            <p className="text-xs font-semibold text-muted">{e.role}</p>
            <p className="tabular text-4xl font-black tracking-tight text-brand">{formatK(e.remaining)}</p>
            {e.breakdown && <p className="tabular mt-0.5 text-xs text-muted">{e.breakdown}</p>}
            <PayDialog
              name={member.name}
              content={e.content}
              amount={e.remaining}
              bank={bank}
              teamName={teamName}
              cash={admin ? { memberId: member.id, matchId } : undefined}
              trigger={
                <>
                  <CreditCard /> Chuyển {formatK(e.remaining)}
                </>
              }
              triggerClassName={cx(btn.primary, "mt-3 w-full")}
            />
          </>
        )}

        {e?.status === "pending" && e.choices && (
          <>
            <p className="mb-2 text-sm font-semibold">Bạn ở đội nào?</p>
            <div className="grid grid-cols-2 gap-2">
              {(["A", "B"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setConfirm(t)}
                  className={cx(
                    "flex min-h-16 flex-col items-center justify-center rounded-2xl px-2 py-2 text-white active:scale-[0.97]",
                    t === "A" ? "bg-team-a" : "bg-team-b",
                  )}
                >
                  <span className="text-xs font-semibold opacity-90">{labels[t]}</span>
                  <span className="tabular text-xl font-extrabold">{formatK(e.choices![t])}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {other.length > 0 && (
          <ul className="mt-3 space-y-1.5 border-t border-line pt-3">
            {other.map((d) => (
              <li key={d.matchId}>
                <Link
                  href={`/?tran=${d.matchId}`}
                  className="flex items-center justify-between gap-2 rounded-xl bg-due-soft px-3 py-2 text-sm font-semibold text-due active:opacity-80"
                >
                  <span>Còn nợ {d.label}</span>
                  <span className="tabular flex items-center gap-1">
                    {formatK(d.amount)} <ChevronRight className="size-4" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Sheet
        open={!!confirm}
        onClose={() => !pending && setConfirm(null)}
        title={confirm ? labels[confirm] : ""}
        icon={<Users />}
        footer={
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className={btn.ghost} disabled={pending} onClick={() => setConfirm(null)}>
              Huỷ
            </button>
            <button
              type="button"
              className={btn.primary}
              disabled={pending}
              onClick={() =>
                confirm &&
                start(async () => {
                  const r = await declareTeam({ matchId, memberId: member.id, team: confirm });
                  if (r?.error) toast.error(r.error);
                  else {
                    setConfirm(null);
                    router.refresh();
                  }
                })
              }
            >
              {pending && <LoaderCircle className="animate-spin" />}
              Xác nhận
            </button>
          </div>
        }
      >
        {confirm && e?.choices && (
          <p className="tabular text-center text-3xl font-extrabold text-brand">{formatK(e.choices[confirm])}</p>
        )}
      </Sheet>
    </Card>
  );
}
