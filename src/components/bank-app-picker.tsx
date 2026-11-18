"use client";

import { ExternalLink, Search, Smartphone } from "lucide-react";
import Image from "next/image";
import { useMemo, useState } from "react";
import { BANK_APPS, type BankApp } from "@/lib/bank-apps";
import { bankAppDeeplink } from "@/lib/vietqr";
import { stripDiacritics } from "@/lib/text";
import type { BankInfo } from "./pay-dialog";
import { btn, cx, Sheet, toast } from "./ui";

const PREF_KEY = "ttb:bank-app";

function readPref(): string | null {
  try {
    return localStorage.getItem(PREF_KEY);
  } catch {
    return null;
  }
}

function platform(): "ios" | "android" | "other" {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "other";
}

/**
 * Nút "Mở app ngân hàng": chọn app → mở thẳng app qua deeplink VietQR.
 * App có autofill điền sẵn STK, số tiền, nội dung; app khác chỉ mở lên → copy sẵn nội dung để dán.
 */
export function BankAppPicker({ bank, amount, content }: { bank: BankInfo; amount: number; content: string }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [os, setOs] = useState<"ios" | "android" | "other">("other");
  const [pref, setPref] = useState<string | null>(null);

  const apps = useMemo(() => {
    const list = BANK_APPS.filter((a) => (os === "ios" ? a.ios : os === "android" ? a.android : true));
    const n = stripDiacritics(q.trim()).toLowerCase();
    return n ? list.filter((a) => stripDiacritics(a.name).toLowerCase().includes(n)) : list;
  }, [os, q]);
  const preferred = pref ? BANK_APPS.find((a) => a.id === pref) : undefined;
  const autofill = apps.filter((a) => a.autofill);
  const others = apps.filter((a) => !a.autofill);

  async function launch(app: BankApp) {
    const link = bankAppDeeplink({
      app: app.id,
      bankBin: bank.bankBin,
      accountNo: bank.accountNo,
      amount,
      content,
      returnUrl: window.location.href,
    });
    if (!link) return toast.error("Ngân hàng của đội chưa hỗ trợ mở app");
    try {
      localStorage.setItem(PREF_KEY, app.id);
    } catch {}
    if (!app.autofill) {
      // App không tự điền → copy sẵn nội dung để người dùng dán
      try {
        await navigator.clipboard.writeText(content);
        toast.success("Đã copy nội dung chuyển khoản");
      } catch {}
    }
    window.location.href = link;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOs(platform());
          setPref(readPref());
          setOpen(true);
        }}
        className={cx(btn.primary, "w-full")}
      >
        <Smartphone /> Mở app ngân hàng
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title="Chọn app ngân hàng" icon={<Smartphone />}>
        {preferred && !q && (
          <button
            type="button"
            onClick={() => launch(preferred)}
            className="mb-4 flex w-full items-center gap-3 rounded-2xl border-2 border-brand bg-brand-soft p-3 text-left active:scale-[0.99]"
          >
            <AppIcon app={preferred} size={48} />
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-semibold text-brand">App bạn dùng lần trước</span>
              <span className="block truncate font-bold">{preferred.name}</span>
            </span>
            <ExternalLink className="size-5 text-brand" />
          </button>
        )}
        <label className="mb-4 flex h-11 items-center gap-2 rounded-2xl bg-card-2 px-3.5">
          <Search className="size-[18px] text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm ngân hàng…"
            className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted/70"
          />
        </label>

        <Grid apps={[...autofill, ...others]} onPick={launch} />
        {apps.length === 0 && <p className="py-8 text-center text-sm text-muted">Không tìm thấy “{q}”</p>}
      </Sheet>
    </>
  );
}


function Grid({ apps, onPick }: { apps: BankApp[]; onPick: (a: BankApp) => void }) {
  return (
    <ul className="grid grid-cols-4 gap-x-2 gap-y-3">
      {apps.map((a) => (
        <li key={a.id}>
          <button
            type="button"
            onClick={() => onPick(a)}
            className="flex w-full flex-col items-center gap-1.5 rounded-2xl p-1 active:scale-95 active:bg-card-2"
          >
            <AppIcon app={a} size={52} />
            <span className="line-clamp-2 text-center text-[11px] leading-tight font-medium">{a.name}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function AppIcon({ app, size }: { app: BankApp; size: number }) {
  return (
    <Image
      src={`/bank-apps/${app.id}.png`}
      alt=""
      width={size}
      height={size}
      className="shrink-0 rounded-[14px] border border-line bg-white object-cover"
      style={{ width: size, height: size }}
    />
  );
}
