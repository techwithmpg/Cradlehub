import { Skeleton } from "@/components/ui/skeleton";

export default function ManagerBookingsLoading() {
  return (
    <div className="p-6 space-y-5">
      {/* Filter bar */}
      <div className="flex gap-3 flex-wrap">
        <Skeleton className="h-9 w-32 rounded-lg" />
        <Skeleton className="h-9 w-28 rounded-lg" />
        <Skeleton className="h-9 w-28 rounded-lg" />
        <Skeleton className="h-9 w-24 rounded-lg ml-auto" />
      </div>
      {/* Table rows */}
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-xl w-full" />
        ))}
      </div>
    </div>
  );
}
