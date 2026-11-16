"use client";

import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, CircleCheck, CloudRain, Hourglass, Vote } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Sheet, cx } from "./ui";
import { startNavigation } from "./navigation-progress";

export interface MatchOption {
  id: number;
  status: "voting" | "cancelled" | "done";
  /** Số người đã đăng ký đá (khi đang điểm danh). */
  going: number;
  date: string;
  weekday: string;
  full: string;
  score: string | null;
  unpaid: number;
}

const arrow =
  "flex size-11 shrink-0 items-center justify-center rounded-2xl border border-line bg-card text-ink shadow-sm transition active:scale-95";

/** Chọn ngày xem trận: nút ‹ › để lùi/tới, bấm giữa để mở danh sách các trận. */
export function MatchPicker({
  options,
  current,
  teamNames,
}: {
  options: MatchOption[];
  current: number;
  teamNames: { A: string; B: string };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const idx = options.findIndex((o) => o.id === current);
  const cur = options[idx];
  const older = options[idx + 1];
  const newer = idx > 0 ? options[idx - 1] : undefined;
  const href = (id: number) => `/?tran=${id}`;

  return (
    <>
      <div className="flex items-center gap-2">
        {older ? (
          <Link href={href(older.id)} className={arrow} aria-label="Trận trước">
            <ChevronLeft className="size-5" />
          </Link>
        ) : (
          <span className={cx(arrow, "opacity-30")}>
            <ChevronLeft className="size-5" />
          </span>
        )}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl border border-line bg-card px-3 font-semibold text-ink shadow-sm active:scale-[0.98]"
        >
          <CalendarDays className="size-[18px] shrink-0 text-brand" />
          <span className="truncate">
            {cur?.weekday}, {cur?.full}
          </span>
          <ChevronDown className="size-4 shrink-0 text-muted" />
        </button>
        {newer ? (
          <Link href={href(newer.id)} className={arrow} aria-label="Trận sau">
            <ChevronRight className="size-5" />
          </Link>
        ) : (
          <span className={cx(arrow, "opacity-30")}>
            <ChevronRight className="size-5" />
          </span>
        )}
      </div>

      <Sheet open={open} onClose={() => setOpen(false)} title="Chọn trận" icon={<CalendarDays />}>
        <ul className="-mx-2 space-y-1">
          {options.map((o) => {
            const on = o.id === current;
            return (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    startNavigation(href(o.id));
                    router.push(href(o.id));
                  }}
                  className={cx(
                    "flex min-h-16 w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition active:scale-[0.99]",
                    on ? "bg-brand-soft" : "hover:bg-card-2",
                  )}
                >
                  <span
                    className={cx(
                      "flex size-12 shrink-0 flex-col items-center justify-center rounded-2xl leading-none",
                      on ? "bg-brand text-brand-ink" : "bg-card-2",
                    )}
                  >
                    <span className="text-[10px] font-semibold opacity-80">{o.weekday}</span>
                    <span className="mt-0.5 text-sm font-extrabold">{o.full.slice(0, 5)}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cx("block font-bold", on && "text-brand")}>
                      {o.status === "voting"
                        ? "Điểm danh"
                        : o.status === "cancelled"
                          ? "Đã huỷ"
                          : o.score
                            ? `${teamNames.A} ${o.score} ${teamNames.B}`
                            : "Chưa có tỷ số"}
                    </span>
                    <span className="block text-xs text-muted">{o.full}</span>
                  </span>
                  {o.status === "voting" ? (
                    <span className="flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand">
                      <Vote className="size-3.5" />
                      {o.going} đá
                    </span>
                  ) : o.status === "cancelled" ? (
                    <span className="flex items-center gap-1 rounded-full bg-team-b-soft px-2.5 py-1 text-xs font-semibold text-team-b">
                      <CloudRain className="size-3.5" />
                      Huỷ
                    </span>
                  ) : o.unpaid ? (
                    <span className="flex items-center gap-1 rounded-full bg-due-soft px-2.5 py-1 text-xs font-semibold text-due">
                      <Hourglass className="size-3.5" />
                      {o.unpaid} chưa trả
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 rounded-full bg-paid-soft px-2.5 py-1 text-xs font-semibold text-paid">
                      <CircleCheck className="size-3.5" />
                      Đủ
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </Sheet>
    </>
  );
}
