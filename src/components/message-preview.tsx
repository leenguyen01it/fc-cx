"use client";

import { Copy, MessageCircle } from "lucide-react";
import { useState, type ReactNode } from "react";
import { CopyButton } from "./copy-button";
import { btn, cx, Sheet } from "./ui";

/** Nút mở xem trước tin nhắn Zalo, có nút Copy. */
export function MessagePreview({
  text,
  title,
  trigger,
  triggerClassName,
  toastMessage = "Đã copy – dán vào nhóm Zalo",
}: {
  text: string;
  title: string;
  trigger: ReactNode;
  triggerClassName?: string;
  toastMessage?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={triggerClassName}>
        {trigger}
      </button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        icon={<MessageCircle />}
        footer={
          <CopyButton
            text={text}
            label="Copy"
            icon={<Copy />}
            toastMessage={toastMessage}
            className={cx(btn.primary, "w-full")}
          />
        }
      >
        <div className="rounded-2xl rounded-tl-md bg-team-b-soft p-4">
          <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words text-ink">{text}</p>
        </div>
      </Sheet>
    </>
  );
}
