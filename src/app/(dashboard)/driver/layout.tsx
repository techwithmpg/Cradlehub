/**
 * Driver Portal Route Layout
 *
 * Wraps all /driver/* routes with background route warm-up.
 * Nested inside (dashboard)/layout.tsx which renders sidebar, header, and main scroll container.
 */

import { WorkspaceRoutePrefetcher } from "@/components/features/workspace/workspace-route-prefetcher";
import { DRIVER_PREFETCH } from "@/components/features/workspace/workspace-prefetch-config";

export default async function DriverLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* Background route warm-up for Driver workspace */}
      <WorkspaceRoutePrefetcher config={DRIVER_PREFETCH} />
      {children}
    </>
  );
}
