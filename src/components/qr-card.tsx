"use client";

import { Download } from "lucide-react";
import { useState } from "react";
import { VietQrFrame } from "./qr-image";
import { saveMemberCard } from "./member-card-image";
import { BallIcon, btn, cx, toast } from "./ui";

export interface QrCardProps {
  teamName: string;
  name: string;
  content: string;
  payload: string | null;
  bankBin: string;
  bankName: string;
  accountNo: string;
  accountName: string;
}

/** Thẻ QR cố định của thành viên: lưu một lần, dùng mãi. */
export function QrCard(p: QrCardProps) {
  const [saving, setSaving] = useState(false);

  async function download() {
    if (!p.payload) return;
    setSaving(true);
    try {
      const r = await saveMemberCard(p);
      if (r !== "cancelled") toast.success("Đã lưu thẻ QR");
    } catch {
      toast.error("Không tạo được ảnh, thử lại nhé");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="pitch overflow-hidden rounded-3xl p-5 text-center text-white shadow-lg">
      <p className="flex items-center justify-center gap-1.5 text-sm font-extrabold tracking-wide">
        <BallIcon className="size-4" />
        {p.teamName.toUpperCase()}
      </p>
      <p className="mt-1 text-2xl font-extrabold">{p.name}</p>

      {p.payload ? (
        <div className="mx-auto mt-4 max-w-80 rounded-3xl bg-white pb-4 text-slate-900">
          <VietQrFrame payload={p.payload} bankBin={p.bankBin} bankName={p.bankName} alt={`Thẻ QR ${p.content}`} className="border-0" />
          <p className="text-sm font-bold">
            {p.bankName} · <span className="font-mono">{p.accountNo}</span>
          </p>
          <p className="text-xs text-slate-500">{p.accountName}</p>
          <p className="mx-4 mt-2 rounded-xl bg-orange-50 px-2 py-1.5 font-mono text-base font-extrabold text-orange-700">
            {p.content}
          </p>
        </div>
      ) : (
        <div className="mx-auto mt-4 flex aspect-square max-w-72 items-center justify-center rounded-3xl bg-white p-6 text-sm text-amber-700">
          Admin chưa cấu hình tài khoản ngân hàng
        </div>
      )}

      <button
        type="button"
        onClick={download}
        disabled={!p.payload || saving}
        className={cx(btn.primary, "mt-4 w-full bg-white text-orange-700")}
      >
        <Download />
        {saving ? "Đang tạo ảnh…" : "Lưu thẻ QR vào máy"}
      </button>
    </div>
  );
}
