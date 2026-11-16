"use client";

import { CircleAlert, CircleCheck, Info } from "lucide-react";
import { useEffect, useState } from "react";
import { cx } from "./base";

type Kind = "success" | "error" | "info";
interface ToastItem {
  id: number;
  kind: Kind;
  message: string;
}

const EVENT = "app:toast";
let seq = 0;

function emit(kind: Kind, message: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ToastItem>(EVENT, { detail: { id: ++seq, kind, message } }));
}

/** Gọi ở bất kỳ client component nào: toast.success("Đã lưu") */
export const toast = {
  success: (m: string) => emit("success", m),
  error: (m: string) => emit("error", m),
  info: (m: string) => emit("info", m),
};

const ICON = { success: CircleCheck, error: CircleAlert, info: Info };

/** Đặt một lần trong root layout. */
export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const on = (e: Event) => {
      const t = (e as CustomEvent<ToastItem>).detail;
      setItems((prev) => [...prev.slice(-2), t]);
      if ("vibrate" in navigator) navigator.vibrate?.(t.kind === "error" ? [30, 40, 30] : 15);
      setTimeout(() => setItems((prev) => prev.filter((x) => x.id !== t.id)), t.kind === "error" ? 4000 : 2600);
    };
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex flex-col items-center gap-2 px-4 pt-[max(env(safe-area-inset-top),0.75rem)]"
    >
      {items.map((t) => {
        const Icon = ICON[t.kind];
        return (
          <div
            key={t.id}
            role={t.kind === "error" ? "alert" : "status"}
            className={cx(
              "animate-toast pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold shadow-xl backdrop-blur-lg",
              t.kind === "success" && "border-paid/20 bg-card/95 text-ink",
              t.kind === "error" && "border-team-a/25 bg-card/95 text-ink",
              t.kind === "info" && "border-line bg-card/95 text-ink",
            )}
            onClick={() => setItems((prev) => prev.filter((x) => x.id !== t.id))}
          >
            <Icon
              className={cx(
                "size-5 shrink-0",
                t.kind === "success" && "text-paid",
                t.kind === "error" && "text-team-a",
                t.kind === "info" && "text-brand",
              )}
            />
            <span className="min-w-0 flex-1">{t.message}</span>
          </div>
        );
      })}
    </div>
  );
}
