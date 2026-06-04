import { Skeleton } from "@/components/ui/skeleton";

export default function DriverDispatchLoading() {
  return (
    <div className="min-h-dvh space-y-5 bg-[var(--cs-bg)] px-5 pb-32 pt-8 md:bg-transparent">
      <Skeleton className="h-10 w-32 rounded-2xl" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-11 rounded-2xl" />
        <Skeleton className="h-11 rounded-2xl" />
      </div>
      <div className="grid grid-cols-4 rounded-2xl border border-stone-200 bg-white/80 p-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="mx-auto h-12 w-12 rounded-xl" />
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-32 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
