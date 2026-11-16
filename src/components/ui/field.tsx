"use client";

import { CircleAlert, Minus, Plus } from "lucide-react";
import {
  createContext,
  useContext,
  useId,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import { cx } from "./base";

/* ---------------- Lỗi theo từng ô (do ActionForm cung cấp) ---------------- */

interface FormCtx {
  errors: Record<string, string>;
  clear: (name: string) => void;
}
export const FormErrorsContext = createContext<FormCtx>({ errors: {}, clear: () => {} });

export function useFieldError(name?: string) {
  const ctx = useContext(FormErrorsContext);
  return {
    error: name ? ctx.errors[name] : undefined,
    clear: () => name && ctx.clear(name),
  };
}

/* ---------------- Khung ô nhập ---------------- */

export function Field({
  label,
  name,
  hint,
  error,
  children,
  htmlFor,
  optional,
  className,
}: {
  label?: ReactNode;
  name?: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
  htmlFor?: string;
  optional?: boolean;
  className?: string;
}) {
  const ctx = useFieldError(name);
  const err = error ?? ctx.error;
  return (
    <div className={cx("min-w-0", className)}>
      {label && (
        <label htmlFor={htmlFor ?? name} className="mb-1.5 flex items-center gap-1 text-[13px] font-semibold text-muted">
          {label}
          {optional && <span className="font-normal text-muted/70">(không bắt buộc)</span>}
        </label>
      )}
      {children}
      {err ? (
        <p role="alert" className="mt-1.5 flex items-start gap-1 text-xs font-medium text-team-a">
          <CircleAlert className="mt-px size-3.5 shrink-0" />
          {err}
        </p>
      ) : (
        hint && <p className="mt-1.5 text-xs text-muted">{hint}</p>
      )}
    </div>
  );
}

export const inputClass = (invalid?: boolean) =>
  cx(
    "w-full rounded-2xl border bg-card text-[16px] text-ink transition outline-none placeholder:text-muted/60",
    "focus:border-brand focus:ring-4 focus:ring-brand/15 disabled:opacity-50",
    invalid ? "border-team-a ring-4 ring-team-a/10" : "border-line",
  );

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  icon?: ReactNode;
  suffix?: ReactNode;
  invalid?: boolean;
};

export function TextInput({ icon, suffix, invalid, className, name, onInput, ...rest }: InputProps) {
  const f = useFieldError(name);
  const isInvalid = invalid ?? !!f.error;
  return (
    <div className="relative">
      {icon && (
        <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted [&>svg]:size-[18px]">
          {icon}
        </span>
      )}
      <input
        id={rest.id ?? name}
        name={name}
        aria-invalid={isInvalid || undefined}
        onInput={(e) => {
          f.clear();
          onInput?.(e);
        }}
        className={cx(inputClass(isInvalid), "h-12", icon ? "pl-10" : "pl-3.5", suffix ? "pr-10" : "pr-3.5", className)}
        {...rest}
      />
      {suffix && (
        <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-sm font-semibold text-muted">
          {suffix}
        </span>
      )}
    </div>
  );
}

