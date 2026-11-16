import { ButtonSkeleton, ListCardSkeleton, LoadingFrame, Skeleton } from "@/components/ui";

/** Vào trang quản trị (đang kiểm tra đăng nhập & đọc cài đặt): khung đầu trang + danh sách trận. */
export default function Loading() {
  return (
    <div className="mx-auto min-h-dvh max-w-3xl pb-28">
      <header className="sticky top-0 z-20 border-b border-line bg-card/85 px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-3 backdrop-blur-xl">
        <div className="flex items-center gap-2.5">
          <Skeleton className="size-9 rounded-2xl" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-14" />
          </div>
        </div>
      </header>
      <main className="px-4 pt-4">
        <LoadingFrame className="space-y-3">
          <ButtonSkeleton />
          <ListCardSkeleton rows={6} square />
        </LoadingFrame>
      </main>
    </div>
  );
}
