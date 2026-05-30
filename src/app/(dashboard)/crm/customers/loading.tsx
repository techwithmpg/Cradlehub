import { CrmLoadingShimmer } from "@/components/features/crm/premium/crm-loading-shimmer";
import { CrmPremiumLoader } from "@/components/features/crm/premium/crm-premium-loader";

/**
 * /crm/customers loading state.
 *
 * Structure (top → bottom):
 *   [Header skeleton]       — page title + description
 *   [Tab bar skeleton]      — four tabs
 *   [KPI shimmer row]       — five metric cards
 *   [Small premium loader]  — "active data preparation" signal
 *   [Table shimmer]         — row structure hint
 *
 * Users see two signals:
 *   Skeleton = page structure is coming
 *   Loader   = system is actively preparing records
 */
export default function CrmCustomersLoading() {
  return (
    <div className="space-y-5">
      {/* Page header skeleton */}
      <div className="space-y-1.5">
        <div className="crm-shimmer-wrap h-6 w-28 rounded-md" />
        <div className="crm-shimmer-wrap h-4 w-52 rounded-md" />
      </div>

      {/* Tab bar skeleton */}
      <div className="flex items-end gap-0 border-b border-[var(--cs-border-soft)]">
        <div className="crm-shimmer-wrap h-9 w-28 rounded-t-md" />
        <div className="crm-shimmer-wrap h-9 w-24 rounded-t-md" />
        <div className="crm-shimmer-wrap h-9 w-24 rounded-t-md" />
        <div className="crm-shimmer-wrap h-9 w-32 rounded-t-md" />
      </div>

      {/* KPI row skeleton */}
      <CrmLoadingShimmer variant="kpi-row" cols={5} />

      {/* Toolbar skeleton */}
      <div className="flex gap-3">
        <div className="crm-shimmer-wrap h-9 w-72 max-w-sm flex-1 rounded-lg" />
        <div className="crm-shimmer-wrap h-9 w-20 rounded-lg" />
        <div className="crm-shimmer-wrap h-9 w-20 rounded-lg" />
      </div>

      {/* Small premium loader – sits between structure and table */}
      <div className="flex items-center justify-center py-2">
        <CrmPremiumLoader
          title="Loading customers..."
          subtitle="Preparing customer records and history."
          size="sm"
        />
      </div>

      {/* Table skeleton */}
      <CrmLoadingShimmer variant="table" rows={8} />
    </div>
  );
}