export function TextArea({
  name,
  maxLength,
  className,
  invalid,
  value,
  defaultValue,
  onChange,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  const f = useFieldError(name);
  const [len, setLen] = useState(String(value ?? defaultValue ?? "").length);
  const shown = value !== undefined ? String(value).length : len;
  return (
    <div className="relative">
      <textarea
        id={rest.id ?? name}
        name={name}
        maxLength={maxLength}
        value={value}
        defaultValue={defaultValue}
        aria-invalid={(invalid ?? !!f.error) || undefined}
        onChange={(e) => {
          setLen(e.target.value.length);
          f.clear();
          onChange?.(e);
        }}
        className={cx(inputClass(invalid ?? !!f.error), "min-h-24 resize-none px-3.5 py-3 leading-relaxed", className)}
        {...rest}
      />
      {maxLength && (
        <span className="pointer-events-none absolute right-3 bottom-2 text-[11px] text-muted/70 tabular">
          {shown}/{maxLength}
        </span>
      )}
    </div>
  );
}

/* ---------------- Ô nhập tiền ---------------- */

const fmt = (n: number) => (n ? new Intl.NumberFormat("vi-VN").format(n) : "");

/** Nhập tiền có dấu chấm ngăn cách, hậu tố "đ", nút chọn nhanh. */
export function MoneyInput({
  name,
  value: controlled,
  defaultValue = 0,
  onChange,
  quick,
  invalid,
  placeholder = "0",
  className,
  id,
  ariaLabel,
}: {
  name?: string;
  value?: number;
  defaultValue?: number;
  onChange?: (v: number) => void;
  /** Các mức gợi ý, VD [100000, 200000, 500000] → bấm để điền nhanh. */
  quick?: number[];
  invalid?: boolean;
  placeholder?: string;
  className?: string;
  id?: string;
  ariaLabel?: string;
}) {
  const [inner, setInner] = useState(defaultValue);
  const value = controlled ?? inner;
  const f = useFieldError(name);
  const set = (v: number) => {
    const n = Math.max(0, Math.min(999_999_999, Math.round(v)));
    if (controlled === undefined) setInner(n);
    onChange?.(n);
    f.clear();
  };
  return (
    <div className={className}>
      <div className="relative">
        <input
          id={id ?? name}
          inputMode="numeric"
          autoComplete="off"
          aria-label={ariaLabel}
          aria-invalid={(invalid ?? !!f.error) || undefined}
          value={fmt(value)}
          placeholder={placeholder}
          onChange={(e) => set(Number(e.target.value.replace(/\D/g, "")) || 0)}
          className={cx(inputClass(invalid ?? !!f.error), "tabular h-12 pr-9 pl-3.5 text-right font-bold")}
        />
        <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 font-semibold text-muted">đ</span>
        {name && <input type="hidden" name={name} value={value} />}
      </div>
      {quick && quick.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {quick.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => set(q)}
              className={cx(
                "h-8 rounded-full border px-3 text-xs font-semibold transition active:scale-95",
                value === q ? "border-brand bg-brand-soft text-brand" : "border-line bg-card text-muted",
              )}
            >
              {q >= 1_000_000 ? `${q / 1_000_000}tr` : `${q / 1000}k`}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- Công tắc ---------------- */

export function Switch({
  name,
  checked: controlled,
  defaultChecked = false,
  onChange,
  label,
  description,
  icon,
  disabled,
}: {
  name?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (v: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
}) {
  const [inner, setInner] = useState(defaultChecked);
  const on = controlled ?? inner;
  const id = useId();
  const toggle = () => {
    if (disabled) return;
    if (controlled === undefined) setInner(!on);
    onChange?.(!on);
  };
  return (
    <div className={cx("flex items-center gap-3", disabled && "opacity-50")}>
      {name && <input type="hidden" name={name} value={on ? "on" : ""} />}
      {icon && (
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-card-2 text-muted [&>svg]:size-[18px]">
          {icon}
        </span>
      )}
      <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer">
        <span className="block text-[15px] font-semibold">{label}</span>
        {description && <span className="block text-xs leading-snug text-muted">{description}</span>}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={on}
        onClick={toggle}
        className={cx(
          "relative h-7 w-12 shrink-0 rounded-full transition-colors",
          on ? "bg-brand" : "bg-line",
        )}
      >
        <span
          className={cx(
            "absolute top-0.5 left-0.5 size-6 rounded-full bg-white shadow transition-transform",
            on && "translate-x-5",
          )}
        />
      </button>
    </div>
  );
}

/* ---------------- Nút chọn dạng phân đoạn ---------------- */

export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = "md",
  className,
  ariaLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  options: SegmentOption<T>[];
  size?: "md" | "sm";
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cx("flex gap-1 rounded-2xl bg-card-2 p-1", className)}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cx(
              "flex flex-1 items-center justify-center gap-1.5 rounded-xl font-semibold whitespace-nowrap transition active:scale-[0.97] [&>svg]:size-4",
              size === "md" ? "h-10 px-3 text-sm" : "h-8 px-2 text-xs",
              on ? "bg-card text-brand shadow-sm" : "text-muted",
            )}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ---------------- Tăng / giảm (tỷ số) ---------------- */

export function Stepper({
  value,
  onChange,
  min = 0,
  max = 99,
  invalid,
  ariaLabel,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  min?: number;
  max?: number;
  invalid?: boolean;
  ariaLabel?: string;
}) {
  const v = value ?? min;
  const stepBtn =
    "flex size-11 items-center justify-center rounded-2xl bg-card-2 text-ink transition active:scale-90 disabled:opacity-30";
  return (
    <div className="flex items-center gap-1.5">
      <button type="button" aria-label="Giảm" disabled={value == null || v <= min} onClick={() => onChange(Math.max(min, v - 1))} className={stepBtn}>
        <Minus className="size-5" />
      </button>
      <input
        inputMode="numeric"
        aria-label={ariaLabel}
        value={value ?? ""}
        placeholder="–"
        onChange={(e) => {
          const s = e.target.value.replace(/\D/g, "");
          onChange(s === "" ? null : Math.min(max, Number(s)));
        }}
        className={cx(
          "tabular h-14 w-14 rounded-2xl border bg-card text-center text-3xl font-extrabold outline-none focus:border-brand focus:ring-4 focus:ring-brand/15",
          invalid ? "border-team-a ring-4 ring-team-a/10" : "border-line",
        )}
      />
      <button type="button" aria-label="Tăng" disabled={v >= max} onClick={() => onChange(value == null ? min : Math.min(max, v + 1))} className={stepBtn}>
        <Plus className="size-5" />
      </button>
    </div>
  );
}
