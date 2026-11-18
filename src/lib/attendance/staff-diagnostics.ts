import type { AttendanceDayStaffState } from "@/lib/attendance/day-model";
import { presentAttendanceIssue } from "@/lib/attendance/issue-presenter";
import { attendanceV2Status } from "@/lib/attendance/v2-policy";
import type { AttendanceIssuePresentation } from "@/lib/attendance/issue-presentation-types";
import type {
  AttendanceDeviceRegistryEntry,
  AttendanceException,
  AttendanceScanEvent,
  AttendanceWorkspaceData,
} from "@/lib/attendance/types";

export type AttendanceStaffStatus =
  | "working"
  | "not_scanned_in"
  | "checked_out"
  | "late"
  | "needs_review"
  | "phone_not_connected"
  | "phone_revoked"
  | "wrong_branch"
  | "no_schedule"
  | "stale_open_attendance"
  | "scan_blocked"
  | "in_service"
  | "not_expected";

export type AttendanceStaffDiagnostic = {
  creditStatusLabel?: string | null;
  staff: AttendanceDayStaffState;
  status: AttendanceStaffStatus;
  statusLabel: string;
  needsHelp: boolean;
  working: boolean;
  notScannedIn: boolean;
  checkedOut: boolean;
  device: AttendanceDeviceRegistryEntry | null;
  latestScan: AttendanceScanEvent | null;
  openException: AttendanceException | null;
  issue: AttendanceIssuePresentation | null;
};

const ISSUE_STATUS: Partial<
  Record<AttendanceIssuePresentation["category"], AttendanceStaffStatus>
> = {
  phone_not_connected: "phone_not_connected",
  phone_revoked: "phone_revoked",
  replacement_phone_required: "phone_not_connected",
  wrong_branch: "wrong_branch",
  no_schedule: "no_schedule",
  stale_open_attendance: "stale_open_attendance",
};

const STATUS_LABELS: Record<AttendanceStaffStatus, string> = {
  working: "Working",
  not_scanned_in: "Not scanned in",
  checked_out: "Checked out",
  late: "Late",
  needs_review: "Needs review",
  phone_not_connected: "Phone not connected",
  phone_revoked: "Phone disconnected",
  wrong_branch: "Wrong branch",
  no_schedule: "No schedule today",
  stale_open_attendance: "Previous attendance still open",
  scan_blocked: "Scan blocked",
  in_service: "In service",
  not_expected: "Not expected today",
};

function latestScanForStaff(
  data: AttendanceWorkspaceData,
  staff: AttendanceDayStaffState
): AttendanceScanEvent | null {
  return (
    data.scanEvents.find((event) => event.staff_id === staff.staffId) ??
    data.scanEvents.find((event) => event.staff_name === staff.staffName) ??
    null
  );
}

function baseStatus(staff: AttendanceDayStaffState): AttendanceStaffStatus {
  if (staff.operationalStatus === "on_service") return "in_service";
  if (staff.operationalStatus === "clocked_in") return "working";
  if (staff.operationalStatus === "clocked_out") return "checked_out";
  if (staff.operationalStatus === "missing") return "late";
  if (staff.operationalStatus === "expected_later") return "not_scanned_in";
  if (staff.operationalStatus === "needs_review" || staff.operationalStatus === "scan_captured")
    return "needs_review";
  return "not_expected";
}

export function buildAttendanceStaffDiagnostics(
  data: AttendanceWorkspaceData
): AttendanceStaffDiagnostic[] {
  const seenStaff = new Set<string>();
  return data.dailyStaffStates
    .filter((staff) => {
      if (seenStaff.has(staff.staffId)) return false;
      seenStaff.add(staff.staffId);
      return true;
    })
    .map((staff) => {
      const device =
        data.deviceRegistry.entries.find((entry) => entry.staffId === staff.staffId) ?? null;
      const latestScan = latestScanForStaff(data, staff);
      const currentExceptionIdSet = new Set(staff.currentExceptionIds);
      const openException =
        (staff.currentExceptionIds.length > 0
          ? data.exceptions.find(
              (item) =>
                item.staff_id === staff.staffId &&
                item.status === "open" &&
                currentExceptionIdSet.has(item.id)
            )
          : data.exceptions.find((item) => {
              if (item.staff_id !== staff.staffId || item.status !== "open") return false;
              const staleTarget = item.metadata?.staleCheckinId;
              if (typeof staleTarget === "string" && staleTarget !== staff.attendanceRecordId) {
                return false;
              }
              if (item.checkin_id && staff.attendanceRecordId) {
                return item.checkin_id === staff.attendanceRecordId;
              }
              if (item.checkin_id && !staff.attendanceRecordId) return false;
              const staleDate =
                (typeof item.metadata?.staleBusinessDate === "string"
                  ? item.metadata.staleBusinessDate
                  : null) ??
                (typeof item.metadata?.staleShiftDate === "string"
                  ? item.metadata.staleShiftDate
                  : null);
              if (staleDate && staleDate !== staff.businessDate) return false;
              return true;
            })) ?? null;
      const technicalCodes = [
        ...(openException ? [openException.exception_type] : []),
        ...staff.issueCodes,
        ...(latestScan && latestScan.outcome !== "success" ? [latestScan.reason_code] : []),
      ];
      const phoneRelevant = !["day_off", "not_scheduled", "shift_complete"].includes(
        staff.scheduleState
      );
      const issue = presentAttendanceIssue({
        technicalCodes,
        deviceStatus: device?.status,
        scheduleState: staff.scheduleState,
        operationalStatus: staff.operationalStatus,
        phoneRelevant,
      });
      const fallbackStatus = baseStatus(staff);
      const status = issue
        ? (ISSUE_STATUS[issue.category] ??
          (latestScan?.outcome === "blocked" ? "scan_blocked" : "needs_review"))
        : fallbackStatus;
      const expected = ["expected_now", "expected_soon", "scheduled_later"].includes(
        staff.scheduleState
      );
      const needsHelp =
        Boolean(issue) || ["needs_review", "scan_captured"].includes(staff.operationalStatus);
      const record = data.records?.find((record) => record.id === staff.attendanceRecordId);
      const v2Status = record
        ? attendanceV2Status({
            checkedInAt: record.checked_in_at,
            checkedOutAt: record.checked_out_at,
            scheduledStartAt: record.scheduled_start_at,
            scheduledEndAt: record.scheduled_end_at,
            snapshot: record.attendance_policy_snapshot,
            provisionalAutoClosedAt: record.provisional_auto_closed_at,
            now: new Date().toISOString(),
          })
        : null;
      return {
        staff,
        status,
        statusLabel: v2Status ?? STATUS_LABELS[status],
        creditStatusLabel: v2Status,
        needsHelp,
        working: ["clocked_in", "on_service"].includes(staff.operationalStatus) && !needsHelp,
        notScannedIn: expected && !staff.clockInAt,
        checkedOut: staff.operationalStatus === "clocked_out",
        device,
        latestScan,
        openException,
        issue,
      };
    });
}
