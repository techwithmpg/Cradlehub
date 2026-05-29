import { Skeleton } from "@/components/ui/skeleton";

export default function DriverLoading() {
  return (
    <div className="p-6 space-y-6">
      {/* Greeting */}
      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-40" />
      </div>
      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-18 rounded-xl" />
        ))}
      </div>
      {/* Current trip card */}
      <div className="space-y-3">
        <Skeleton className="h-5 w-44" />
        <Skeleton className="h-32 rounded-xl" />
      </div>
      {/* Upcoming trips */}
      <div className="space-y-3">
        <Skeleton className="h-5 w-44" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
