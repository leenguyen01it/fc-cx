import { ButtonSkeleton, ListCardSkeleton, LoadingFrame } from "@/components/ui";

/** Giao dịch: chờ xác nhận, nút ghi tay và lịch sử. */
export default function Loading() {
  return (
    <LoadingFrame className="space-y-3">
      <ListCardSkeleton rows={2} />
      <ButtonSkeleton />
      <ListCardSkeleton rows={6} />
    </LoadingFrame>
  );
}
