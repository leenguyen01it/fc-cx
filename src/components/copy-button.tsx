"use client";

import { Check, Copy } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cx, toast } from "./ui";

export function CopyButton({
  text,
  label,
  className,
  icon,
  toastMessage = "Đã copy",
  ariaLabel,
}: {
  text: string;
  label?: ReactNode;
  className?: string;
  icon?: ReactNode;
  toastMessage?: string;
  ariaLabel?: string;
}) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Trình duyệt cũ / không có quyền clipboard
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    toast.success(toastMessage);
    setTimeout(() => setCopied(false), 1600);
  }
  return (
    <button type="button" onClick={copy} aria-label={ariaLabel ?? (typeof label === "string" ? label : "Copy")} className={cx(className)}>
      {copied ? <Check className="text-paid" /> : (icon ?? <Copy />)}
      {label}
    </button>
  );
}
