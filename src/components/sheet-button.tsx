"use client";

import { useState, type ReactNode } from "react";
import { Sheet } from "./ui";

/** Nút mở sheet chứa form (Ghi tay, Thêm thành viên…). */
export function SheetButton({
  label,
  icon,
  title,
  className,
  children,
}: {
  label: ReactNode;
  icon: ReactNode;
  title: string;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {icon}
        {label}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={title} icon={icon}>
        <div className="pb-2">{children}</div>
      </Sheet>
    </>
  );
}
