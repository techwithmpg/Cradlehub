import type {
  AttendanceIssueCategory,
  AttendanceIssueTemplate,
} from "@/lib/attendance/issue-presentation-types";

const action = (id: AttendanceIssueTemplate["recommendedAction"]["id"], label: string) => ({
  id,
  label,
});

export const ATTENDANCE_ISSUE_CATALOG: Record<AttendanceIssueCategory, AttendanceIssueTemplate> = {
  phone_not_connected: {
    title: "Phone not connected",
    summary: "Attendance has not received a trusted scan from this staff phone.",
    explanation: "This phone has not been connected to the staff member’s Attendance account.",
    steps: [
      "Ask the staff member to scan the official branch QR code.",
      "Sign in using their own staff account.",
      "Choose Connect Phone when prompted.",
      "Wait for the final scan result.",
    ],
    recommendedAction: action("connect_phone", "Connect Phone"),
    secondaryActions: [
      action("copy_instructions", "Copy Instructions"),
      action("view_phone_details", "View Phone Details"),
    ],
    severity: "warning",
  },
  phone_revoked: {
    title: "Previous phone was disconnected",
    summary: "The previously connected phone cannot be used for Attendance.",
    explanation: "The previously registered phone can no longer be used for Attendance.",
    steps: [
      "Ask the staff member to use the current phone.",
      "Scan the official branch QR code.",
      "Sign in using their own account.",
      "Complete phone connection.",
    ],
    recommendedAction: action("connect_replacement_phone", "Connect Replacement Phone"),
    secondaryActions: [
      action("view_revoked_phones", "View Disconnected Phones"),
      action("copy_instructions", "Copy Instructions"),
    ],
    severity: "critical",
  },
  replacement_phone_required: {
    title: "Replacement phone needs connection",
    summary: "A phone recovery is pending for this staff member.",
    explanation:
      "The replacement phone must finish the secure connection before it can scan Attendance.",
    steps: [
      "Open the current recovery link.",
      "Use the staff member’s replacement phone.",
      "Finish connection, then scan the official QR again.",
    ],
    recommendedAction: action("connect_replacement_phone", "Connect Replacement Phone"),
    secondaryActions: [
      action("view_phone_details", "View Phone Details"),
      action("copy_instructions", "Copy Instructions"),
    ],
    severity: "warning",
  },
  wrong_branch: {
    title: "Wrong branch",
    summary: "The scan was made at a branch that does not match the current assignment.",
    explanation:
      "Attendance protected the staff record until CRM confirms where this shift should belong.",
    steps: [
      "Check the assigned and scanned branches.",
      "Confirm the staff schedule for today.",
      "Approve a temporary assignment or transfer permanently.",
      "Ask the staff member to scan again.",
    ],
    recommendedAction: action("approve_temporary_assignment", "Approve Temporary Assignment"),
    secondaryActions: [
      action("transfer_permanently", "Transfer Permanently"),
      action("reject_scan", "Reject Scan"),
      action("view_branch_history", "View Branch History"),
    ],
    severity: "critical",
  },
  no_schedule: {
    title: "No schedule found for today",
    summary: "Attendance cannot safely choose a shift for this scan.",
    explanation: "Attendance cannot safely decide which shift the scan belongs to.",
    steps: [
      "Open the staff schedule for today.",
      "Add or correct the shift only after confirming it.",
      "Ask the staff member to scan again when the schedule is ready.",
    ],
    recommendedAction: action("open_staff_schedule", "Open Staff Schedule"),
    secondaryActions: [
      action("add_today_shift", "Add Today’s Shift"),
      action("record_for_review", "Record for Review"),
    ],
    severity: "warning",
  },
  scan_too_early: {
    title: "Scan was too early",
    summary: "The scan arrived before the allowed clock-in window.",
    explanation: "Attendance kept the record unchanged because the shift is not open yet.",
    steps: [
      "Check the scheduled start time.",
      "Ask the staff member to wait for the allowed window.",
      "Scan the official QR again.",
    ],
    recommendedAction: action("wait", "Ask Staff to Wait"),
    secondaryActions: [action("view_latest_record", "View Latest Record")],
    severity: "info",
  },
  scan_too_late: {
    title: "Scan was outside the allowed time",
    summary: "The scan arrived after the normal attendance window.",
    explanation: "CRM review is needed before Attendance changes the staff record.",
    steps: [
      "Check the scheduled shift.",
      "Review the most recent scan.",
      "Apply only an authorized correction.",
    ],
    recommendedAction: action("record_for_review", "Record for Review"),
    secondaryActions: [action("view_latest_record", "View Latest Record")],
    severity: "warning",
  },
  stale_open_attendance: {
    title: "Previous clock-in is still open",
    summary: "An earlier attendance record has not been safely closed.",
    explanation: "Attendance stopped the next scan to prevent overlapping records.",
    steps: [
      "Review the original clock-in and expected shift.",
      "Check whether automated recovery already ran.",
      "Close or reset the record through the recovery workflow.",
      "Ask the staff member to scan again if required.",
    ],
    recommendedAction: action("review_previous_record", "Review Previous Record"),
    secondaryActions: [
      action("close_record_safely", "Close Record Safely"),
      action("fix_next_scan", "Fix Next Scan"),
      action("escalate", "Escalate"),
    ],
    severity: "critical",
  },
  duplicate_scan: {
    title: "Scan already received",
    summary: "The phone scanned again before the allowed retry interval.",
    explanation:
      "The latest valid attendance action is already recorded; no duplicate record was created.",
    steps: [
      "Check the latest successful scan.",
      "Wait for the retry interval to finish.",
      "Scan again only if another attendance action is needed.",
    ],
    recommendedAction: action("wait", "Ask Staff to Wait"),
    secondaryActions: [action("view_latest_record", "View Latest Record")],
    severity: "info",
  },
  clock_out_review: {
    title: "Clock-out needs review",
    summary: "Attendance could not safely complete this clock-out.",
    explanation: "A timing, service-session, or record-state rule needs CRM confirmation.",
    steps: [
      "Review the current service and shift.",
      "Check the latest successful scan.",
      "Use the authorized correction workflow if needed.",
    ],
    recommendedAction: action("correct_today_attendance", "Correct Today’s Attendance"),
    secondaryActions: [
      action("view_latest_record", "View Latest Record"),
      action("escalate", "Escalate"),
    ],
    severity: "warning",
  },
  branch_assignment_review: {
    title: "Branch assignment needs review",
    summary: "The staff assignment and Attendance branch need confirmation.",
    explanation: "Attendance protected the record until CRM confirms the correct branch.",
    steps: [
      "Review the staff assignment.",
      "Check today’s schedule and branch history.",
      "Apply the safe branch correction, then request a new scan.",
    ],
    recommendedAction: action("view_branch_history", "View Branch History"),
    secondaryActions: [
      action("approve_temporary_assignment", "Approve Temporary Assignment"),
      action("transfer_permanently", "Transfer Permanently"),
    ],
    severity: "warning",
  },
  device_limit_reached: {
    title: "Phone limit reached",
    summary: "Another phone cannot be connected until an existing one is disconnected.",
    explanation: "The staff account has reached its allowed number of connected phones.",
    steps: [
      "Review connected phones.",
      "Confirm which phone is no longer used.",
      "Disconnect it, then connect the current phone.",
    ],
    recommendedAction: action("view_phone_details", "Review Connected Phones"),
    secondaryActions: [action("connect_replacement_phone", "Connect Replacement Phone")],
    severity: "warning",
  },
  inactive_staff: {
    title: "Staff account is inactive",
    summary: "This account cannot use Attendance while inactive.",
    explanation: "Attendance access is disabled for inactive staff accounts.",
    steps: [
      "Confirm the staff member’s employment status.",
      "Ask an authorized manager to reactivate the account if appropriate.",
      "Scan again after access is restored.",
    ],
    recommendedAction: action("escalate", "Review Staff Access"),
    secondaryActions: [],
    severity: "critical",
  },
  unknown_issue: {
    title: "Scan needs review",
    summary: "Attendance could not safely complete this scan.",
    explanation: "The record was protected because the scan result needs CRM review.",
    steps: [
      "Review the latest scan and today’s schedule.",
      "Check the staff phone and current attendance record.",
      "Use only the available safe recovery action.",
    ],
    recommendedAction: action("record_for_review", "Open Fix Scan Problems"),
    secondaryActions: [
      action("view_latest_record", "View Latest Record"),
      action("escalate", "Escalate"),
    ],
    severity: "warning",
  },
};
