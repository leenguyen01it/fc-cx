"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { cx } from "./base";

let openSheets = 0;

/**
 * Modal dạng "bottom sheet" trên điện thoại, hộp giữa màn hình trên máy tính.
 * Dùng <dialog> gốc: có sẵn focus trap, phím Esc, nằm trên mọi lớp.
 */
export function Sheet({
  open,
  onClose,
  title,
  description,
  icon,
  children,
  footer,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open) {
      if (!d.open) d.showModal();
      // Khoá cuộn trang phía sau; đếm số sheet đang mở để sheet con đóng không mở khoá khi sheet cha còn mở
      openSheets++;
      document.documentElement.style.overflow = "hidden";
      return () => {
        openSheets = Math.max(0, openSheets - 1);
        if (openSheets === 0) document.documentElement.style.overflow = "";
      };
    }
    if (d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="sheet m-0 mt-auto w-full sm:m-auto sm:w-[28rem]"
      // Sheet lồng nhau (VD ô chọn trong popup "Tạo trận"): sự kiện close/cancel của sheet con
      // lan lên sheet cha qua cây React → chỉ xử lý khi sự kiện là của chính sheet này.
      onClose={(e) => {
        if (e.target !== e.currentTarget) return;
        if (open) onClose();
      }}
      onCancel={(e) => {
        if (e.target !== e.currentTarget) return;
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div
        className={cx(
          "sheet-panel flex max-h-[88dvh] flex-col rounded-t-[28px] bg-card shadow-2xl sm:rounded-[28px]",
          className,
        )}
      >
        <div className="flex justify-center pt-2.5 sm:hidden">
          <span className="h-1.5 w-10 rounded-full bg-line" />
        </div>
        {(title || description) && (
          <div className="flex items-start gap-3 px-5 pt-3 pb-3 sm:pt-5">
            {icon && (
              <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand [&>svg]:size-5">
                {icon}
              </span>
            )}
            <div className="min-w-0 flex-1">
              {title && <h2 className="text-lg leading-tight font-bold">{title}</h2>}
              {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng"
              className="-mt-1 -mr-1 flex size-9 shrink-0 items-center justify-center rounded-full bg-card-2 text-muted active:scale-95"
            >
              <X className="size-5" />
            </button>
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4">{children}</div>
        {footer && (
          <div className="border-t border-line px-5 pt-3 pb-[max(env(safe-area-inset-bottom),1rem)]">{footer}</div>
        )}
        {!footer && <div className="pb-[env(safe-area-inset-bottom)]" />}
      </div>
    </dialog>
  );
}
