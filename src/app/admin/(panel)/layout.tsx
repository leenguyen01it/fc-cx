import { Eye, LogOut } from "lucide-react";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/data";
import { count, eq } from "drizzle-orm";
import { db, transactions } from "@/db";
import { BallIcon, ConfirmButton } from "@/components/ui";
import { AdminNav } from "./nav";
import { logout } from "../actions";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireAdmin();
  const [st, [{ n }]] = await Promise.all([
    getSettings(),
    db.select({ n: count() }).from(transactions).where(eq(transactions.status, "pending")),
  ]);
  return (
    <div className="mx-auto min-h-dvh max-w-3xl pb-28">
      <header className="sticky top-0 z-20 border-b border-line bg-card/85 px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-3 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-2xl bg-brand text-brand-ink">
              <BallIcon className="size-5" />
            </span>
            <div className="min-w-0 leading-tight">
              <p className="truncate font-extrabold">{st.teamName}</p>
              <p className="text-xs text-muted">Quản trị</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Link
              href="/"
              className="flex h-9 items-center gap-1.5 rounded-full bg-card-2 px-3 text-xs font-semibold active:scale-95"
            >
              <Eye className="size-4" /> Trang đội
            </Link>
            <ConfirmButton
              ariaLabel="Đăng xuất"
              className="flex size-9 items-center justify-center rounded-full bg-card-2 text-muted active:scale-95"
              title="Đăng xuất?"
              confirmLabel="Đăng xuất"
              icon={<LogOut />}
              onConfirm={logout}
            >
              <LogOut className="size-4" />
            </ConfirmButton>
          </div>
        </div>
      </header>
      <main className="px-4 pt-4">{children}</main>
      <AdminNav pending={n} />
    </div>
  );
}
