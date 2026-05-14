import { Skeleton } from "@/components/ui/skeleton";

export default function ManagerSettingsLoading() {
  return (
    <div className="p-6 space-y-8 max-w-2xl">
      {/* Section */}
      {Array.from({ length: 3 }).map((_, s) => (
        <div key={s} className="space-y-4">
          <Skeleton className="h-5 w-44" />
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-10 w-full rounded-lg" />
              </div>
            ))}
          </div>
        </div>
      ))}
      <Skeleton className="h-10 w-32 rounded-lg" />
    </div>
  );
}
