import type {
  AttendanceException,
  AttendanceRecord,
  AttendanceScanEvent,
  AttendanceWorkspaceData,
} from "@/lib/attendance/types";

export type RecoveryView =
  | "today"
  | "device_recovery"
  | "staff_day_repair"
  | "rules_safety"
  | "audit_log";

export type RecoveryIssueCategory =
  | "device_access"
  | "scan_recovery"
  | "staff_day_repair"
  | "rules_safety";

export type RecoveryIssuePriority = "high" | "medium" | "low";

export type RecoveryIssueSource =
  | "scan_event"
  | "exception"
  | "attendance_record"
  | "device_registry"
  | "system_rule";

export type RecoveryIssue = {
  id: string;
  category: RecoveryIssueCategory;
  priority: RecoveryIssuePriority;
  source: RecoveryIssueSource;
  title: string;
  subtitle: string;
  description: string;
  detectedAt: string;
  branchName: string;
  staffId: string | null;
  staffName: string | null;
  staffRole: string | null;
  deviceInfo: string | null;
  scanCount: number | null;
  recommendedAction: string;
  reasonBullets: string[];
  exception: AttendanceException | null;
  record: AttendanceRecord | null;
  scanEvent: AttendanceScanEvent | null;
};

export type RecoveryIssueCounts = {
  all: number;
  deviceAccess: number;
  scanRecovery: number;
  staffDayRepair: number;
  rulesSafety: number;
};

export type RecoveryWorkspaceProps = {
  data: AttendanceWorkspaceData;
};
