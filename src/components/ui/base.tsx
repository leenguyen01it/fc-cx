import type { ReactNode } from "react";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section className={cx("rounded-3xl border border-line bg-card shadow-[0_1px_3px_rgb(0_0_0/0.04)]", className)}>
      {children}
    </section>
  );
}

export function CardHeader({
  icon,
  title,
  subtitle,
  right,
}: {
  icon?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-3">
      <div className="flex min-w-0 items-center gap-2.5">
        {icon && (
          <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand [&>svg]:size-4.5">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h2 className="truncate text-[15px] font-bold">{title}</h2>
          {subtitle && <p className="truncate text-xs text-muted">{subtitle}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}

const AVATAR_COLORS = [
  "bg-rose-500",
  "bg-orange-500",
  "bg-amber-500",
  "bg-lime-600",
  "bg-emerald-600",
  "bg-teal-600",
  "bg-cyan-600",
  "bg-sky-600",
  "bg-indigo-500",
  "bg-violet-500",
  "bg-fuchsia-500",
  "bg-pink-500",
];

export function initials(name: string) {
  const w = name.trim().split(/\s+/);
  return (w.length > 1 ? w[w.length - 2][0] + w[w.length - 1][0] : name.slice(0, 2)).toUpperCase();
}

export function Avatar({ name, id, size = "md" }: { name: string; id: number; size?: "sm" | "md" | "lg" }) {
  return (
    <span
      className={cx(
        "inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white",
        AVATAR_COLORS[id % AVATAR_COLORS.length],
        size === "sm" && "size-8 text-[11px]",
        size === "md" && "size-10 text-xs",
        size === "lg" && "size-14 text-lg",
      )}
    >
      {initials(name)}
    </span>
  );
}

export type Tone = "paid" | "due" | "a" | "b" | "brand" | "muted" | "danger";

export function Badge({ tone, children, className }: { tone: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] leading-none font-semibold whitespace-nowrap [&>svg]:size-3.5",
        tone === "paid" && "bg-paid-soft text-paid",
        tone === "due" && "bg-due-soft text-due",
        tone === "a" && "bg-team-a-soft text-team-a",
        tone === "b" && "bg-team-b-soft text-team-b",
        tone === "brand" && "bg-brand-soft text-brand",
        tone === "muted" && "bg-card-2 text-muted",
        tone === "danger" && "bg-team-a-soft text-team-a",
        className,
      )}
    >
      {children}
    </span>
  );
}

const btnBase =
  "inline-flex items-center justify-center gap-2 rounded-2xl font-semibold transition select-none active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 [&>svg]:size-[18px] [&>svg]:shrink-0";

export const btn = {
  primary: cx(btnBase, "h-12 bg-brand px-5 text-[15px] text-brand-ink shadow-sm shadow-brand/25 hover:brightness-105"),
  ghost: cx(btnBase, "h-12 border border-line bg-card px-5 text-[15px] text-ink hover:bg-card-2"),
  soft: cx(btnBase, "h-12 bg-brand-soft px-5 text-[15px] text-brand"),
  danger: cx(btnBase, "h-12 bg-team-a px-5 text-[15px] text-white"),
  small: cx(btnBase, "h-9 rounded-xl px-3 text-sm [&>svg]:size-4"),
  icon: cx(btnBase, "size-10 rounded-xl bg-card-2 text-muted hover:text-ink [&>svg]:size-5"),
};

export function Empty({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <span className="flex size-16 items-center justify-center rounded-3xl bg-brand-soft text-brand [&>svg]:size-8">
        {icon}
      </span>
      <p className="text-base font-bold">{title}</p>
      {children && <div className="max-w-xs text-sm text-muted">{children}</div>}
    </div>
  );
}

/** Logo quả bóng (lucide chưa có icon bóng đá). */
export function BallIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" className={className} aria-hidden>
      <circle cx="12" cy="12" r="9.5" />
      <path d="m12 7.2 4.1 3-1.6 4.8h-5l-1.6-4.8z" fill="currentColor" />
      <path d="M12 7.2V2.6M16.1 10.2l4.3-1.5M14.5 15l2.8 3.8M9.5 15l-2.8 3.8M7.9 10.2 3.6 8.7" />
    </svg>
  );
}
