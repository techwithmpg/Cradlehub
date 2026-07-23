import type {
  AttendanceDayStaffState,
  AttendanceOperationalStatus,
} from "@/lib/attendance/day-model";
import type { AttendanceException } from "@/lib/attendance/types";

export type AttendanceOverviewStatusKey =
  | "on_duty"
  | "not_in_yet"
  | "completed"
  | "needs_review"
  | "off_duty";

export type AttendanceOverviewStatus = {
  key: AttendanceOverviewStatusKey;
  label: string;
  tone: "good" | "warn" | "bad" | "neutral";
};

export type AttendanceOverviewSummary = {
  onDuty: number;
  notInYet: number;
  completed: number;
  needsReviewStaff: number;
  reviewItems: number;
  scheduledTotal: number;
  offDuty: number;
};

function isReviewStatus(status: AttendanceOperationalStatus): boolean {
  return status === "needs_review" || status === "scan_captured";
}

export function getAttendanceOverviewStatus(
  row: Pick<AttendanceDayStaffState, "operationalStatus" | "displayLabel">
): AttendanceOverviewStatus {
  if (isReviewStatus(row.operationalStatus)) {
    return { key: "needs_review", label: "Needs review", tone: "bad" };
  }

  if (row.operationalStatus === "on_service") {
    return { key: "on_duty", label: "In service", tone: "good" };
  }

  if (row.operationalStatus === "clocked_in") {
    return { key: "on_duty", label: "On duty", tone: "good" };
  }

  if (row.operationalStatus === "clocked_out") {
    return { key: "completed", label: "Completed", tone: "neutral" };
  }

  if (row.operationalStatus === "missing") {
    return { key: "not_in_yet", label: row.displayLabel || "Late", tone: "warn" };
  }

  if (row.operationalStatus === "expected_later") {
    return { key: "not_in_yet", label: row.displayLabel || "Not in yet", tone: "warn" };
  }

  return { key: "off_duty", label: row.displayLabel || "Off duty", tone: "neutral" };
}

export function buildAttendanceOverviewSummary(
  rows: Array<Pick<AttendanceDayStaffState, "operationalStatus" | "displayLabel">>,
  exceptions: Array<Pick<AttendanceException, "status">>
): AttendanceOverviewSummary {
  let onDuty = 0;
  let notInYet = 0;
  let completed = 0;
  let needsReviewStaff = 0;
  let offDuty = 0;

  for (const row of rows) {
    const status = getAttendanceOverviewStatus(row);
    if (status.key === "on_duty") onDuty += 1;
    else if (status.key === "not_in_yet") notInYet += 1;
    else if (status.key === "completed") completed += 1;
    else if (status.key === "needs_review") needsReviewStaff += 1;
    else offDuty += 1;
  }

  return {
    onDuty,
    notInYet,
    completed,
    needsReviewStaff,
    reviewItems: exceptions.filter((exception) => exception.status === "open").length,
    scheduledTotal: onDuty + notInYet + completed + needsReviewStaff,
    offDuty,
  };
}

export function getAttendanceIssueRecommendation(
  exception: Pick<AttendanceException, "exception_type">
): string {
  const type = exception.exception_type.toLowerCase();

  if (type.includes("branch") || type.includes("wrong_branch")) {
    return "Confirm today's branch or update the staff member's permanent branch assignment.";
  }

  if (type.includes("schedule") || type.includes("off_day")) {
    return "Confirm the scan for today or correct the staff schedule before resolving it.";
  }

  if (type.includes("device") || type.includes("phone")) {
    return "Review the phone registration and issue a secure recovery link when needed.";
  }

  if (type.includes("clock_out") || type.includes("closing") || type.includes("early_leave")) {
    return "Review the staff day and confirm the correct clock-out time.";
  }

  if (type.includes("late") || type.includes("clock_in")) {
    return "Check the scheduled start and approve or correct the clock-in time.";
  }

  return "Review the scan evidence and apply the recommended attendance correction.";
}
