"use client";

import { TriangleAlert } from "lucide-react";
import { useState, useTransition, type ReactNode } from "react";
import { btn, cx } from "./base";
import { Sheet } from "./sheet";
import { toast } from "./toast";

/**
 * Nút có bước xác nhận (thay cho window.confirm): bấm → mở sheet hỏi lại → chạy action.
 */
export function ConfirmButton({
  children,
  className,
  title,
  description,
  confirmLabel = "Xác nhận",
  tone = "danger",
  onConfirm,
  successMessage,
  icon,
  ariaLabel,
}: {
  ariaLabel?: string;
  children: ReactNode;
  className?: string;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  tone?: "danger" | "primary";
  onConfirm: () => Promise<unknown> | unknown;
  successMessage?: string;
  icon?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  return (
    <>
      <button type="button" aria-label={ariaLabel} className={className} onClick={() => setOpen(true)}>
        {children}
      </button>
      <Sheet
        open={open}
        onClose={() => !pending && setOpen(false)}
        title={title}
        description={description}
        icon={icon ?? <TriangleAlert />}
        footer={
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className={btn.ghost} disabled={pending} onClick={() => setOpen(false)}>
              Huỷ
            </button>
            <button
              type="button"
              disabled={pending}
              className={cx(tone === "danger" ? btn.danger : btn.primary)}
              onClick={() =>
                start(async () => {
                  try {
                    await onConfirm();
                    if (successMessage) toast.success(successMessage);
                    setOpen(false);
                  } catch (e) {
                    // redirect() của Next ném lỗi đặc biệt – để nó đi tiếp
                    if (e && typeof e === "object" && "digest" in e) throw e;
                    toast.error("Có lỗi xảy ra, thử lại nhé");
                  }
                })
              }
            >
              {pending ? "Đang xử lý…" : confirmLabel}
            </button>
          </div>
        }
      >
        <span />
      </Sheet>
    </>
  );
}
