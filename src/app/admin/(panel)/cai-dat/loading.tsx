import { FormCardSkeleton, LoadingFrame } from "@/components/ui";

/** Cài đặt: thông tin đội & tài khoản, mặc định khi tạo trận. */
export default function Loading() {
  return (
    <LoadingFrame className="space-y-3">
      <FormCardSkeleton fields={5} />
      <FormCardSkeleton fields={2} />
    </LoadingFrame>
  );
}
