"use client";

import { CalendarDays, ChevronDown, Clock } from "lucide-react";
import { useState } from "react";
import { DayPicker } from "react-day-picker";
import { vi } from "react-day-picker/locale";
import { formatDate } from "@/lib/text";
import { cx } from "./base";
import { inputClass, useFieldError } from "./field";
import { Sheet } from "./sheet";

/** "2026-11-15" ↔ Date theo giờ máy (không lệch múi giờ). */
const toDate = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return y && m && d ? new Date(y, m - 1, d) : undefined;
};
const toIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function quickDates() {
  const today = new Date();
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  const toSun = (7 - today.getDay()) % 7 || 7;
  const sunday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + toSun);
  return [
    { label: "Hôm nay", date: today },
    { label: "Ngày mai", date: tomorrow },
    { label: "Chủ nhật tới", date: sunday },
  ];
}

const trigger = (invalid?: boolean) =>
  cx(
    inputClass(invalid),
    "flex h-12 items-center gap-2.5 px-3.5 text-left active:scale-[0.99] [&>svg]:size-[18px] [&>svg]:shrink-0",
  );

/** Ô chọn ngày: hiển thị kiểu Việt Nam, bấm mở lịch tiếng Việt dạng sheet. */
export function DateField({
  name,
  value: controlled,
  defaultValue = "",
  onChange,
  invalid,
  title = "Chọn ngày",
}: {
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (v: string) => void;
  invalid?: boolean;
  title?: string;
}) {
  const [inner, setInner] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const value = controlled ?? inner;
  const f = useFieldError(name);
  const isInvalid = invalid ?? !!f.error;
  const d = value ? formatDate(value) : null;

  const pick = (date: Date) => {
    const v = toIso(date);
    if (controlled === undefined) setInner(v);
    onChange?.(v);
    f.clear();
    setOpen(false);
  };

  return (
    <>
      {name && <input type="hidden" name={name} value={value} />}
      <button type="button" id={name} onClick={() => setOpen(true)} className={trigger(isInvalid)}>
        <CalendarDays className="text-muted" />
        <span className={cx("min-w-0 flex-1 truncate", d ? "font-semibold" : "text-muted/70")}>
          {d ? `${d.weekday}, ${d.full}` : "Chọn ngày"}
        </span>
        <ChevronDown className="text-muted" />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={title} icon={<CalendarDays />}>
        <div className="mb-3 flex flex-wrap gap-2">
          {quickDates().map((q) => (
            <button
              key={q.label}
              type="button"
              onClick={() => pick(q.date)}
              className={cx(
                "h-9 rounded-full border px-3.5 text-sm font-semibold transition active:scale-95",
                value === toIso(q.date) ? "border-brand bg-brand-soft text-brand" : "border-line bg-card text-muted",
              )}
            >
              {q.label}
            </button>
          ))}
        </div>
        <div className="flex justify-center">
          <DayPicker
            mode="single"
            locale={vi}
            weekStartsOn={1}
            selected={value ? toDate(value) : undefined}
            defaultMonth={value ? toDate(value) : undefined}
            onSelect={(date) => date && pick(date)}
            showOutsideDays
            className="rdp-app"
          />
        </div>
      </Sheet>
    </>
  );
}

const TIMES = Array.from({ length: 14 }, (_, i) => {
  const mins = 15 * 60 + i * 30;
  return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
});

/** Ô chọn giờ: lưới mốc giờ hay đá + ô tự nhập. */
export function TimeField({
  name,
  value: controlled,
  defaultValue = "",
  onChange,
  invalid,
  title = "Chọn giờ",
}: {
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (v: string) => void;
  invalid?: boolean;
  title?: string;
}) {
  const [inner, setInner] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const value = controlled ?? inner;
  const f = useFieldError(name);
  const set = (v: string, close = true) => {
    if (controlled === undefined) setInner(v);
    onChange?.(v);
    f.clear();
    if (close) setOpen(false);
  };

  return (
    <>
      {name && <input type="hidden" name={name} value={value} />}
      <button type="button" id={name} onClick={() => setOpen(true)} className={trigger(invalid ?? !!f.error)}>
        <Clock className="text-muted" />
        <span className={cx("min-w-0 flex-1 truncate", value ? "font-semibold" : "text-muted/70")}>{value || "Chọn giờ"}</span>
        <ChevronDown className="text-muted" />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={title} icon={<Clock />}>
        <div className="grid grid-cols-4 gap-2">
          {TIMES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => set(t)}
              className={cx(
                "tabular h-12 rounded-2xl border text-[15px] font-bold transition active:scale-95",
                value === t ? "border-brand bg-brand text-brand-ink" : "border-line bg-card text-ink",
              )}
            >
              {t}
            </button>
          ))}
        </div>
        <label className="mt-4 block">
          <span className="mb-1.5 block text-[13px] font-semibold text-muted">Giờ khác</span>
          <input
            value={value}
            maxLength={40}
            placeholder="VD: 17:45 hoặc 18:00–19:30"
            onChange={(e) => set(e.target.value, false)}
            className={cx(inputClass(false), "h-12 px-3.5")}
          />
        </label>
      </Sheet>
    </>
  );
}
