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
import { AdministrativeBookingModalProvider } from "@/components/features/bookings/administrative-booking-modal-provider";
import { getLayoutStaffContext } from "@/lib/queries/staff-context";
import { getQuickBookingContext } from "@/lib/queries/quick-booking-options";
import { isDevAuthBypassEnabled, getDevBypassLayoutStaff } from "@/lib/dev-bypass";
import { getAgentCoachAvailability } from "@/lib/agents/config";
import { RetainedWorkspaceProvider } from "@/components/features/dashboard/retained-workspace-provider";
import { isRetainedWorkspaceEnabled } from "@/lib/config/mvp-flags";

export default async function CrmLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getLayoutStaffContext();
  const me = ctx?.me ?? (isDevAuthBypassEnabled() ? getDevBypassLayoutStaff() : null);
  const coachAvailability = getAgentCoachAvailability({
    workspace: "crm",
    role: me?.system_role,
  });
  const canShowCoach = coachAvailability.available && ctx?.user.id && me?.branch_id;
  const branchId = me?.branch_id ?? null;
  const branchName = (me?.branches as { name: string } | null)?.name ?? "Your Branch";
  const bookingContext = branchId ? await getQuickBookingContext(branchId) : null;
  const retainedChildren = branchId && ctx?.user.id && me?.system_role ? (
    <RetainedWorkspaceProvider
      workspace="crm"
      userId={ctx.user.id}
      role={me.system_role}
      branchId={branchId}
      enabled={isRetainedWorkspaceEnabled("crm")}
    >
      {children}
    </RetainedWorkspaceProvider>
  ) : (
    children
  );
  const workspaceContent = branchId && bookingContext ? (
    <AdministrativeBookingModalProvider
      branchId={branchId}
      branchName={branchName}
      bookingRules={bookingContext.bookingRules}
      services={bookingContext.services}
      staff={bookingContext.staff}
      resources={bookingContext.resources}
    >
      {retainedChildren}
    </AdministrativeBookingModalProvider>
  ) : (
    retainedChildren
  );

  return (
    <>
      {/* Background route warm-up for CRM workspace */}
      <WorkspaceRoutePrefetcher config={CRM_PREFETCH} />

      {canShowCoach ? (
        <AgentCoachProvider
          workspace="crm"
          role={me.system_role}
          branchId={me.branch_id}
          branchName={branchName}
          userId={ctx.user.id}
        >
          {workspaceContent}
          <CoachBubble />
          <InlineTip />
        </AgentCoachProvider>
      ) : (
        workspaceContent
      )}
    </>
  );
}
