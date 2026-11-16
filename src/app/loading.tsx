import Image from "next/image";
import { Card, ListCardSkeleton, LoadingFrame, Skeleton } from "@/components/ui";

/** Trang đội: ảnh đầu trang hiện ngay, phần dữ liệu là khung chờ. */
export default function Loading() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col pb-28">
      <header className="pitch relative isolate min-h-[21rem] overflow-hidden sm:rounded-b-[32px]">
        <Image
          src="/team/hero.jpg"
          alt=""
          fill
          priority
          sizes="(max-width: 672px) 100vw, 672px"
          className="-z-20 object-cover object-[42%_55%]"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black/50 via-black/0 via-45% to-brand" />
      </header>
      <main className="flex-1 px-4 pt-4">
        <LoadingFrame className="space-y-3">
          <Skeleton className="h-11 w-full rounded-2xl" />
          <Card className="space-y-3 p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="size-11 rounded-full" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-14 w-full rounded-2xl" />
          </Card>
          <Card className="space-y-3 p-4">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-2.5 w-full rounded-full" />
          </Card>
          <ListCardSkeleton rows={5} />
        </LoadingFrame>
      </main>
    </div>
  );
}
