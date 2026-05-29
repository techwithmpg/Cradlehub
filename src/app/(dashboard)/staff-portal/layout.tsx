/**
 * Staff Portal Route Layout
 *
 * Wraps all /staff-portal/* routes with background route warm-up.
 * Nested inside (dashboard)/layout.tsx which renders sidebar, header, and main scroll container.
 */

import { WorkspaceRoutePrefetcher } from "@/components/features/workspace/workspace-route-prefetcher";
import { STAFF_PORTAL_PREFETCH } from "@/components/features/workspace/workspace-prefetch-config";

export default async function StaffPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* Background route warm-up for Staff Portal workspace */}
      <WorkspaceRoutePrefetcher config={STAFF_PORTAL_PREFETCH} />
      {children}
    </>
  );
}
