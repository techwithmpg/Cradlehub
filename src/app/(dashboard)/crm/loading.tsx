import { CrmLoadingState } from "@/components/features/crm/premium/crm-loading-state";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * /crm root loading state.
 *
 * Structure:
 *   [Page header skeleton]     — orientation
 *   [Premium loader]           — "system is actively loading"
 *   [KPI row shimmer]          — shape of the stats strip below
 *   [Two-column content skeletons] — rough layout hint
 */
export default function CrmDashboardLoading() {
  return (
    <div className="space-y-6">
      {/* Page header skeleton */}
      <div className="space-y-1.5">
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-4 w-60" />
      </div>

      {/* Premium loader + KPI shimmer */}
      <CrmLoadingState
        title="Preparing CRM workspace..."
        subtitle="Loading bookings, staff, services, and today's operations."
        loaderSize="md"
        shimmer="kpi-row"
        cols={4}
      />

      {/* Two-column content skeleton */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          <Skeleton className="h-5 w-40" />
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
        <div className="space-y-3">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-32 rounded-xl" />
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
