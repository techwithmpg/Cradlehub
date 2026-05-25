/**
 * CRM Route Layout — Phase 9F
 *
 * Wraps all /crm/* routes with a global readiness badge that surfaces the
 * current system health status and links to /crm/setup.
 *
 * This layout is nested inside (dashboard)/layout.tsx, which already
 * renders the sidebar, header, and main scroll container.
 * The badge is rendered at the top of the CRM content area.
 *
 * Branch context is resolved via getLayoutStaffContext(), which is
 * React cache()-wrapped — calling it here after (dashboard)/layout.tsx
 * already called it costs no additional DB round-trip.
 *
 * Readiness is loaded failure-safely (.catch(() => null)).
 * If it fails, the badge shows a muted "Review needed" fallback —
 * CRM navigation continues to work normally.
 */

import { getLayoutStaffContext } from "@/lib/queries/staff-context";
import { getCrmReadiness } from "@/lib/queries/crm-readiness";
import { CrmReadinessBadge } from "@/components/features/crm/readiness/crm-readiness-badge";
import { WorkspaceRoutePrefetcher } from "@/components/features/workspace/workspace-route-prefetcher";
import { CRM_PREFETCH } from "@/components/features/workspace/workspace-prefetch-config";

export default async function CrmLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // getLayoutStaffContext is React cache()-wrapped — free within the same request.
  const ctx = await getLayoutStaffContext();
  const branchId = ctx?.me?.branch_id ?? null;

  // Failure-safe: null if branchId missing or query throws.
  const readiness = branchId
    ? await getCrmReadiness(branchId).catch(() => null)
    : null;

  return (
    <>
      {/* Background route warm-up for CRM workspace */}
      <WorkspaceRoutePrefetcher config={CRM_PREFETCH} />

      {/* Badge wrapper: adds mobile padding (main has p-0 on mobile, p-5 on desktop). */}
      <div className="px-4 pt-3 md:px-0 md:pt-0">
        <CrmReadinessBadge readiness={readiness} />
      </div>
      {children}
    </>
  );
}
