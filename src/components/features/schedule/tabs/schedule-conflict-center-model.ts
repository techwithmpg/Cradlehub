import type {
  LiveScheduleConflict,
  LiveScheduleConflictSeverity,
  LiveScheduleConflictType,
} from "@/lib/schedule/live-schedule-conflict-types";

export type ScheduleConflictImpactGroup =
  | "must_fix"
  | "needs_approval"
  | "cleanup_warning"
  | "informational"
  | "accepted";

export type ScheduleConflictOperationalImpact = "High" | "Medium" | "Low";

export type ScheduleConflictSystemImpact =
  | "Online booking / availability"
  | "Room or resource assignment"
  | "Staff schedule rules"
  | "Home service timing"
  | "Schedule hygiene"
  | "Coverage visibility";

export type ScheduleConflictTabKey =
  | "all"
  | "must_fix"
  | "needs_approval"
  | "cleanup"
  | "rooms"
  | "staff"
  | "home_service"
  | "accepted"
  | "audit";

export type ScheduleConflictTab = {
  key: ScheduleConflictTabKey;
  label: string;
};

export type ScheduleConflictTabCounts = Record<ScheduleConflictTabKey, number>;

export type ScheduleConflictSeverityCounts = Record<LiveScheduleConflictSeverity, number>;

export type ScheduleConflictExceptionScope =
  | "today_only"
  | "this_staff_only"
  | "this_booking_only"
  | "schedule_rule_going_forward";

export type ScheduleConflictAuditVisibility =
  | "front_desk"
  | "manager_audit"
  | "owner_audit";

export type AcceptedScheduleConflictException = {
  id: string;
  conflictId: string;
  conflictType: LiveScheduleConflictType;
  reason: string;
  scope: ScheduleConflictExceptionScope;
  auditVisibility: ScheduleConflictAuditVisibility;
  acceptedAt: string;
};

export type ScheduleConflictResolutionIssue = {
  conflict: LiveScheduleConflict;
  impactGroup: ScheduleConflictImpactGroup;
  systemImpact: ScheduleConflictSystemImpact;
  operationalImpact: ScheduleConflictOperationalImpact;
  canAcceptException: boolean;
  affectsAvailability: boolean;
  affectsOnlineBooking: boolean;
  priority: number;
  status: "active" | "accepted";
  acceptance: AcceptedScheduleConflictException | null;
};

export type ScheduleConflictImpactCounts = Record<ScheduleConflictImpactGroup, number>;

export const SCHEDULE_CONFLICT_TABS: ScheduleConflictTab[] = [
  { key: "all", label: "All" },
  { key: "must_fix", label: "Must Fix" },
  { key: "needs_approval", label: "Needs Approval" },
  { key: "cleanup", label: "Cleanup" },
  { key: "rooms", label: "Rooms" },
  { key: "staff", label: "Staff" },
  { key: "home_service", label: "Home Service" },
  { key: "accepted", label: "Accepted" },
  { key: "audit", label: "Audit" },
];

export const CONFLICT_TYPE_LABELS: Record<LiveScheduleConflictType, string> = {
  staff_overlap: "Staff already booked",
  room_double_booked: "Room double booked",
  missing_room: "Missing room assignment",
  booking_outside_shift: "Booking outside staff shift",
  booking_on_day_off: "Staff is off today",
  booking_during_blocked_time: "Booking during blocked time",
  missing_schedule: "Schedule not configured",
  schedule_rule_conflict: "Schedule needs review",
  schedule_invalid_time_window: "Invalid schedule time window",
  schedule_overlapping_windows: "Overlapping schedule windows",
  schedule_ineligible_shift_type: "Shift type not allowed",
  schedule_contradictory_day_state: "Contradictory schedule state",
  duplicate_schedule_window: "Duplicate schedule window",
  coverage_gap: "Coverage gap",
  home_service_travel_buffer_warning: "Travel buffer too short",
};

export function getConflictTypeLabel(type: LiveScheduleConflictType): string {
  return CONFLICT_TYPE_LABELS[type];
}

