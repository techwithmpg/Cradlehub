import { Skeleton } from "@/components/ui/skeleton";

export default function OwnerScheduleLoading() {
  return (
    <div className="space-y-5 p-5">
      <div className="space-y-2">
        <Skeleton className="h-6 w-28" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-72 rounded-lg" />
        <Skeleton className="h-9 w-36 rounded-lg" />
        <Skeleton className="h-9 w-32 rounded-lg" />
      </div>
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
      <div className="rounded-xl overflow-hidden border border-neutral-200 dark:border-neutral-800">
        <Skeleton className="h-10 w-full rounded-none" />
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex border-b border-neutral-100 dark:border-neutral-800/60">
            <Skeleton className="h-14 w-[200px] rounded-none flex-shrink-0" />
            <Skeleton className="h-14 flex-1 rounded-none opacity-40" />
          </div>
        ))}
      </div>
    </div>
  );
}
