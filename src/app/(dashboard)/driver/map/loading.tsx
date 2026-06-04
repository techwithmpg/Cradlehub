import { Skeleton } from "@/components/ui/skeleton";

export default function DriverMapLoading() {
  return (
    <div className="min-h-dvh bg-[var(--cs-bg)] pb-32 md:bg-transparent">
      <div className="space-y-5 px-5 pt-8">
        <div className="flex items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-2xl" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-8 w-40 rounded-xl" />
            <Skeleton className="h-4 w-36 rounded-xl" />
          </div>
          <Skeleton className="h-12 w-12 rounded-full" />
        </div>
        <div className="grid grid-cols-4 gap-2 rounded-2xl border border-stone-200 bg-white/80 p-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-10 rounded-xl" />
          ))}
        </div>
      </div>
      <Skeleton className="mt-5 h-[420px] w-full rounded-none" />
      <div className="-mt-16 space-y-4 px-5">
        <Skeleton className="h-44 rounded-[1.75rem]" />
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-20 rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
