export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUserWorkspaceAccess } from "@/lib/auth/get-user-workspace-access";
import { getWorkspaceSwitchDestination, hasWorkspaceAccess } from "@/lib/auth/workspace-access";
import { getLayoutStaffContext } from "@/lib/queries/staff-context";
import { RetainedWorkspaceModule } from "@/components/features/dashboard/retained-workspace-provider";
import { HomeServiceDispatchWorkspace } from "@/components/features/dispatch/dispatch-workspace";
import { getDispatchData } from "@/lib/queries/dispatch-queries";
import { logInfo } from "@/lib/logger";

export const metadata: Metadata = { title: "Home Service Operations — Owner" };

export default async function OwnerDispatchPage() {
  const [access, ctx] = await Promise.all([
    getCurrentUserWorkspaceAccess(),
    getLayoutStaffContext(),
  ]);
  if (!access) redirect("/login");
  if (!hasWorkspaceAccess(access.workspaces, "owner")) {
    redirect(getWorkspaceSwitchDestination(access.workspaces));
  }

  const me = ctx?.me;
  if (!me || me.system_role !== "owner" || !me.branch_id) redirect("/login");

  const today = new Date().toISOString().split("T")[0]!;
  const data = await getDispatchData({ branchId: me.branch_id, date: today });

  logInfo("dispatch.queue.loaded", {
    role: "owner",
    branchId: me.branch_id,
    date: today,
    count: data.items.length,
  });

  return (
    <RetainedWorkspaceModule moduleId="owner-dispatch">
      <HomeServiceDispatchWorkspace role="owner" data={data} />
    </RetainedWorkspaceModule>
  );
}
