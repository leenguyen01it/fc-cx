"use client";

import { useEffect, useState } from "react";
import { MAX_CONTENT } from "@/lib/vietqr";
import { MAX_CODE } from "@/lib/schemas";
import { stripDiacritics } from "@/lib/text";
import { cx } from "@/components/ui";

/** Xem trước nội dung chuyển khoản khi gõ mã đội / phần thêm, kèm số ký tự so với giới hạn 25 của QR. */
export function TransferPreview() {
  const [v, setV] = useState({ prefix: "", suffix: "" });
  useEffect(() => {
    const prefix = document.querySelector<HTMLInputElement>('input[name="prefix"]:not([type=hidden])');
    const suffix = document.querySelector<HTMLInputElement>('input[name="transferSuffix"]:not([type=hidden])');
    const read = () => setV({ prefix: prefix?.value ?? "", suffix: suffix?.value ?? "" });
    read();
    prefix?.addEventListener("input", read);
    suffix?.addEventListener("input", read);
    return () => {
      prefix?.removeEventListener("input", read);
      suffix?.removeEventListener("input", read);
    };
  }, []);
  const clean = (s: string) => stripDiacritics(s).replace(/[^A-Za-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
  const sample = [clean(v.prefix).toUpperCase(), "HUNG", clean(v.suffix)].filter(Boolean).join(" ");
  const worst = clean(v.prefix).length + 1 + MAX_CODE + (clean(v.suffix) ? 1 + clean(v.suffix).length : 0);
  const over = worst > MAX_CONTENT;
  return (
    <span className="block">
      VD: <b className="font-mono text-ink">{sample}</b>
      <span className={cx("ml-2 tabular", over ? "font-semibold text-team-a" : "text-muted")}>
        · tối đa {worst}/{MAX_CONTENT} ký tự
      </span>
    </span>
  );
}
