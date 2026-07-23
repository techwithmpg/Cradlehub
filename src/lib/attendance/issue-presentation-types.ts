export type AttendanceIssueCategory =
  | "phone_not_connected"
  | "phone_revoked"
  | "replacement_phone_required"
  | "wrong_branch"
  | "no_schedule"
  | "scan_too_early"
  | "scan_too_late"
  | "stale_open_attendance"
  | "duplicate_scan"
  | "clock_out_review"
  | "branch_assignment_review"
  | "device_limit_reached"
  | "inactive_staff"
  | "unknown_issue";

export type AttendanceIssueActionId =
  | "copy_instructions"
  | "connect_phone"
  | "connect_replacement_phone"
  | "view_phone_details"
  | "view_revoked_phones"
  | "approve_temporary_assignment"
  | "transfer_permanently"
  | "reject_scan"
  | "view_branch_history"
  | "open_staff_schedule"
  | "add_today_shift"
  | "record_for_review"
  | "review_previous_record"
  | "close_record_safely"
  | "fix_next_scan"
  | "escalate"
  | "wait"
  | "view_latest_record"
  | "view_attendance_history"
  | "manage_phone"
  | "correct_today_attendance";

export type AttendanceIssueAction = {
  id: AttendanceIssueActionId;
  label: string;
};

export type AttendanceIssuePresentation = {
  category: AttendanceIssueCategory;
  title: string;
  summary: string;
  explanation: string;
  steps: string[];
  recommendedAction: AttendanceIssueAction;
  secondaryActions: AttendanceIssueAction[];
  severity: "info" | "warning" | "critical";
  technicalCode?: string;
};

export type AttendanceIssueTemplate = Omit<
  AttendanceIssuePresentation,
  "category" | "technicalCode"
>;
