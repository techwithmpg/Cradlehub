import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getCurrentUserWorkspaceAccess } from "@/lib/auth/get-user-workspace-access";
import { getWorkspaceSwitchDestination, hasWorkspaceAccess } from "@/lib/auth/workspace-access";
import { getAllBranches } from "@/lib/queries/branches";

/** Request-local only; authorization is checked before the cookie-authenticated/RLS read. */
export const getOwnerScopeBranches = cache(async () => {
  const access = await getCurrentUserWorkspaceAccess();
  if (!access) redirect("/login");
  if (!hasWorkspaceAccess(access.workspaces, "owner")) redirect(getWorkspaceSwitchDestination(access.workspaces));
  return (await getAllBranches()).filter((branch) => branch.is_active !== false)
    .map(({ id, name, sort_order }) => ({ id, name, sort_order }));
});
