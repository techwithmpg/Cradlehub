import { Skeleton } from "@/components/ui/skeleton";

export default function StaffWeekLoading() {
  return (
    <div className="p-6 space-y-6">
      <Skeleton className="h-7 w-40" />
      {/* Week nav */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-9 w-9 rounded-lg" />
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-9 w-9 rounded-lg" />
      </div>
      {/* Day columns */}
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-6 rounded" />
            {Array.from({ length: 2 }).map((_, j) => (
              <Skeleton key={j} className="h-16 rounded-lg" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