export function getConflictCategoryKey(conflict: LiveScheduleConflict): ScheduleConflictTabKey {
  switch (conflict.type) {
    case "staff_overlap":
    case "schedule_rule_conflict":
    case "schedule_invalid_time_window":
    case "schedule_overlapping_windows":
    case "schedule_ineligible_shift_type":
    case "schedule_contradictory_day_state":
      return "staff";
    case "room_double_booked":
    case "missing_room":
      return "rooms";
    case "coverage_gap":
      return "all";
    case "home_service_travel_buffer_warning":
      return "home_service";
    case "booking_outside_shift":
    case "booking_on_day_off":
    case "booking_during_blocked_time":
    case "missing_schedule":
    case "duplicate_schedule_window":
      return "needs_approval";
  }
}

export function getImpactGroupCopy(group: ScheduleConflictImpactGroup): {
  label: string;
  description: string;
} {
  switch (group) {
    case "must_fix":
      return {
        label: "Must Fix",
        description: "Protects online booking, availability, rooms, staff assignment, or home-service timing.",
      };
    case "needs_approval":
      return {
        label: "Needs Approval",
        description: "May work in real life, but needs manager/CRM approval and a reason.",
      };
    case "cleanup_warning":
      return {
        label: "Cleanup Warning",
        description: "Does not block today, but should be cleaned to keep availability accurate.",
      };
    case "informational":
      return {
        label: "Informational",
        description: "No immediate action is needed for front-desk operations.",
      };
    case "accepted":
      return {
        label: "Accepted Exception",
        description: "Approved exception retained for audit review.",
      };
  }
}

export function classifyScheduleConflict(conflict: LiveScheduleConflict): Omit<
  ScheduleConflictResolutionIssue,
  "conflict" | "status" | "acceptance"
> {
  switch (conflict.type) {
    case "room_double_booked":
      return {
        impactGroup: "must_fix",
        systemImpact: "Room or resource assignment",
        operationalImpact: "High",
        canAcceptException: false,
        affectsAvailability: true,
        affectsOnlineBooking: true,
        priority: 20,
      };
    case "missing_room":
      return {
        impactGroup: "must_fix",
        systemImpact: "Room or resource assignment",
        operationalImpact: "High",
        canAcceptException: false,
        affectsAvailability: true,
        affectsOnlineBooking: true,
        priority: 25,
      };
    case "staff_overlap":
      return {
        impactGroup: "must_fix",
        systemImpact: "Online booking / availability",
        operationalImpact: "High",
        canAcceptException: false,
        affectsAvailability: true,
        affectsOnlineBooking: true,
        priority: 30,
      };
    case "home_service_travel_buffer_warning":
      return {
        impactGroup: "needs_approval",
        systemImpact: "Home service timing",
        operationalImpact: "Medium",
        canAcceptException: true,
        affectsAvailability: true,
        affectsOnlineBooking: false,
        priority: 40,
      };
    case "booking_outside_shift":
    case "booking_on_day_off":
    case "booking_during_blocked_time":
      return {
        impactGroup: "needs_approval",
        systemImpact: "Staff schedule rules",
        operationalImpact: conflict.severity === "critical" ? "High" : "Medium",
        canAcceptException: true,
        affectsAvailability: true,
        affectsOnlineBooking: false,
        priority: 50,
      };
    case "duplicate_schedule_window": {
      const affectsAvailability = conflict.affected_booking_ids.length > 0;
      return {
        impactGroup: affectsAvailability ? "must_fix" : "cleanup_warning",
        systemImpact: affectsAvailability ? "Online booking / availability" : "Schedule hygiene",
        operationalImpact: affectsAvailability ? "High" : "Low",
        canAcceptException: !affectsAvailability,
        affectsAvailability,
        affectsOnlineBooking: affectsAvailability,
        priority: affectsAvailability ? 15 : 70,
      };
    }
    case "missing_schedule":
      return {
        impactGroup: conflict.affected_booking_ids.length > 0 ? "must_fix" : "needs_approval",
        systemImpact: "Staff schedule rules",
        operationalImpact: conflict.affected_booking_ids.length > 0 ? "High" : "Medium",
        canAcceptException: conflict.affected_booking_ids.length === 0,
        affectsAvailability: true,
        affectsOnlineBooking: conflict.affected_booking_ids.length > 0,
        priority: conflict.affected_booking_ids.length > 0 ? 18 : 55,
      };
    case "schedule_rule_conflict":
    case "schedule_invalid_time_window":
    case "schedule_overlapping_windows":
    case "schedule_ineligible_shift_type":
    case "schedule_contradictory_day_state":
      return {
        impactGroup: "must_fix",
        systemImpact: "Online booking / availability",
        operationalImpact: conflict.affected_booking_ids.length > 0 ? "High" : "Medium",
        canAcceptException: false,
        affectsAvailability: true,
        affectsOnlineBooking: true,
        priority: 12,
      };
    case "coverage_gap":
      return {
        impactGroup: "informational",
        systemImpact: "Coverage visibility",
        operationalImpact: "Low",
        canAcceptException: false,
        affectsAvailability: false,
        affectsOnlineBooking: false,
        priority: 80,
      };
  }
}

