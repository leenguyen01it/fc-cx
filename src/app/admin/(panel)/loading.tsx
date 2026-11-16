import { ButtonSkeleton, ListCardSkeleton, LoadingFrame } from "@/components/ui";

/** Danh sách trận: nút "Tạo trận" và các trận theo ngày. */
export default function Loading() {
  return (
    <LoadingFrame className="space-y-3">
      <ButtonSkeleton />
      <ListCardSkeleton rows={6} square />
    </LoadingFrame>
  );
}
