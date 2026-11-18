"use client";

import { Download, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { saveMemberCard, type MemberCardInput } from "./member-card-image";
import { btn, cx, toast } from "./ui";

/** Lưu ảnh QR: thẻ cố định (không số tiền) hoặc QR kèm số tiền của khoản đang trả. */
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
            if (r !== "cancelled") toast.success(card.amount ? "Đã lưu ảnh QR" : "Đã lưu thẻ QR");
          } catch {
            toast.error("Không tạo được ảnh, thử lại nhé");
          } finally {
            setBusy(false);
          }
        }}
        className={cx(btn.ghost, "w-full")}
      >
        {busy ? <LoaderCircle className="animate-spin" /> : <Download />}
        {card.amount ? "Lưu ảnh QR (kèm số tiền)" : "Lưu thẻ QR của bạn"}
      </button>
    </div>
  );
}