export function buildScheduleConflictIssues(
  conflicts: LiveScheduleConflict[],
  acceptedExceptions: AcceptedScheduleConflictException[]
): ScheduleConflictResolutionIssue[] {
  const acceptedByConflictId = new Map(
    acceptedExceptions.map((exception) => [exception.conflictId, exception])
  );

  return conflicts
    .map<ScheduleConflictResolutionIssue>((conflict) => {
      const acceptance = acceptedByConflictId.get(conflict.id) ?? null;
      const classification = classifyScheduleConflict(conflict);
      const status: ScheduleConflictResolutionIssue["status"] = acceptance ? "accepted" : "active";
      return {
        conflict,
        ...classification,
        impactGroup: acceptance ? "accepted" : classification.impactGroup,
        canAcceptException: acceptance ? false : classification.canAcceptException,
        status,
        acceptance,
      };
    })
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === "active" ? -1 : 1;
      const priorityDiff = a.priority - b.priority;
      if (priorityDiff !== 0) return priorityDiff;
      return (a.conflict.start_time ?? "99:99").localeCompare(b.conflict.start_time ?? "99:99");
    });
}

export function buildScheduleConflictImpactCounts(
  issues: ScheduleConflictResolutionIssue[]
): ScheduleConflictImpactCounts {
  return issues.reduce<ScheduleConflictImpactCounts>(
    (counts, issue) => {
      counts[issue.impactGroup] += 1;
      return counts;
    },
    {
      must_fix: 0,
      needs_approval: 0,
      cleanup_warning: 0,
      informational: 0,
      accepted: 0,
    }
  );
}

export function buildScheduleConflictTabCounts(
  issues: ScheduleConflictResolutionIssue[]
): ScheduleConflictTabCounts {
  const activeIssues = issues.filter((issue) => issue.status === "active");
  const counts: ScheduleConflictTabCounts = {
    all: activeIssues.length,
    must_fix: 0,
    needs_approval: 0,
    cleanup: 0,
    staff: 0,
    rooms: 0,
    home_service: 0,
    accepted: 0,
    audit: issues.length,
  };

  for (const issue of issues) {
    if (issue.status === "accepted") {
      counts.accepted += 1;
      continue;
    }
    if (issue.impactGroup === "must_fix") counts.must_fix += 1;
    if (issue.impactGroup === "needs_approval") counts.needs_approval += 1;
    if (issue.impactGroup === "cleanup_warning") counts.cleanup += 1;
    if (
      issue.conflict.type === "staff_overlap" ||
      issue.conflict.type === "schedule_rule_conflict" ||
      issue.conflict.type === "schedule_invalid_time_window" ||
      issue.conflict.type === "schedule_overlapping_windows" ||
      issue.conflict.type === "schedule_ineligible_shift_type" ||
      issue.conflict.type === "schedule_contradictory_day_state"
    ) counts.staff += 1;
    if (issue.conflict.type === "room_double_booked" || issue.conflict.type === "missing_room") {
      counts.rooms += 1;
    }
    if (issue.conflict.type === "home_service_travel_buffer_warning") counts.home_service += 1;
  }

  return counts;
}

export function buildScheduleConflictSeverityCounts(
  conflicts: LiveScheduleConflict[]
): ScheduleConflictSeverityCounts {
  return conflicts.reduce<ScheduleConflictSeverityCounts>(
    (counts, conflict) => {
      counts[conflict.severity] += 1;
      return counts;
    },
    { info: 0, warning: 0, critical: 0 }
  );
}

