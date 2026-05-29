import { Skeleton } from "@/components/ui/skeleton";

export default function StaffStatsLoading() {
  return (
    <div className="p-6 space-y-6">
      <Skeleton className="h-7 w-40" />
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      <div className="space-y-3">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    </div>
  );
}
