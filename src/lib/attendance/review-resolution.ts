import type { AttendanceRecord, AttendanceScanEvent } from "@/lib/attendance/types";
import type { AttendanceReviewItem } from "@/lib/attendance/crm-review";

export type AttendanceReviewResolutionKind =
  | "correct_record"
  | "resolve_scan"
  | "schedule"
  | "branch"
  | "phone"
  | "technical";

export function attendanceReviewResolutionKind(params: {
  item: AttendanceReviewItem;
  record: AttendanceRecord | null;
  scanEvent: AttendanceScanEvent | null;
}): AttendanceReviewResolutionKind {
  if (params.item.category === "phone") return "phone";
  if (params.item.category === "branch") return "branch";
  if (params.item.category === "schedule") return "schedule";
  if (params.item.category === "technical") return "technical";
  if (params.record) return "correct_record";
  if (params.scanEvent || params.item.exception.scan_event_id) return "resolve_scan";
  return "technical";
}

export function attendanceReviewPrimaryAction(kind: AttendanceReviewResolutionKind): string {
  if (kind === "correct_record") return "Correct attendance";
  if (kind === "resolve_scan") return "Resolve saved scan";
  if (kind === "schedule") return "Add today’s schedule";
  if (kind === "branch") return "Approve branch";
  if (kind === "phone") return "Fix phone";
  return "Review processing";
}

export function attendanceReviewInstruction(kind: AttendanceReviewResolutionKind): string {
  if (kind === "correct_record") {
    return "Review the stored clock-in and clock-out, then save the corrected times.";
  }
  if (kind === "resolve_scan") {
    return "Choose whether the saved scan is a clock-in or clock-out. The system will create or close the attendance record and keep an audit trail.";
  }
  if (kind === "schedule") {
    return "Create a one-day schedule. When a saved scan exists, apply it immediately after saving the schedule.";
  }
  if (kind === "branch") {
    return "Approve this branch for today, then ask the staff member to scan once again.";
  }
  if (kind === "phone") {
    return "Generate a secure one-time recovery link and send it to the staff member’s attendance phone.";
  }
  return "Review the saved evidence and escalate the processing issue when it cannot be resolved safely.";
}
