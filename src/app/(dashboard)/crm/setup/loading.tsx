import { CrmLoadingState } from "@/components/features/crm/premium/crm-loading-state";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * /crm/setup loading state.
 *
 * Structure:
 *   [Page header skeleton]     — orientation
 *   [Premium loader]           — "system is actively scanning"
 *   [Card-grid shimmer]        — shape of the setup health tiles below
 */
export default function CrmSetupLoading() {
  return (
    <div className="space-y-6">
      {/* Page header skeleton */}
      <div className="space-y-1.5">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>

      {/* Premium loader + card-grid shimmer */}
      <CrmLoadingState
        title="Checking setup readiness..."
        subtitle="Scanning services, staff, schedules, and booking rules."
        loaderSize="md"
        shimmer="card-grid"
        cols={4}
      />
    </div>
  );
}
