"use client";

import { CircleCheck, CreditCard, LoaderCircle, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { declareTeam } from "@/app/actions";
import { formatK, formatTime } from "@/lib/text";
import { PayDialog, type BankInfo } from "../pay-dialog";
import { Avatar, Badge, btn, Card, CardHeader, cx, Sheet, toast } from "../ui";

type Team = "A" | "B";

export interface PendingEntry {
  memberId: number;
  name: string;
  guest: boolean;
  ate: boolean;
  /** Tổng tiền nếu ở đội A / B */
  choices: Record<Team, number>;
  /** Hai đội cùng mức → đã tính tiền luôn */
  settled: number | null;
  paid: boolean;
  paidAt: string | null;
  remaining: number;
  /** Tổng còn nợ (gồm trận trước) */
  owe: number;
  content: string;
}

/** Người đá nhưng chưa chọn đội: tự chọn đội khi vào đóng tiền. */
export function PendingPayers({
  matchId,
  entries,
  labels,
  bank,
  teamName,
  admin,
}: {
  matchId: number;
  entries: PendingEntry[];
  /** VD { A: "Đội Nhất (thắng)", B: "Đội Bét (thua)" } */
  labels: Record<Team, string>;
  bank: BankInfo;
  teamName: string;
  admin: boolean;
}) {
  const router = useRouter();
  const [confirm, setConfirm] = useState<{ e: PendingEntry; team: Team } | null>(null);
  const [pending, start] = useTransition();

  if (!entries.length) return null;
  const waiting = entries.filter((e) => e.settled == null).length;

  return (
    <Card>
      <CardHeader
        icon={<Users />}
        title="Chưa chọn đội"
        right={waiting > 0 ? <Badge tone="due">{waiting} người</Badge> : undefined}
      />
      <ul className="divide-y divide-line">
        {entries.map((e) => (
          <li key={e.memberId} className="space-y-2 px-4 py-3">
            <div className="flex items-center gap-3">
              <Avatar name={e.name} id={e.memberId} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 font-semibold">
                  <span className="truncate">{e.name}</span>
                  {e.guest && <Badge tone="muted">Khách</Badge>}
                </p>
                <p className="text-xs text-muted">{e.ate ? "Đá · Ăn" : "Đá · Không ăn"}</p>
              </div>
              {e.settled != null &&
                (e.paid ? (
                  <Badge tone="paid">
                    <CircleCheck />
                    {e.paidAt ? formatTime(new Date(e.paidAt)) : "Đã trả"}
                  </Badge>
                ) : (
                  <PayDialog
                    name={e.name}
                    content={e.content}
                    amount={e.remaining}
                    bank={bank}
                    teamName={teamName}
                    cash={admin ? { memberId: e.memberId, matchId } : undefined}
                    trigger={
                      <>
                        <CreditCard className="size-4" />
                        {formatK(e.remaining)}
                      </>
                    }
                    triggerClassName="flex h-9 items-center gap-1.5 rounded-full bg-brand px-3.5 text-xs font-bold text-brand-ink shadow-sm shadow-brand/30 active:scale-95"
                  />
                ))}
            </div>
            {e.settled == null && (
              <div className="grid grid-cols-2 gap-2">
                {(["A", "B"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setConfirm({ e, team: t })}
                    className={cx(
                      "flex min-h-12 flex-col items-center justify-center rounded-2xl px-2 py-1.5 text-white active:scale-[0.97]",
                      t === "A" ? "bg-team-a" : "bg-team-b",
                    )}
                  >
                    <span className="text-xs font-semibold opacity-90">{labels[t]}</span>
                    <span className="tabular text-base font-extrabold">{formatK(e.choices[t])}</span>
                  </button>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>

      <Sheet
        open={!!confirm}
        onClose={() => !pending && setConfirm(null)}
        title={confirm ? `${confirm.e.name} – ${labels[confirm.team]}?` : ""}
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
                  const r = await declareTeam({ matchId, memberId: confirm.e.memberId, team: confirm.team });
                  if (r?.error) toast.error(r.error);
                  else {
                    toast.success(r?.message ?? "Đã chọn đội");
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
        {confirm && (
          <p className="tabular text-center text-3xl font-extrabold text-brand">{formatK(confirm.e.choices[confirm.team])}</p>
        )}
      </Sheet>
    </Card>
  );
}
