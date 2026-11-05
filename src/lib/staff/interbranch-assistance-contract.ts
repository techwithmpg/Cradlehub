/**
 * Inter-branch Assistance — isolated operational safety contract.
 *
 * This module is intentionally pure and NOT connected to booking, attendance,
 * payroll or database writes. It does not grant temporary booking eligibility.
 * An approved request must not be treated as permission to book staff.
 */
export type AssistanceRole = "therapist" | "nail_tech" | "aesthetician";
export type AssistanceVisitType = "in_spa" | "home_service";

export type AssistanceStatus =
  | "requested"
  | "approved_pending_arrival"
  | "travelling"
  | "active"
  | "declined"
  | "cancelled"
  | "completed";

export type AssistanceWindow = {
  /** Server-generated absolute timestamp including timezone/offset. */
  startAt: string;
  endAt: string;
};

export type AssistanceRequest = {
  id: string;
  requestingBranchId: string;
  lendingBranchId: string;
  role: AssistanceRole;
  count: number;
  window: AssistanceWindow;
  visitType: AssistanceVisitType;
  status: AssistanceStatus;
};

export type AssistanceCandidate = {
  id: string;
  homeBranchId: string;
  isActive: boolean;
  role: AssistanceRole;
  qualifiedForRequestedServices: boolean;
  scheduledWindow: AssistanceWindow | null;
  /** Across both branches, including home-service travel and holds. */
  blockingWindows: readonly AssistanceWindow[];
  /** Other approved assistance periods, across both branches. */
  committedAssistanceWindows: readonly AssistanceWindow[];
  /** Sufficient home-branch coverage must be verified server-side. */
  lendingBranchCanRelease: boolean;
};

export type AssistanceCheck =
  | "invalid_request"
  | "different_branch_required"
  | "unavailable_destination"
  | "staff_not_active"
  | "staff_not_at_lending_branch"
  | "staff_role_mismatch"
  | "service_not_qualified"
  | "outside_scheduled_shift"
  | "booking_conflict"
  | "assistance_conflict"
  | "home_branch_coverage_risk";

const TRANSITIONS: Record<AssistanceStatus, readonly AssistanceStatus[]> = {
  requested: ["approved_pending_arrival", "declined", "cancelled"],
  approved_pending_arrival: ["travelling", "cancelled"],
  travelling: ["active", "cancelled"],
  active: ["completed"],
  declined: [],
  cancelled: [],
  completed: [],
};

function timestamp(value: string): number | null {
  // The server must supply offset-aware instants; ambiguous local timestamps
  // must never pass eligibility checks.
  if (!/(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

export function validAssistanceWindow(window: AssistanceWindow): boolean {
  const start = timestamp(window.startAt);
  const end = timestamp(window.endAt);
  return start !== null && end !== null && start < end;
}

export function assistanceWindowsOverlap(
  a: AssistanceWindow,
  b: AssistanceWindow,
): boolean {
  if (!validAssistanceWindow(a) || !validAssistanceWindow(b)) return true;
  return Date.parse(a.startAt) < Date.parse(b.endAt) &&
    Date.parse(b.startAt) < Date.parse(a.endAt);
}

export function canAdvanceAssistanceStatus(
  from: AssistanceStatus,
  to: AssistanceStatus,
): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Only the lending-branch management team can authorize releasing staff. */
export function canApproveAssistance(actor: {
  role: string;
  branchId: string | null;
}, request: AssistanceRequest): boolean {
  const manager = ["owner", "manager", "assistant_manager", "store_manager"].includes(actor.role);
  return manager && (actor.role === "owner" || actor.branchId === request.lendingBranchId);
}

export function evaluateAssistanceCandidate(
  request: AssistanceRequest,
  candidate: AssistanceCandidate,
  options: { destinationSupportsHomeService: boolean },
): AssistanceCheck[] {
  const issues: AssistanceCheck[] = [];
  if (!validAssistanceWindow(request.window) || !Number.isInteger(request.count) ||
      request.count < 1 || request.count > 20) issues.push("invalid_request");
  if (request.requestingBranchId === request.lendingBranchId) issues.push("different_branch_required");
  if (request.visitType === "home_service" && !options.destinationSupportsHomeService) {
    issues.push("unavailable_destination");
  }
  if (!candidate.isActive) issues.push("staff_not_active");
  if (candidate.homeBranchId !== request.lendingBranchId) issues.push("staff_not_at_lending_branch");
  if (candidate.role !== request.role) issues.push("staff_role_mismatch");
  if (!candidate.qualifiedForRequestedServices) issues.push("service_not_qualified");
  if (!candidate.scheduledWindow || !validAssistanceWindow(candidate.scheduledWindow) ||
      !validAssistanceWindow(request.window) ||
      Date.parse(candidate.scheduledWindow.startAt) > Date.parse(request.window.startAt) ||
      Date.parse(candidate.scheduledWindow.endAt) < Date.parse(request.window.endAt)) {
    issues.push("outside_scheduled_shift");
  }
  if (candidate.blockingWindows.some(w => assistanceWindowsOverlap(request.window, w))) {
    issues.push("booking_conflict");
  }
  if (candidate.committedAssistanceWindows.some(w => assistanceWindowsOverlap(request.window, w))) {
    issues.push("assistance_conflict");
  }
  if (!candidate.lendingBranchCanRelease) issues.push("home_branch_coverage_risk");
  return issues;
}

/**
 * Approval does not make staff bookable. Only an ACTIVE, arrived and
 * independently revalidated assignment can eventually influence availability.
 */
export function isAssistanceEffectiveForBooking(input: {
  status: AssistanceStatus;
  arrivedAt: string | null;
  window: AssistanceWindow;
  bookingWindow: AssistanceWindow;
  requestedBranchId: string;
  bookingBranchId: string;
  destinationSupportsHomeService: boolean;
  visitType: AssistanceVisitType;
  serverValidated: boolean;
}): boolean {
  if (input.status !== "active" || !input.arrivedAt || !input.serverValidated) return false;
  if (input.requestedBranchId !== input.bookingBranchId) return false;
  if (input.visitType === "home_service" && !input.destinationSupportsHomeService) return false;
  if (!validAssistanceWindow(input.window) || !validAssistanceWindow(input.bookingWindow)) return false;
  const arrival = timestamp(input.arrivedAt);
  if (arrival === null) return false;
  return Date.parse(input.bookingWindow.startAt) >= Math.max(arrival, Date.parse(input.window.startAt)) &&
    Date.parse(input.bookingWindow.endAt) <= Date.parse(input.window.endAt);
}
