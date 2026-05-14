import { Skeleton } from "@/components/ui/skeleton";

export default function ManagerScheduleLoading() {
  return (
    <div className="p-6 space-y-5">
      {/* Date nav */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-9 rounded-lg" />
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-9 w-9 rounded-lg" />
        <Skeleton className="h-9 w-24 rounded-lg ml-auto" />
      </div>
      {/* Timeline header */}
      <div className="flex gap-2">
        <Skeleton className="h-8 w-20 rounded" />
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-8 flex-1 rounded" />
        ))}
      </div>
      {/* Timeline rows */}
      <div className="space-y-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex gap-2 items-center">
            <Skeleton className="h-14 w-20 rounded" />
            <Skeleton className="h-14 flex-1 rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
}
