import { Skeleton } from "@/components/ui/skeleton";

export default function CrmReconciliationLoading() {
  return (
    <div className="space-y-5 p-5">
      <div className="space-y-2">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-60" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-9 w-72 rounded-lg" />
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
        <Skeleton className="h-10 w-full rounded-none" />
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-none border-t border-neutral-100 dark:border-neutral-800/60" />
        ))}
      </div>
    </div>
  );
}
