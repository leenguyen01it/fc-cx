"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * Thanh tiến trình mảnh trên đỉnh trang khi chuyển trang.
 * Bắt đầu khi bấm link nội bộ, bấm lùi/tới, hoặc code gọi startNavigation() trước router.push;
 * kết thúc khi đường dẫn đổi xong. Trang nhanh hơn 120ms thì không hiện để khỏi chớp.
 */
const SHOW_AFTER = 120;
const GIVE_UP_AFTER = 10_000;
const START_EVENT = "nav-progress:start";

/** Gọi ngay trước router.push(url) để thanh tiến trình chạy (link thường tự bắt được). */
export function startNavigation(href: string) {
  window.dispatchEvent(new CustomEvent(START_EVENT, { detail: href }));
}

// So sánh đường dẫn không phụ thuộc thứ tự tham số
function key(url: URL) {
  const params = [...url.searchParams].filter(([, v]) => v !== "").sort(([a], [b]) => a.localeCompare(b));
  return `${url.pathname}?${new URLSearchParams(params)}`;
}

export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [phase, setPhase] = useState<"idle" | "loading" | "done">("idle");
  const [width, setWidth] = useState(0);
  const timers = useRef<number[]>([]);
  const phaseRef = useRef<"idle" | "starting" | "loading" | "done">("idle");
  const finish = useRef<() => void>(() => {});
  // Đường dẫn của trang đang hiện, để bỏ qua popstate không đổi trang
  const shown = useRef("");

  useEffect(() => {
    const clear = () => {
      timers.current.forEach((id) => window.clearTimeout(id));
      timers.current = [];
    };
    const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms));
    const trickle = () => {
      // Chạy chậm dần tới 85%, phần còn lại khi trang xong
      setWidth((w) => Math.min(85, w + (85 - w) * 0.12));
      later(trickle, 300);
    };
    const start = () => {
      if (phaseRef.current === "starting" || phaseRef.current === "loading") return;
      clear();
      phaseRef.current = "starting";
      later(() => {
        phaseRef.current = "loading";
        setPhase("loading");
        setWidth(15);
        later(trickle, 200);
      }, SHOW_AFTER);
      later(() => finish.current(), GIVE_UP_AFTER);
    };
    finish.current = () => {
      const visible = phaseRef.current === "loading";
      clear();
      if (!visible) {
        phaseRef.current = "idle";
        setPhase("idle");
        return;
      }
      phaseRef.current = "done";
      setPhase("done");
      setWidth(100);
      later(() => {
        phaseRef.current = "idle";
        setPhase("idle");
        setWidth(0);
      }, 450);
    };
    const startIfNew = (url: URL) => {
      if (url.origin === location.origin && key(url) !== key(new URL(location.href))) start();
    };

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
        return;
      const link = (event.target as Element).closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link || (link.target && link.target !== "_self") || link.hasAttribute("download")) return;
      startIfNew(new URL(link.href, location.href));
    };
    const onStart = (event: Event) => startIfNew(new URL((event as CustomEvent<string>).detail, location.href));
    // Chrome bắn popstate cả khi nhảy tới #mục trong cùng trang; khi đó không chuyển trang nên không chạy thanh
    const onPop = () => {
      if (key(new URL(location.href)) !== shown.current) start();
    };
    document.addEventListener("click", onClick, true);
    window.addEventListener(START_EVENT, onStart);
    window.addEventListener("popstate", onPop);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener(START_EVENT, onStart);
      window.removeEventListener("popstate", onPop);
      clear();
    };
  }, []);

  // Đường dẫn đổi khi trang mới hoặc khung chờ của nó đã hiện. Đang là khung chờ thì
  // chạy tiếp tới khi trang thật thay thế nó.
  useEffect(() => {
    shown.current = key(new URL(location.href));
    if (!document.querySelector("[data-route-loading]")) {
      finish.current();
      return;
    }
    const observer = new MutationObserver(() => {
      if (document.querySelector("[data-route-loading]")) return;
      observer.disconnect();
      finish.current();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [pathname, searchParams]);

  if (phase === "idle") return null;
  return (
    <div
      role="progressbar"
      aria-label="Đang chuyển trang"
      className="pointer-events-none fixed inset-x-0 top-0 z-[110] h-[3px] transition-opacity duration-300"
      style={{ opacity: phase === "done" ? 0 : 1, transitionDelay: phase === "done" ? "150ms" : "0ms" }}
    >
      <div
        className="h-full rounded-r-full bg-brand shadow-[0_0_10px_var(--brand)] transition-[width] duration-300 ease-out"
        style={{ width: `${width}%` }}
      />
    </div>
  );
}
