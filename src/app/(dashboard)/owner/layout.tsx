/**
 * Owner Route Layout
 *
 * Guards the restored Owner workspace and warms up nearby Owner routes.
 * Nested inside (dashboard)/layout.tsx which renders the shared shell.
 */

import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { WorkspaceRoutePrefetcher } from "@/components/features/workspace/workspace-route-prefetcher";
import { OWNER_PREFETCH } from "@/components/features/workspace/workspace-prefetch-config";
import { getCurrentUserWorkspaceAccess } from "@/lib/auth/get-user-workspace-access";
import { getWorkspaceSwitchDestination, hasWorkspaceAccess } from "@/lib/auth/workspace-access";

export default async function OwnerLayout({ children }: { children: ReactNode }) {
  const access = await getCurrentUserWorkspaceAccess();

  if (!access) redirect("/login");

  if (!hasWorkspaceAccess(access.workspaces, "owner")) {
    redirect(getWorkspaceSwitchDestination(access.workspaces));
  }

  return (
    <>
      <WorkspaceRoutePrefetcher config={OWNER_PREFETCH} />
      {children}
    </>
  );
}
