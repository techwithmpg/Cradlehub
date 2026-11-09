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
import { CrmBookingsRealtimeBridge } from "@/components/features/bookings/crm-bookings-realtime-bridge";
import { CrmPendingBookingAlert } from "@/components/features/notifications/crm-pending-booking-alert";
import { GlobalServiceStartProvider } from "@/components/features/bookings/global-service-start-provider";
import { GlobalServiceCompletionProvider } from "@/components/features/bookings/global-service-completion-provider";
import { getAgentCoachAvailability } from "@/lib/agents/config";
import { RetainedWorkspaceProvider } from "@/components/features/dashboard/retained-workspace-provider";
import { isRetainedWorkspaceEnabled } from "@/lib/config/mvp-flags";
import { getFrontDeskContext } from "@/lib/queries/crm-context";

export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  const frontDesk = await getFrontDeskContext();
  const branchId = frontDesk.branchId;
  const branchName = frontDesk.branchName;
  const coachAvailability = getAgentCoachAvailability({
    workspace: "crm",
    role: frontDesk.role,
  });
  const canShowCoach = coachAvailability.available && frontDesk.userId && branchId;
  const retainedChildren =
    branchId && frontDesk.userId ? (
      <RetainedWorkspaceProvider
        workspace="crm"
        userId={frontDesk.userId}
        role={frontDesk.role}
        branchId={branchId}
        enabled={isRetainedWorkspaceEnabled("crm")}
      >
        {children}
      </RetainedWorkspaceProvider>
    ) : (
      children
    );
  const workspaceContent = branchId ? (
    <AdministrativeBookingModalProvider key={branchId} branchId={branchId} branchName={branchName}>
      <GlobalServiceCompletionProvider branchId={branchId}>
        {process.env.CRADLEHUB_SERVICE_REMINDERS_ENABLED === "true"
          ? <GlobalServiceStartProvider key={branchId} branchId={branchId}>{retainedChildren}</GlobalServiceStartProvider>
          : retainedChildren}
      </GlobalServiceCompletionProvider>
    </AdministrativeBookingModalProvider>
  ) : (
    retainedChildren
  );

  return (
    <>
      {branchId ? <CrmBookingsRealtimeBridge branchId={branchId} /> : null}
      {branchId && frontDesk.role === "crm" && process.env.CRADLEHUB_PENDING_BOOKING_ALERTS_ENABLED === "true" ? (
        <CrmPendingBookingAlert branchId={branchId} userId={frontDesk.userId} />
      ) : null}

      {/* Background route warm-up for CRM workspace */}
      <WorkspaceRoutePrefetcher
        config={CRM_PREFETCH}
        mobileIdleRoutes={["/crm/today", "/crm/schedule"]}
      />

      {canShowCoach ? (
        <AgentCoachProvider
          workspace="crm"
          role={frontDesk.role}
          branchId={branchId}
          branchName={branchName}
          userId={frontDesk.userId}
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
