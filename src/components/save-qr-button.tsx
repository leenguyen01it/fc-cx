"use client";

import { Download, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { saveMemberCard, type MemberCardInput } from "./member-card-image";
import { btn, cx, toast } from "./ui";

/** Lưu thẻ QR cố định (không kèm số tiền) – giống hệt ảnh ở trang cá nhân. */
export function SaveQrButton({ card, className }: { card: MemberCardInput; className?: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className={cx("mt-3", className)}>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const r = await saveMemberCard(card);
            if (r !== "cancelled") toast.success("Đã lưu thẻ QR");
          } catch {
            toast.error("Không tạo được ảnh, thử lại nhé");
          } finally {
            setBusy(false);
          }
        }}
        className={cx(btn.ghost, "w-full")}
      >
        {busy ? <LoaderCircle className="animate-spin" /> : <Download />}
        Lưu thẻ QR của bạn
      </button>
    </div>
  );
}
