import type { HTMLAttributes, ReactNode } from "react";
import { Card, cx } from "./base";

/** Khối xám nhấp nháy giữ chỗ cho nội dung đang tải. */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("max-w-full animate-pulse rounded-lg bg-ink/[0.07]", className)} {...props} />;
}

/** Vỏ chung của khung chờ: chỉ hiện khi tải quá 150ms để trang nhanh không bị chớp. */
export function LoadingFrame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    // data-route-loading: thanh tiến trình trên đỉnh trang chạy tới khi khung chờ này biến mất
    <div role="status" aria-live="polite" data-route-loading="" className={cx("animate-fade-delayed", className)}>
      <span className="sr-only">Đang tải</span>
      {children}
    </div>
  );
}

/** Giữ chỗ cho CardHeader: biểu tượng + tiêu đề + dòng phụ. */
export function CardHeaderSkeleton({ right = false }: { right?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-3">
      <div className="flex items-center gap-2.5">
        <Skeleton className="size-9 rounded-xl" />
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
      {right && <Skeleton className="h-6 w-20 rounded-full" />}
    </div>
  );
}

/** Thẻ danh sách: mỗi dòng có ảnh đại diện, 2 dòng chữ và một nhãn bên phải. */
export function ListCardSkeleton({ rows = 5, square = false }: { rows?: number; square?: boolean }) {
  return (
    <Card>
      <CardHeaderSkeleton right />
      <div className="divide-y divide-line">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex min-h-16 items-center gap-3 px-4 py-2">
            <Skeleton className={cx("size-11 shrink-0", square ? "rounded-2xl" : "rounded-full")} />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="h-3 w-3/5" />
            </div>
            <Skeleton className="h-7 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </Card>
  );
}

/** Thẻ biểu mẫu: tiêu đề và vài ô nhập. */
export function FormCardSkeleton({ fields = 3 }: { fields?: number }) {
  return (
    <Card>
      <CardHeaderSkeleton />
      <div className="space-y-4 px-4 pb-4">
        {Array.from({ length: fields }, (_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-12 w-full rounded-2xl" />
          </div>
        ))}
      </div>
    </Card>
  );
}

/** Nút to (h-12) chiếm cả chiều ngang, VD "Tạo trận". */
export function ButtonSkeleton() {
  return <Skeleton className="h-12 w-full rounded-2xl" />;
}
