import { Skeleton } from "@/components/ui/skeleton";

export default function CrmBookingsLoading() {
  return (
    <div className="p-6 space-y-5">
      {/* Search + filter bar */}
      <div className="flex gap-3 flex-wrap">
        <Skeleton className="h-9 w-48 rounded-lg" />
        <Skeleton className="h-9 w-28 rounded-lg" />
        <Skeleton className="h-9 w-28 rounded-lg" />
        <Skeleton className="h-9 w-24 rounded-lg ml-auto" />
      </div>
      {/* Booking rows */}
      <div className="space-y-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-xl w-full" />
        ))}
      </div>
    </div>
  );
}
