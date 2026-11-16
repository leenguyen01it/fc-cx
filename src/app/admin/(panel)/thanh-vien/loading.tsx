import { ButtonSkeleton, ListCardSkeleton, LoadingFrame } from "@/components/ui";

/** Thành viên: nút thêm người và danh sách. */
export default function Loading() {
  return (
    <LoadingFrame className="space-y-3">
      <ButtonSkeleton />
      <ListCardSkeleton rows={8} />
    </LoadingFrame>
  );
}
