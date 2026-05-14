import { Skeleton } from "@/components/ui/skeleton";

export default function StaffScheduleLoading() {
  return (
    <div className="p-6 space-y-5">
      {/* Week navigation */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-9 rounded-lg" />
        <Skeleton className="h-6 w-44" />
        <Skeleton className="h-9 w-9 rounded-lg" />
      </div>
      {/* Day columns header */}
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-10 rounded-lg" />
        ))}
      </div>
      {/* Appointment blocks per day */}
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: 7 }).map((_, col) => (
          <div key={col} className="space-y-2">
            {Array.from({ length: 3 }).map((_, row) => (
              <Skeleton key={row} className="h-16 rounded-xl" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
