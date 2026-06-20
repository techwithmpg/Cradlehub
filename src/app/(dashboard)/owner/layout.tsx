import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { WorkspaceRoutePrefetcher } from "@/components/features/workspace/workspace-route-prefetcher";
import { OWNER_PREFETCH } from "@/components/features/workspace/workspace-prefetch-config";
import { getCurrentUserWorkspaceAccess } from "@/lib/auth/get-user-workspace-access";
import { getWorkspaceSwitchDestination, hasWorkspaceAccess } from "@/lib/auth/workspace-access";
import { getLayoutStaffContext } from "@/lib/queries/staff-context";
import { isDevAuthBypassEnabled, getDevBypassLayoutStaff } from "@/lib/dev-bypass";
import { isWorkspaceEnabled } from "@/lib/agents/config";
import { AgentCoachProvider } from "@/components/agent/agent-context-provider";
import { CoachBubble } from "@/components/agent/coach-bubble";
import { InlineTip } from "@/components/agent/inline-tip";

export default async function OwnerLayout({ children }: { children: ReactNode }) {
  const access = await getCurrentUserWorkspaceAccess();

  if (!access) redirect("/login");

  if (!hasWorkspaceAccess(access.workspaces, "owner")) {
    redirect(getWorkspaceSwitchDestination(access.workspaces));
  }

  const ctx = await getLayoutStaffContext();
  const me = ctx?.me ?? (isDevAuthBypassEnabled() ? getDevBypassLayoutStaff() : null);
  const coachEnabled = isWorkspaceEnabled("owner");
  const canShowCoach = coachEnabled && ctx?.user.id && me?.branch_id;

  return (
    <>
      <WorkspaceRoutePrefetcher config={OWNER_PREFETCH} />
      {canShowCoach ? (
        <AgentCoachProvider
          workspace="owner"
          role={me.system_role}
          branchId={me.branch_id}
          branchName={Array.isArray(me.branches) ? me.branches[0]?.name ?? "Your Branch" : (me.branches as { name: string } | null)?.name ?? "Your Branch"}
          userId={ctx.user.id}
        >
          {children}
          <CoachBubble />
          <InlineTip />
        </AgentCoachProvider>
      ) : (
        children
      )}
    </>
  );
}
