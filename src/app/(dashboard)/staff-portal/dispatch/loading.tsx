import { Skeleton } from "@/components/ui/skeleton";

export default function StaffDispatchLoading() {
  return (
    <div className="p-6 space-y-6">
      <Skeleton className="h-7 w-48" />
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
