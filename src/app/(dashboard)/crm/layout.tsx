/**
 * CRM Route Layout — Phase 9F
 *
 * Wraps all /crm/* routes with background route warm-up and the AI coach.
 *
 * This layout is nested inside (dashboard)/layout.tsx, which already
 * renders the sidebar, header, and main scroll container.
 */

import { WorkspaceRoutePrefetcher } from "@/components/features/workspace/workspace-route-prefetcher";
import { CRM_PREFETCH } from "@/components/features/workspace/workspace-prefetch-config";
import { AgentCoachProvider } from "@/components/agent/agent-context-provider";
import { CoachBubble } from "@/components/agent/coach-bubble";
import { InlineTip } from "@/components/agent/inline-tip";
import { getLayoutStaffContext } from "@/lib/queries/staff-context";
import { isDevAuthBypassEnabled, getDevBypassLayoutStaff } from "@/lib/dev-bypass";
import { isWorkspaceEnabled } from "@/lib/agents/config";

export default async function CrmLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getLayoutStaffContext();
  const me = ctx?.me ?? (isDevAuthBypassEnabled() ? getDevBypassLayoutStaff() : null);
  const coachEnabled = isWorkspaceEnabled("crm");
  const canShowCoach = coachEnabled && ctx?.user.id && me?.branch_id;

  return (
    <>
      {/* Background route warm-up for CRM workspace */}
      <WorkspaceRoutePrefetcher config={CRM_PREFETCH} />

      {canShowCoach ? (
        <AgentCoachProvider
          workspace="crm"
          role={me.system_role}
          branchId={me.branch_id}
          branchName={(me.branches as { name: string } | null)?.name ?? "Your Branch"}
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
