import { redirect } from "next/navigation";
import { getCurrentUserWorkspaceAccess } from "@/lib/auth/get-user-workspace-access";
import { getLegacyUtilityDestination } from "@/lib/auth/workspace-access";

/**
 * Compatibility entry point for legacy Utility links and saved bookmarks.
 * The Staff PWA owns the actual Utility workspace at /staff/utility.
 * Workspace resolution is server-authorized; administrative roles must not
 * cross into the Staff PWA just because they could see the old placeholder.
 */
export default async function LegacyUtilityPage() {
  const access = await getCurrentUserWorkspaceAccess();
  if (!access) redirect("/login");
  redirect(getLegacyUtilityDestination(access.workspaces));
}
