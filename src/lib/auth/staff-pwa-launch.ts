import type { StaffPwaOperationalGroup, WorkspaceAccess } from "./workspace-access";

/** An installed Staff app opens its own workspace only after server-verified access. */
export function getStaffPwaLaunchDestination(
  workspaces: readonly WorkspaceAccess[],
  group: StaffPwaOperationalGroup | null
): "/staff/" | null {
  if (!group) return null;
  const requiredWorkspace =
    group === "driver" ? "driver" : group === "utility" ? "utility" : "staff_portal";
  return workspaces.some((workspace) => workspace.key === requiredWorkspace) ? "/staff/" : null;
}
