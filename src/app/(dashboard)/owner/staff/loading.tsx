import { Skeleton } from "@/components/ui/skeleton";

export default function OwnerStaffLoading() {
  return (
    <div className="p-6 space-y-5">
      {/* Search + invite bar */}
      <div className="flex gap-3">
        <Skeleton className="h-9 flex-1 rounded-lg" />
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>
      {/* Staff cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 9 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
