/**
 * Workspace-aware notification target routing.
 *
 * One shared notification model + workspace context = correct route per role.
 * Never hardcode notification hrefs inline; use this helper instead.
 */

export type NotificationWorkspaceContext =
  | "owner"
  | "manager"
  | "crm"
  | "staff-portal"
  | "driver"
  | "utility";

export type NotificationEntityType =
  | "booking"
  | "branch"
  | "staff_onboarding_request"
  | "reconciliation"
  | "waitlist_request"
  | string;

const WORKSPACE_FALLBACK: Record<NotificationWorkspaceContext, string> = {
  owner:       "/owner",
  manager:     "/manager",
  crm:         "/crm",
  "staff-portal": "/staff-portal",
  driver:      "/driver",
  utility:     "/utility",
};

/**
 * Build the correct in-app path for a notification based on workspace context
 * and entity metadata.
 *
 * Rules:
 * - booking      → /{workspace}/bookings?bookingId={entityId}
 * - branch       → owner: /owner/branches/{entityId}, manager: /manager/settings
 * - staff_onboarding_request → /{workspace}/staff/onboarding
 * - reconciliation → owner: /owner/reports, manager: /manager, crm: /crm/reconciliation
 * - waitlist_request → /crm/waitlist
 * - fallback     → /{workspace}
 */
export function getNotificationTargetPath(input: {
  workspace: NotificationWorkspaceContext;
  entityType?: NotificationEntityType | null;
  entityId?: string | null;
}): string {
  const { workspace, entityType, entityId } = input;

  switch (entityType) {
    case "booking": {
      if (entityId) {
        return `/${workspace}/bookings?bookingId=${encodeURIComponent(entityId)}`;
      }
      return WORKSPACE_FALLBACK[workspace];
    }

    case "branch": {
      if (workspace === "owner" && entityId) {
        return `/owner/branches/${encodeURIComponent(entityId)}`;
      }
      return workspace === "manager" ? "/manager/settings" : WORKSPACE_FALLBACK[workspace];
    }

    case "staff_onboarding_request": {
      return `/${workspace}/staff/onboarding`;
    }

    case "reconciliation": {
      if (workspace === "owner") return "/owner/reports";
      if (workspace === "manager") return "/manager";
      return "/crm/reconciliation";
    }

    case "waitlist_request": {
      return "/crm/waitlist";
    }

    default: {
      return WORKSPACE_FALLBACK[workspace];
    }
  }
}

/**
 * Return the URL path prefix for a workspace context.
 * Useful for validating or correcting stored action_href values.
 */
export function getWorkspacePathPrefix(
  workspace: NotificationWorkspaceContext
): string {
  return WORKSPACE_FALLBACK[workspace];
}
