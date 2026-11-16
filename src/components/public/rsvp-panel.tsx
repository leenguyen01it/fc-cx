"use client";

import { Check, CloudRain, Search, UserRound, Users, Utensils, X } from "lucide-react";
import { startTransition, useMemo, useOptimistic, useState } from "react";
import { castRsvp } from "@/app/actions";
import { stripDiacritics } from "@/lib/text";
import { Avatar, Card, CardHeader, cx, Select, toast } from "../ui";
import { setMe, useMe } from "../use-me";

interface Vote {
  memberId: number;
  going: boolean;
  eat: boolean;
  team: "A" | "B" | null;
}

/** Điểm danh: mỗi người tick "Đá" và "Ăn" ngay trên link chung. */
export function RsvpPanel({
  matchId,
  members,
  rsvps,
  open,
  cancelled,
  cancelReason,
}: {
  matchId: number;
  members: { id: number; name: string }[];
  rsvps: Vote[];
  open: boolean;
  cancelled: boolean;
  cancelReason: string;
}) {
  const [votes, setVote] = useOptimistic(rsvps, (state: Vote[], v: Vote) => [
    ...state.filter((x) => x.memberId !== v.memberId),
    v,
  ]);
  const [q, setQ] = useState("");
  const me = useMe();
  const [picking, setPicking] = useState(false);
  // Thứ tự chỉ tính khi mở / tải lại trang: người đã vote lên đầu. Tick trong lúc xem không làm nhảy dòng.
  const [order] = useState(() => {
    const voted = new Map(rsvps.map((r) => [r.memberId, (r.going ? 2 : 0) + (r.eat ? 1 : 0)]));
    const sorted = [...members].sort(
      (a, b) => (voted.get(b.id) ?? 0) - (voted.get(a.id) ?? 0) || a.name.localeCompare(b.name, "vi"),
    );
    return new Map(sorted.map((m, i) => [m.id, i]));
  });
  const byId = useMemo(() => new Map(votes.map((v) => [v.memberId, v])), [votes]);
  const going = votes.filter((v) => v.going);
  const eating = votes.filter((v) => v.eat);

  function vote(memberId: number, next: { going: boolean; eat: boolean; team?: "A" | "B" | null }) {
    const prev = byId.get(memberId);
    const team = next.going ? (next.team !== undefined ? next.team : (prev?.team ?? null)) : null;
    const v = { memberId, going: next.going, eat: next.eat, team };
    startTransition(async () => {
      setVote(v);
      const res = await castRsvp({ matchId, memberId, going: v.going, eat: v.eat, team: v.team });
      if (res?.error) toast.error(res.error);
    });
  }

  const n = stripDiacritics(q.trim()).toLowerCase();
  const list = members
    .filter((m) => !n || stripDiacritics(m.name).toLowerCase().includes(n))
    .sort((a, b) => (order.get(a.id) ?? 1e9) - (order.get(b.id) ?? 1e9) || a.name.localeCompare(b.name, "vi"));

  if (cancelled)
    return (
      <Card className="p-6 text-center shadow-lg shadow-black/5">
        <span className="mx-auto flex size-16 items-center justify-center rounded-3xl bg-team-b-soft text-team-b">
          <CloudRain className="size-8" />
        </span>
        <p className="mt-3 text-xl font-extrabold">Trận đã huỷ</p>
        {cancelReason && <p className="mt-1 text-muted">{cancelReason}</p>}
      </Card>
    );

  const meMember = members.find((m) => m.id === me);
  const mine = me ? byId.get(me) : undefined;

  return (
    <div className="space-y-3">
      {/* Của bạn: điểm danh nhanh không cần tìm tên */}
      {!meMember || picking ? (
        <Card className="space-y-3 p-4 shadow-lg shadow-black/5">
          <p className="font-bold">Bạn là ai?</p>
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
        </Card>
      ) : (
        <Card className="p-4 shadow-lg shadow-black/5">
          <div className="flex items-center gap-3">
            <Avatar name={meMember.name} id={meMember.id} />
            <p className="min-w-0 flex-1 truncate font-bold">{meMember.name}</p>
            <button type="button" onClick={() => setPicking(true)} className="h-8 rounded-full bg-card-2 px-3 text-xs font-semibold text-muted">
              Đổi
            </button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {(
              [
                ["going", "Đá", Users],
                ["eat", "Ăn", Utensils],
              ] as const
            ).map(([k, label, Icon]) => {
              const on = !!mine?.[k];
              return (
                <button
                  key={k}
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  disabled={!open}
                  onClick={() =>
                    vote(meMember.id, {
                      going: k === "going" ? !on : !!mine?.going,
                      eat: k === "eat" ? !on : !!mine?.eat,
                    })
                  }
                  className={cx(
                    "flex h-14 items-center justify-center gap-2 rounded-2xl border-2 text-base font-bold transition active:scale-[0.97] disabled:opacity-50",
                    on ? "border-brand bg-brand text-brand-ink" : "border-line bg-card text-muted",
                  )}
                >
                  {on ? <Check className="size-5" strokeWidth={3} /> : <Icon className="size-5" />}
                  {label}
                </button>
              );
            })}
          </div>
        </Card>
      )}

      <Card className="grid grid-cols-2 divide-x divide-line shadow-lg shadow-black/5">
        <div className="p-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-muted">
            <Users className="size-4" /> Đá
          </p>
          <p className="tabular text-3xl font-extrabold text-brand">{going.length}</p>
        </div>
        <div className="p-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-muted">
            <Utensils className="size-4" /> Ăn
          </p>
          <p className="tabular text-3xl font-extrabold">{eating.length}</p>
        </div>
      </Card>

      <Card>
        <CardHeader icon={<Users />} title="Điểm danh" subtitle={open ? undefined : "Đã khoá"} />
        <div className="px-4 pb-3">
          <label className="flex h-11 items-center gap-2 rounded-2xl bg-card-2 px-3.5">
            <Search className="size-[18px] text-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm tên…"
              className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted/70"
            />
            {q && (
              <button type="button" aria-label="Xoá tìm kiếm" onClick={() => setQ("")} className="text-muted">
                <X className="size-4" />
              </button>
            )}
          </label>
        </div>
        <div className="flex items-center justify-end gap-2 px-4 pb-1 text-[11px] font-bold text-muted uppercase">
          <span className="w-12 text-center">Đá</span>
          <span className="w-12 text-center">Ăn</span>
        </div>
        <ul className="divide-y divide-line">
          {list.map((m) => {
            const v = byId.get(m.id);
            const g = !!v?.going;
            const e = !!v?.eat;
            return (
              <li key={m.id} className="flex min-h-16 items-center gap-2.5 px-4 py-2">
                <span className={cx("transition", !g && !e && "opacity-50 grayscale")}>
                  <Avatar name={m.name} id={m.id} size="sm" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className={cx("truncate text-[15px] font-semibold", !g && !e && "text-muted")}>{m.name}</p>
                </div>
                <Tick
                  label={`${m.name} đá`}
                  checked={g}
                  disabled={!open}
                  onChange={(c) => vote(m.id, { going: c, eat: e })}
                />
                <Tick
                  label={`${m.name} ăn`}
                  checked={e}
                  disabled={!open}
                  onChange={(c) => vote(m.id, { going: g, eat: c })}
                />
              </li>
            );
          })}
          {list.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted">Không tìm thấy “{q}”</li>}
        </ul>
      </Card>
    </div>
  );
}

function Tick({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <span className="flex w-12 justify-center">
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx(
          "flex size-9 items-center justify-center rounded-xl border-2 transition active:scale-90 disabled:opacity-40",
          checked ? "border-brand bg-brand text-brand-ink" : "border-line bg-card",
        )}
      >
        {checked && <Check className="size-5" strokeWidth={3} />}
      </button>
    </span>
  );
}
