import { Card, ListCardSkeleton, LoadingFrame, Skeleton } from "@/components/ui";

/** Thẻ cá nhân: tên, số tiền cần đóng, mã QR và lịch sử các trận. */
export default function Loading() {
  return (
    <div className="mx-auto min-h-dvh max-w-md px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-10">
      <LoadingFrame className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-32 rounded-full" />
          <Skeleton className="h-10 w-28 rounded-full" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="size-14 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-28" />
          </div>
        </div>
        <Card className="space-y-3 p-4">
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-12 w-full rounded-2xl" />
        </Card>
        <Card className="flex justify-center p-6">
          <Skeleton className="aspect-square w-56 rounded-2xl" />
        </Card>
        <ListCardSkeleton rows={4} />
      </LoadingFrame>
    </div>
  );
}