export function filterScheduleConflictsByCategory(
  conflicts: LiveScheduleConflict[],
  category: ScheduleConflictTabKey
): LiveScheduleConflict[] {
  if (category === "all") return conflicts;
  if (category === "must_fix") {
    return conflicts.filter((conflict) => classifyScheduleConflict(conflict).impactGroup === "must_fix");
  }
  if (category === "needs_approval") {
    return conflicts.filter((conflict) => classifyScheduleConflict(conflict).impactGroup === "needs_approval");
  }
  if (category === "cleanup") {
    return conflicts.filter((conflict) => classifyScheduleConflict(conflict).impactGroup === "cleanup_warning");
  }
  if (category === "accepted" || category === "audit") {
    return [];
  }
  return conflicts.filter((conflict) => getConflictCategoryKey(conflict) === category);
}

function issueMatchesTab(issue: ScheduleConflictResolutionIssue, tab: ScheduleConflictTabKey): boolean {
  if (tab === "audit") return true;
  if (tab === "accepted") return issue.status === "accepted";
  if (issue.status === "accepted") return false;
  if (tab === "all") return true;
  if (tab === "must_fix") return issue.impactGroup === "must_fix";
  if (tab === "needs_approval") return issue.impactGroup === "needs_approval";
  if (tab === "cleanup") return issue.impactGroup === "cleanup_warning";
  if (tab === "rooms") return issue.conflict.type === "room_double_booked" || issue.conflict.type === "missing_room";
  if (tab === "staff") {
    return (
      issue.conflict.type === "staff_overlap" ||
      issue.conflict.type === "schedule_rule_conflict" ||
      issue.conflict.type === "schedule_invalid_time_window" ||
      issue.conflict.type === "schedule_overlapping_windows" ||
      issue.conflict.type === "schedule_ineligible_shift_type" ||
      issue.conflict.type === "schedule_contradictory_day_state"
    );
  }
  if (tab === "home_service") return issue.conflict.type === "home_service_travel_buffer_warning";
  return true;
}

function issueSearchText(issue: ScheduleConflictResolutionIssue): string {
  return [
    getConflictTypeLabel(issue.conflict.type),
    issue.conflict.title,
    issue.conflict.plain_language_message,
    issue.conflict.affected_staff_names.join(" "),
    issue.conflict.affected_booking_labels.join(" "),
    issue.conflict.affected_resource_name,
    issue.systemImpact,
    issue.operationalImpact,
    getImpactGroupCopy(issue.impactGroup).label,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function filterScheduleConflictIssues(params: {
  issues: ScheduleConflictResolutionIssue[];
  tab: ScheduleConflictTabKey;
  query: string;
}): ScheduleConflictResolutionIssue[] {
  const search = params.query.trim().toLowerCase();
  return params.issues.filter((issue) => {
    if (!issueMatchesTab(issue, params.tab)) return false;
    if (!search) return true;
    return issueSearchText(issue).includes(search);
  });
}

export function formatIssueCount(count: number): string {
  return count === 1 ? "1 issue" : `${count} issues`;
}

export function formatSeveritySummary(counts: ScheduleConflictSeverityCounts): string {
  const parts: string[] = [];
  if (counts.critical > 0) parts.push(`${counts.critical} critical`);
  if (counts.warning > 0) parts.push(`${counts.warning} warning${counts.warning === 1 ? "" : "s"}`);
  if (counts.info > 0) parts.push(`${counts.info} info`);
  return parts.length > 0 ? parts.join(" · ") : "No schedule issues found";
}

export function formatImpactSummary(counts: ScheduleConflictImpactCounts): string {
  const parts: string[] = [];
  if (counts.must_fix > 0) parts.push(`${counts.must_fix} must fix`);
  if (counts.needs_approval > 0) parts.push(`${counts.needs_approval} needs approval`);
  if (counts.cleanup_warning > 0) parts.push(`${counts.cleanup_warning} cleanup`);
  if (counts.accepted > 0) parts.push(`${counts.accepted} accepted`);
  return parts.length > 0 ? parts.join(" · ") : "No active issues";
}
