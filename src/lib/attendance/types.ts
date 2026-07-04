export type AttendanceTab =
  | "overview"
  | "records"
  | "sessions"
  | "qr"
  | "devices"
  | "exceptions"
  | "reports";

export const ATTENDANCE_TABS: Array<{ key: AttendanceTab; label: string }> = [
  { key: "overview", label: "Overview" },
  { key: "records", label: "Records" },
  { key: "sessions", label: "Sessions" },
  { key: "qr", label: "QR Codes" },
  { key: "devices", label: "Devices" },
  { key: "exceptions", label: "Exceptions" },
  { key: "reports", label: "Reports" },
];

export type QrPointType = "attendance" | "room" | "resource";
export type QrScanOutcome = "success" | "blocked" | "exception" | "error" | "noop";
export type QrScanType = "attendance" | "room" | "activation" | "unknown";

export type AttendanceSettings = {
  branch_id: string;
  duplicate_scan_window_seconds: number;
  clock_in_early_grace_minutes: number;
  clock_in_late_grace_minutes: number;
  clock_out_early_grace_minutes: number;
  clock_out_late_grace_minutes: number;
  overnight_shift_cutoff_time: string;
  active_service_blocks_clock_out: boolean;
  require_registered_device_for_attendance: boolean;
};

export type AttendanceQrConfiguration = {
  isConfigured: boolean;
  baseUrl: string | null;
  error: string | null;
};

export type AttendanceQrPoint = {
  id: string;
  branch_id: string;
  point_type: QrPointType;
  resource_id: string | null;
  public_code: string;
  label: string;
  description: string | null;
  is_active: boolean;
  requires_registered_device: boolean;
  scan_behavior: string;
  created_at: string;
  updated_at: string;
  resource_name: string | null;
  scan_url: string | null;
  svg: string | null;
};

export type AttendanceDevice = {
  id: string;
  staff_id: string;
  branch_id: string;
  device_label: string | null;
  status: "active" | "revoked";
  trusted_after: string;
  last_seen_at: string | null;
  created_at: string;
  staff_name: string;
};

export type DeviceRecoveryReason =
  | "browser_data_cleared"
  | "replacement_phone"
  | "lost_phone"
  | "device_cookie_expired"
  | "support_recovery"
  | "security_concern"
  | "other";

export type DeviceRevocationReason =
  | "lost_phone"
  | "replacement_phone"
  | "shared_device"
  | "security_concern"
  | "staff_request"
  | "browser_reset"
  | "other";

export type AttendanceDeviceStatus =
  | "active"
  | "never_used"
  | "recovery_pending"
  | "revoked"
  | "no_device"
  | "inactive_staff";

export type AttendanceDeviceRegistryEntry = {
  rowId: string;
  staffId: string;
  staffName: string;
  staffNickname: string | null;
  avatarUrl: string | null;
  staffType: string;
  staffIsActive: boolean;
  homeBranchId: string;
  homeBranchName: string;
  status: AttendanceDeviceStatus;
  device: {
    id: string;
    label: string;
    browserName: string | null;
    browserVersion: string | null;
    platformName: string | null;
    registeredAt: string;
    registrationSource: string | null;
    registeredBranchId: string | null;
    registeredBranchName: string | null;
    lastSeenAt: string | null;
    lastAttendanceScanAt: string | null;
    lastServiceScanAt: string | null;
    lastScanAt: string | null;
    totalSuccessfulScans: number;
    isActive: boolean;
    revokedAt: string | null;
    revokedByName: string | null;
    revocationReason: DeviceRevocationReason | string | null;
  } | null;
  pendingRecovery: {
    id: string;
    reason: DeviceRecoveryReason | string;
    createdAt: string;
    expiresAt: string;
    revokePreviousDeviceId: string | null;
  } | null;
};

export type PendingDeviceRecoveryLink = {
  id: string;
  staffId: string;
  staffName: string;
  staffNickname: string | null;
  branchId: string;
  branchName: string;
  reason: DeviceRecoveryReason | string;
  createdAt: string;
  expiresAt: string;
  revokePreviousDeviceId: string | null;
};

export type AttendanceDeviceRegistryData = {
  branchId: string;
  branchName: string;
  canSwitchBranch: boolean;
  branches: Array<{ id: string; name: string }>;
  staffOptions: Array<{
    id: string;
    name: string;
    staffType: string;
    branchId: string;
    branchName: string;
  }>;
  activeDevices: Array<{
    id: string;
    staffId: string;
    label: string;
  }>;
  entries: AttendanceDeviceRegistryEntry[];
  pendingRecoveryLinks: PendingDeviceRecoveryLink[];
};

