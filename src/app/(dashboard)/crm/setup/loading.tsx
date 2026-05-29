import { Skeleton } from "@/components/ui/skeleton";

export default function CrmSetupLoading() {
  return (
    <div className="p-6 space-y-6">
      {/* Page title */}
      <Skeleton className="h-7 w-56" />
      {/* Progress ring + summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Skeleton className="h-48 rounded-xl" />
        <div className="lg:col-span-2 space-y-3">
          <Skeleton className="h-5 w-40" />
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </div>
      </div>
      {/* Setup sections */}
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, sectionIdx) => (
          <div key={sectionIdx} className="space-y-2">
            <Skeleton className="h-5 w-32" />
            {Array.from({ length: 3 }).map((_, rowIdx) => (
              <Skeleton key={rowIdx} className="h-12 rounded-lg" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
