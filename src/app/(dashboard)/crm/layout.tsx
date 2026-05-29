/**
 * CRM Route Layout — Phase 9F
 *
 * Wraps all /crm/* routes with background route warm-up.
 *
 * This layout is nested inside (dashboard)/layout.tsx, which already
 * renders the sidebar, header, and main scroll container.
 * The header now shows the global readiness indicator via
 * WorkspaceReadinessIndicator (rendered in Header from dashboard layout).
 *
 * Branch context is resolved via getLayoutStaffContext(), which is
 * React cache()-wrapped — calling it here after (dashboard)/layout.tsx
 * already called it costs no additional DB round-trip.
 */

import { WorkspaceRoutePrefetcher } from "@/components/features/workspace/workspace-route-prefetcher";
import { CRM_PREFETCH } from "@/components/features/workspace/workspace-prefetch-config";

export default async function CrmLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* Background route warm-up for CRM workspace */}
      <WorkspaceRoutePrefetcher config={CRM_PREFETCH} />
      {children}
    </>
  );
}
