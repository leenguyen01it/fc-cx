"use client";

import { CreditCard, Settings, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BallIcon, cx } from "@/components/ui";

const ITEMS = [
  { href: "/admin", Icon: BallIcon, label: "Trận" },
  { href: "/admin/thanh-vien", Icon: Users, label: "Thành viên" },
  { href: "/admin/giao-dich", Icon: CreditCard, label: "Giao dịch" },
  { href: "/admin/cai-dat", Icon: Settings, label: "Cài đặt" },
];

export function AdminNav({ pending = 0 }: { pending?: number }) {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-card/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
      <div className="mx-auto grid max-w-3xl grid-cols-4 px-1">
        {ITEMS.map(({ href, Icon, label }) => {
          const on = href === "/admin" ? path === "/admin" || path.startsWith("/admin/tran") : path.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={on ? "page" : undefined}
              className={cx("flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold", on ? "text-brand" : "text-muted")}
            >
              <span className={cx("relative flex h-8 w-14 items-center justify-center rounded-full transition", on && "bg-brand-soft")}>
                <Icon className="size-[22px]" />
                {href === "/admin/giao-dich" && pending > 0 && (
                  <span className="absolute -top-0.5 right-2 flex min-w-4 items-center justify-center rounded-full bg-team-a px-1 text-[10px] leading-4 font-bold text-white">
                    {pending}
                  </span>
                )}
              </span>
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