export type RecoveryLinkResult = {
  tokenId: string;
  recoveryUrl: string;
  expiresAt: string;
  staffName: string;
  branchName: string;
  reason: DeviceRecoveryReason;
};

export type RecoveryTokenPreview =
  | {
      ok: true;
      staffName: string;
      staffType: string;
      branchName: string;
      expiresAt: string;
      reason: DeviceRecoveryReason | string;
    }
  | {
      ok: false;
      code:
        | "invalid_token"
        | "token_expired"
        | "token_used"
        | "token_revoked"
        | "staff_inactive"
        | "branch_unavailable";
      title: string;
      message: string;
    };

export type AttendanceRecord = {
  id: string;
  staff_id: string;
  staff_name: string;
  shift_date: string;
  shift_type: string;
  checked_in_at: string;
  checked_out_at: string | null;
  status: string;
  attendance_status: string;
  worked_minutes: number;
  late_minutes: number;
  early_leave_minutes: number;
  overtime_minutes: number;
  source_label: string | null;
};

export type AttendanceException = {
  id: string;
  branch_id: string;
  staff_id: string | null;
  staff_name: string | null;
  exception_type: string;
  severity: string;
  status: string;
  message: string;
  detected_at: string;
  resolved_at: string | null;
};

export type AttendanceScanEvent = {
  id: string;
  scan_type: QrScanType;
  action: string;
  outcome: QrScanOutcome;
  reason_code: string | null;
  message: string | null;
  created_at: string;
  staff_name: string | null;
  point_label: string | null;
  booking_id: string | null;
};

export type AttendanceScanFeedWorkspace = "crm" | "owner";

export type RecentAttendanceScan = {
  eventId: string;
  staffId: string;
  staffName: string;
  staffNickname: string | null;
  staffAvatarUrl: string | null;
  branchId: string | null;
  branchName: string | null;
  eventType: "clock_in" | "clock_out";
  occurredAt: string;
  shiftType: string | null;
  attendanceStatus: string | null;
  workedMinutes: number | null;
  sourceLabel: string | null;
};

export type AttendanceScanFeedData = {
  selectedDate: string;
  branchId: string | null;
  branchName: string | null;
  items: RecentAttendanceScan[];
  lastHourCount: number;
  error: string | null;
};

export type AttendanceRecordFilters = {
  staffId: string | null;
  date: string | null;
  branchId: string | null;
};

export type AttendanceSession = {
  id: string;
  customer_name: string;
  service_name: string;
  staff_name: string;
  resource_name: string | null;
  booking_date: string;
  start_time: string;
  status: string;
  booking_progress_status: string;
  session_started_at: string | null;
  session_due_at: string | null;
  session_completed_at: string | null;
  duration_minutes: number | null;
};

export type AttendanceWorkspaceData = {
  branchName: string;
  settings: AttendanceSettings;
  summary: {
    checkedInNow: number;
    recordsToday: number;
    openExceptions: number;
    activeSessions: number;
    activeDevices: number;
  };
  qrConfiguration: AttendanceQrConfiguration;
  qrPoints: AttendanceQrPoint[];
  devices: AttendanceDevice[];
  deviceRegistry: AttendanceDeviceRegistryData;
  records: AttendanceRecord[];
  exceptions: AttendanceException[];
  scanEvents: AttendanceScanEvent[];
  sessions: AttendanceSession[];
  staffOptions: Array<{ id: string; full_name: string; staff_type: string | null }>;
  resourceOptions: Array<{ id: string; name: string; type: string | null; is_active: boolean }>;
};

export type PublicScanResult = {
  ok: boolean;
  outcome: QrScanOutcome;
  title: string;
  message: string;
  detail?: string;
  scanEventId?: string;
  nextHref?: string;
  attendance?: {
    action: "clock_in" | "clock_out";
    staffName: string;
    branchName: string;
    shiftLabel: string;
    occurredAt: string;
    sessionStartedAt: string;
    workedMinutes?: number;
  };
  countdown?: {
    bookingId: string;
    customerName: string;
    serviceName: string;
    resourceName: string | null;
    startedAt: string;
    dueAt: string;
    durationMinutes: number;
  };
};
