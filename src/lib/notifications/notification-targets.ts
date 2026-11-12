/**
 * Workspace-aware notification target routing.
 *
 * One shared notification model + workspace context = exact actionable route per role.
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
  | "attendance_exception"
  | string;

const WORKSPACE_FALLBACK: Record<NotificationRouteWorkspace, string> = {
  owner: "/owner",
  manager: "/manager",
  crm: "/crm/today",
  "staff-portal": "/staff-portal/today",
  driver: "/staff/driver",
  utility: "/staff/utility/work",
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
  if (prefix === "/staff-portal" && (path.startsWith("/staff/") || path.startsWith("/staff-portal"))) {
    return true;
  }
  if (prefix === "/staff/driver" && (path.startsWith("/staff/driver") || path.startsWith("/driver"))) {
    return true;
  }
  return path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}?`);
}

function getBookingTargetPath(
  workspace: NotificationRouteWorkspace,
  entityId?: string | null,
  notificationType?: string | null
): string {
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
      if (
        notificationType === "customer_arrived" ||
        notificationType === "booking_status_changed" ||
        notificationType === "staff_progress_required"
      ) {
        return `/staff-portal/service-progress?bookingId=${encoded}`;
      }
      return `/staff-portal/schedule?bookingId=${encoded}`;
    case "driver":
      if (notificationType === "home_service_assigned") {
        return `/staff/driver/map?bookingId=${encoded}`;
      }
      return `/staff/driver/routes/${encoded}`;
    case "utility":
      return `/staff/utility/work?bookingId=${encoded}`;
  }
}

export function getNotificationTargetPath(input: {
  workspace: NotificationWorkspaceContext;
  entityType?: NotificationEntityType | null;
  entityId?: string | null;
  type?: string | null;
}): string {
  const workspace = normalizeNotificationRouteWorkspace(input.workspace);
  const { entityType, entityId, type } = input;

  if (!workspace) return "/";

  if (type?.startsWith("attendance_")) {
    if (workspace === "crm") return "/crm/attendance?tab=exceptions";
    if (workspace === "owner") return "/owner/attendance";
    return "/staff/attendance";
  }

  switch (entityType) {
    case "booking": {
      return getBookingTargetPath(workspace, entityId, type);
    }

    case "attendance_exception": {
      if (workspace === "crm") return "/crm/attendance?tab=exceptions";
      if (workspace === "owner") return "/owner/attendance";
      return "/staff/attendance";
    }

    case "branch": {
      if (workspace === "owner" && entityId) {
        return `/owner/branches/${encodeURIComponent(entityId)}`;
      }
      return workspace === "manager" ? "/manager/settings" : WORKSPACE_FALLBACK[workspace];
    }

    case "staff_onboarding_request": {
      if (workspace === "crm") return "/crm/staff?tab=applications";
      return `/${workspace}/staff/onboarding`;
    }

    case "reconciliation": {
      if (workspace === "owner") return "/owner/reports";
      if (workspace === "manager") return "/manager";
      return "/crm/cash-flow";
    }

    case "waitlist_request": {
      return "/crm/bookings?tab=waitlist";
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
  type?: string | null;
}): string | null {
  const workspace = normalizeNotificationRouteWorkspace(input.target_workspace);
  if (!workspace) return input.action_href ?? null;

  const fallback = getNotificationTargetPath({
    workspace,
    entityType: input.entity_type,
    entityId: input.entity_id,
    type: input.type,
  });
  const href = input.action_href;
  if (!href) return fallback;

  // Always upgrade generic driver/therapist links to deep-linked route/session URLs when entity_id is known
  if (workspace === "driver" && input.entity_id && (href === "/driver" || href === "/staff/driver")) {
    return fallback;
  }

  const prefix = WORKSPACE_FALLBACK[workspace].split("/").slice(0, 2).join("/");
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

export function getWorkspacePathPrefix(
  workspace: NotificationWorkspaceContext
): string {
  const routeWorkspace = normalizeNotificationRouteWorkspace(workspace);
  return routeWorkspace ? WORKSPACE_FALLBACK[routeWorkspace] : "/";
}
