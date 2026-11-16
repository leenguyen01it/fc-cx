import { Card, CardHeaderSkeleton, FormCardSkeleton, ListCardSkeleton, LoadingFrame } from "@/components/ui";

/** Sửa trận: thông tin trận, đội hình, chi phí. */
export default function Loading() {
  return (
    <LoadingFrame className="space-y-3">
      <Card>
        <CardHeaderSkeleton right />
      </Card>
      <ListCardSkeleton rows={6} />
      <FormCardSkeleton fields={2} />
    </LoadingFrame>
  );
}
