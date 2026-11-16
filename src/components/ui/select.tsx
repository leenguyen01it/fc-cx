"use client";

import { Check, ChevronDown, Search, SearchX } from "lucide-react";
import { useId, useMemo, useState, type ReactNode } from "react";
import { stripDiacritics } from "@/lib/text";
import { cx } from "./base";
import { useFieldError } from "./field";
import { Sheet } from "./sheet";

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
  icon?: ReactNode;
  /** Nội dung phụ bên phải, VD badge "Nợ 120k". */
  meta?: ReactNode;
  /** Từ khoá tìm kiếm thêm (mã thành viên...). */
  keywords?: string;
  disabled?: boolean;
}

const norm = (s: string) => stripDiacritics(s).toLowerCase();

/**
 * Ô chọn thay cho <select>: mở danh sách dạng bottom sheet, có tìm kiếm,
 * icon và mô tả cho từng lựa chọn. Dùng được trong <form> qua `name` (input ẩn).
 */
export function Select({
  name,
  value: controlled,
  defaultValue = "",
  onChange,
  options,
  placeholder = "Chọn…",
  title,
  icon,
  searchable,
  invalid,
  disabled,
  className,
  size = "md",
}: {
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (v: string) => void;
  options: SelectOption[];
  placeholder?: string;
  title?: string;
  icon?: ReactNode;
  searchable?: boolean;
  invalid?: boolean;
  disabled?: boolean;
  className?: string;
  size?: "md" | "sm";
}) {
  const [inner, setInner] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const value = controlled ?? inner;
  const selected = options.find((o) => o.value === value);
  const field = useFieldError(name);
  const isInvalid = invalid ?? !!field.error;
  const listId = useId();
  const canSearch = searchable ?? options.length > 7;

  const filtered = useMemo(() => {
    if (!q.trim()) return options;
    const n = norm(q.trim());
    return options.filter((o) => norm(`${o.label} ${o.description ?? ""} ${o.keywords ?? ""}`).includes(n));
  }, [options, q]);

  function pick(v: string) {
    if (controlled === undefined) setInner(v);
    onChange?.(v);
    field.clear();
    setOpen(false);
    setQ("");
  }

  return (
    <>
      {name && <input type="hidden" name={name} value={value} />}
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={listId}
        data-invalid={isInvalid || undefined}
        onClick={() => setOpen(true)}
        className={cx(
          "flex w-full items-center gap-2.5 rounded-2xl border bg-card text-left transition outline-none active:scale-[0.99] disabled:opacity-50",
          "focus-visible:border-brand focus-visible:ring-4 focus-visible:ring-brand/15",
          size === "md" ? "min-h-12 px-3.5 py-2" : "min-h-10 px-3 py-1.5",
          isInvalid ? "border-team-a ring-4 ring-team-a/10" : "border-line",
          className,
        )}
      >
        {(selected?.icon || icon) && (
          <span className="flex max-w-14 shrink-0 items-center text-muted [&>svg]:size-[18px]">{selected?.icon ?? icon}</span>
        )}
        <span className="min-w-0 flex-1">
          <span className={cx("block truncate", size === "sm" ? "text-sm" : "text-[15px]", selected ? "font-semibold" : "text-muted/80")}>
            {selected?.label ?? placeholder}
          </span>
          {selected?.description && size === "md" && (
            <span className="block truncate text-xs text-muted">{selected.description}</span>
          )}
        </span>
        <ChevronDown className="size-[18px] shrink-0 text-muted" />
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title={title ?? placeholder}>
        {canSearch && (
          <div className="sticky top-0 z-10 -mx-5 bg-card px-5 pb-3">
            <label className="flex h-11 items-center gap-2 rounded-2xl bg-card-2 px-3.5">
              <Search className="size-[18px] text-muted" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Tìm kiếm…"
                className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted/70"
              />
            </label>
          </div>
        )}
        <ul id={listId} role="listbox" className="-mx-2 space-y-0.5">
          {filtered.map((o) => {
            const on = o.value === value;
            return (
              <li key={o.value} role="option" aria-selected={on}>
                <button
                  type="button"
                  disabled={o.disabled}
                  onClick={() => pick(o.value)}
                  className={cx(
                    "flex min-h-14 w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition active:scale-[0.99] disabled:opacity-40",
                    on ? "bg-brand-soft" : "hover:bg-card-2",
                  )}
                >
                  {o.icon && (
                    <span
                      className={cx(
                        "flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl has-[>img]:w-16 has-[>img]:border has-[>img]:border-line has-[>img]:bg-white [&>img]:px-1.5 [&>svg]:size-5",
                        on ? "bg-brand text-brand-ink" : "bg-card-2 text-muted",
                      )}
                    >
                      {o.icon}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className={cx("block truncate text-[15px]", on ? "font-bold text-brand" : "font-semibold")}>
                      {o.label}
                    </span>
                    {o.description && <span className="block text-xs leading-snug text-muted">{o.description}</span>}
                  </span>
                  {o.meta}
                  <span
                    className={cx(
                      "flex size-6 shrink-0 items-center justify-center rounded-full transition",
                      on ? "bg-brand text-brand-ink" : "border-2 border-line",
                    )}
                  >
                    {on && <Check className="size-4" strokeWidth={3} />}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {filtered.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-10 text-muted">
            <SearchX className="size-8" />
            <p className="text-sm">Không tìm thấy “{q}”</p>
          </div>
        )}
      </Sheet>
    </>
  );
}
