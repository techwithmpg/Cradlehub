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
  { key: "exceptions", label: "Recovery" },
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
  timezone: string;
  attendance_day_boundary: string;
  early_clock_in_allowed_minutes: number;
  late_grace_minutes: number;
  clock_in_window_before_shift_minutes: number;
  clock_in_window_after_shift_start_minutes: number;
  clock_out_window_before_shift_end_minutes: number;
  clock_out_window_after_shift_end_minutes: number;
  early_leave_threshold_minutes: number;
  overtime_threshold_minutes: number;
  duplicate_scan_debounce_minutes: number;
  first_scan_closing_behavior:
    | "flag_for_recovery"
    | "treat_as_clock_out_launch_only"
    | "require_manager_confirmation"
    | "never_auto_clock_in";
  missing_schedule_behavior: "flag_for_recovery" | "allow_clock_in_with_exception" | "block_scan";
  off_day_scan_behavior: "flag_for_recovery" | "allow_clock_in_with_exception" | "block_scan";
  ambiguous_scan_behavior: "flag_for_recovery" | "require_manager_confirmation" | "block_scan";
  launch_recovery_enabled: boolean;
  launch_recovery_start_date: string | null;
  launch_recovery_end_date: string | null;
  launch_recovery_closing_start_time: string;
  launch_recovery_closing_end_time: string;
  launch_recovery_reason: string | null;
  test_mode_enabled: boolean;
  test_mode_reason: string | null;
  test_mode_enabled_at: string | null;
  test_mode_enabled_by: string | null;
  test_mode_disabled_at: string | null;
  test_mode_disabled_by: string | null;
  updated_by: string | null;
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
  status: "active" | "revoked" | "expired" | "lost" | "stolen" | "security_blocked";
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
  registrationRequests: import("@/lib/attendance/device-registration").StaffDeviceRegistrationRequest[];
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
  branch_id: string;
  staff_id: string;
  staff_name: string;
  staff_nickname: string | null;
  staff_type: string | null;
  system_role: string | null;
  shift_date: string;
  shift_type: string;
  scheduled_start_at: string | null;
  scheduled_end_at: string | null;
  checked_in_at: string;
  checked_out_at: string | null;
  status: string;
  attendance_status: string;
  exception_state: string | null;
  worked_minutes: number;
  late_minutes: number;
  early_leave_minutes: number;
  overtime_minutes: number;
  clock_in_method: string | null;
  clock_out_method: string | null;
  source_label: string | null;
};

export type AttendanceException = {
  id: string;
  branch_id: string;
  staff_id: string | null;
  checkin_id: string | null;
  scan_event_id: string | null;
  staff_name: string | null;
  exception_type: string;
  severity: string;
  status: string;
  message: string;
  metadata: Record<string, unknown>;
  detected_at: string;
  resolved_at: string | null;
};

export type AttendanceCorrection = {
  id: string;
  branch_id: string;
  staff_id: string | null;
  staff_name: string | null;
  checkin_id: string | null;
  attendance_date: string | null;
  action_type: string;
  correction_type: string;
  reason: string;
  status: string;
  previous_values: Record<string, unknown>;
  new_values: Record<string, unknown>;
  requested_by: string | null;
  approved_by: string | null;
  corrected_by: string | null;
  corrected_by_name: string | null;
  applied_at: string | null;
  corrected_at: string | null;
  created_at: string;
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
  staffId: string | null;
  staffName: string;
  staffNickname: string | null;
  staffAvatarUrl: string | null;
  branchId: string | null;
  branchName: string | null;
  eventType: string;
  outcome: QrScanOutcome;
  reasonCode: string | null;
  message: string | null;
  occurredAt: string;
  timezone: string;
  shiftType: string | null;
  attendanceStatus: string | null;
  workedMinutes: number | null;
  clockInAt: string | null;
  clockOutAt: string | null;
  sourceLabel: string | null;
};

export type AttendanceScanFeedData = {
  selectedDate: string;
  timezone: string;
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
  staff_id: string;
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
  branchId: string;
  branchName: string;
  businessDate: string;
  timezone: string;
  serverNowMs: number;
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
  corrections: AttendanceCorrection[];
  scanEvents: AttendanceScanEvent[];
  sessions: AttendanceSession[];
  dailyStaffStates: import("@/lib/attendance/day-model").AttendanceDayStaffState[];
  staffOptions: Array<{ id: string; full_name: string; staff_type: string | null }>;
  resourceOptions: Array<{ id: string; name: string; type: string | null; is_active: boolean }>;
};

export type PublicScanResult = {
  ok: boolean;
  outcome: QrScanOutcome;
  reasonCode?: string;
  severity?: "success" | "info" | "warning" | "critical";
  title: string;
  message: string;
  detail?: string;
  securityNote?: string;
  scanEventId?: string;
  operationId?: string;
  recoverable?: boolean;
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
  branchCorrection?: {
    staffId: string;
    staffName: string;
    currentBranchId: string;
    currentBranchName: string;
    requestedBranchId: string;
    requestedBranchName: string;
    qrPointId: string;
    scanEventId?: string;
    publicCode?: string;
    deviceId?: string;
    canRequestBranchCorrection?: boolean;
    existingPendingRequest?: {
      id: string;
      createdAt: string;
      requestedBranchName: string;
    } | null;
  };
};
