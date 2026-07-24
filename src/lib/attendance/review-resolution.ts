import type { AttendanceRecord, AttendanceScanEvent } from "@/lib/attendance/types";
import type { AttendanceReviewItem } from "@/lib/attendance/crm-review";

export type AttendanceReviewResolutionKind =
  | "correct_record"
  | "resolve_scan"
  | "schedule"
  | "branch"
  | "phone"
  | "service"
  | "technical";

export function attendanceReviewResolutionKind(params: {
  item: AttendanceReviewItem;
  record: AttendanceRecord | null;
  scanEvent: AttendanceScanEvent | null;
}): AttendanceReviewResolutionKind {
  const preferred = params.item.diagnostic.resolutionKind;
  if (preferred !== "technical") return preferred;
  if (params.record) return "correct_record";
  if (params.scanEvent || params.item.exception.scan_event_id) return "resolve_scan";
  return "technical";
}

export function attendanceReviewPrimaryAction(kind: AttendanceReviewResolutionKind): string {
  if (kind === "correct_record") return "Correct attendance";
  if (kind === "resolve_scan") return "Decide saved scan";
  if (kind === "schedule") return "Add today’s schedule";
  if (kind === "branch") return "Correct branch";
  if (kind === "phone") return "Connect phone";
  if (kind === "service") return "Complete active work";
  return "Open technical repair";
}

export function attendanceReviewInstruction(
  kind: AttendanceReviewResolutionKind,
  item?: AttendanceReviewItem
): string {
  if (item) return item.diagnostic.crmInstruction;
  if (kind === "correct_record") {
    return "Review the stored clock-in and clock-out, then save the verified corrected times.";
  }
  if (kind === "resolve_scan") {
    return "Compare the saved scan, schedule, prior scans, and current Attendance state before deciding what the scan means.";
  }
  if (kind === "schedule") {
    return "Create or correct today’s verified shift, then process the preserved scan safely.";
  }
  if (kind === "branch") {
    return "Confirm the correct branch authority, then resume or request one new scan.";
  }
  if (kind === "phone") {
    return "Send a secure connection request to Staff Profile or guide the staff member on the current browser.";
  }
  if (kind === "service") {
    return "Complete, extend, or correct the active service or trip before clock-out.";
  }
  return "Preserve the evidence, repair the system contract, and verify the same scenario before closing the incident.";
}
