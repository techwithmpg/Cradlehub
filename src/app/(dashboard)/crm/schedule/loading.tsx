import { Skeleton } from "@/components/ui/skeleton";

export default function CrmScheduleLoading() {
  return (
    <div className="space-y-5 p-5">
      {/* Page header */}
      <div className="space-y-2">
        <Skeleton className="h-6 w-28" />
        <Skeleton className="h-4 w-64" />
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-72 rounded-lg" />
        <Skeleton className="h-9 w-32 rounded-lg" />
        <Skeleton className="h-9 w-32 rounded-lg" />
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>

      {/* Board + side panel */}
      <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 300px" }}>
        {/* Timeline board */}
        <div className="space-y-0 rounded-xl overflow-hidden border border-neutral-200 dark:border-neutral-800">
          {/* Panel header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-200 dark:border-neutral-800">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-6 w-28 rounded-md" />
          </div>
          {/* Time header */}
          <Skeleton className="h-10 w-full rounded-none" />
          {/* Staff rows */}
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="flex border-b border-neutral-100 dark:border-neutral-800/60">
              <Skeleton className="h-14 w-[200px] rounded-none flex-shrink-0" />
              <Skeleton className="h-14 flex-1 rounded-none opacity-40" />
            </div>
          ))}
        </div>

        {/* Details panel */}
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  );
}
