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
  | "staff"
  | "staff-portal"
  | "driver"
  | "utility";

type NotificationRouteWorkspace = Exclude<NotificationWorkspaceContext, "staff">;

export type NotificationEntityType =
  | "booking"
  | "branch"
  | "staff_onboarding_request"
  | "reconciliation"
  | "waitlist_request"
  | string;

const WORKSPACE_FALLBACK: Record<NotificationRouteWorkspace, string> = {
  owner:       "/owner",
  manager:     "/manager",
  crm:         "/crm",
  "staff-portal": "/staff-portal",
  driver:      "/driver",
  utility:     "/utility",
};

export function normalizeNotificationRouteWorkspace(
  workspace: NotificationWorkspaceContext | string | null | undefined
): NotificationRouteWorkspace | null {
  switch (workspace) {
    case "owner":
    case "manager":
    case "crm":
    case "driver":
    case "utility":
    case "staff-portal":
      return workspace;
    case "staff":
      return "staff-portal";
    default:
      return null;
  }
}

function pathMatchesWorkspace(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}?`);
}

function getBookingTargetPath(workspace: NotificationRouteWorkspace, entityId?: string | null): string {
  if (!entityId) return WORKSPACE_FALLBACK[workspace];

  const encoded = encodeURIComponent(entityId);
  switch (workspace) {
    case "crm":
      return `/crm/bookings?bookingId=${encoded}`;
    case "manager":
      return `/manager/bookings?bookingId=${encoded}`;
    case "owner":
      return `/owner/bookings?bookingId=${encoded}`;
    case "staff-portal":
      return `/staff-portal/schedule?bookingId=${encoded}`;
    case "driver":
      return "/driver";
    case "utility":
      return "/utility";
  }
}

/**
 * Build the correct in-app path for a notification based on workspace context
 * and entity metadata.
 *
 * Rules:
 * - booking      → explicit real booking routes per workspace
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
  const workspace = normalizeNotificationRouteWorkspace(input.workspace);
  const { entityType, entityId } = input;

  if (!workspace) return "/";

  switch (entityType) {
    case "booking": {
      return getBookingTargetPath(workspace, entityId);
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

export function resolveNotificationHref(input: {
  action_href?: string | null;
  target_workspace?: string | null;
  entity_type?: NotificationEntityType | null;
  entity_id?: string | null;
}): string | null {
  const workspace = normalizeNotificationRouteWorkspace(input.target_workspace);
  if (!workspace) return input.action_href ?? null;

  const fallback = getNotificationTargetPath({
    workspace,
    entityType: input.entity_type,
    entityId: input.entity_id,
  });
  const href = input.action_href;
  if (!href) return fallback;

  const prefix = WORKSPACE_FALLBACK[workspace];
  if (!pathMatchesWorkspace(href, prefix)) return fallback;

  if (
    input.entity_type === "booking" &&
    workspace === "staff-portal" &&
    (href.startsWith("/staff/bookings") || href.startsWith("/staff-portal/bookings"))
  ) {
    return fallback;
  }

  return href;
}

/**
 * Return the URL path prefix for a workspace context.
 * Useful for validating or correcting stored action_href values.
 */
export function getWorkspacePathPrefix(
  workspace: NotificationWorkspaceContext
): string {
  const routeWorkspace = normalizeNotificationRouteWorkspace(workspace);
  return routeWorkspace ? WORKSPACE_FALLBACK[routeWorkspace] : "/";
}
