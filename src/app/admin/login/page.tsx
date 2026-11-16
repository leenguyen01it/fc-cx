import { ChevronLeft, LogIn } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { login } from "../actions";
import { ActionForm } from "@/components/action-form";
import { PasswordInput } from "@/components/password-input";
import { BallIcon, Field } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await isAdmin()) redirect("/admin");
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      {/* Ảnh đội ở nửa trên, mờ dần xuống nền */}
      <div className="pitch relative isolate h-[44dvh] min-h-64 overflow-hidden">
        <Image src="/team/hero.jpg" alt="FC CX" fill priority sizes="100vw" className="-z-20 object-cover object-[42%_55%]" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black/30 via-transparent to-bg" />
        <Link
          href="/"
          className="absolute top-[max(env(safe-area-inset-top),1rem)] left-4 flex h-10 items-center gap-1 rounded-full bg-black/30 px-3.5 text-sm font-semibold text-white backdrop-blur"
        >
          <ChevronLeft className="size-4" /> Trang đội
        </Link>
      </div>
      <div className="relative z-10 mx-auto -mt-16 w-full max-w-sm px-4 pb-10">
        <div className="rounded-[28px] bg-card p-6 shadow-2xl shadow-black/10">
          <div className="mb-6 flex flex-col items-center text-center">
            <span className="-mt-14 flex size-16 items-center justify-center rounded-3xl bg-brand text-brand-ink shadow-lg shadow-brand/30 ring-4 ring-card">
              <BallIcon className="size-9" />
            </span>
            <h1 className="mt-4 text-xl font-extrabold">Đăng nhập quản trị</h1>
          </div>
          <ActionForm action={login} schema="login" submit="Đăng nhập" submitIcon={<LogIn />} className="space-y-4" submitClassName="w-full">
            <Field label="Mật khẩu" name="password">
              <PasswordInput name="password" autoFocus autoComplete="current-password" />
            </Field>
          </ActionForm>
        </div>
      </div>
    </div>
  );
}
