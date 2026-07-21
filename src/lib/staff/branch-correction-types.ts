export type BranchCorrectionStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "cancelled";

export type BranchCorrectionReviewStatus = Extract<
  BranchCorrectionStatus,
  "approved" | "rejected"
>;

export type BranchCorrectionDecisionType =
  | "temporary_branch_access_shift"
  | "temporary_branch_access_day"
  | "permanent_branch_transfer"
  | "rejected_wrong_branch";

export type BranchCorrectionResolutionStatus =
  | "pending"
  | "resolved"
  | "requires_review";

export type BranchCorrectionImpactSummary = {
  effectiveDate: string;
  futureBookings: number;
  futureBookingsAtCurrentBranch: number;
  activeWeeklySchedules: number;
  futureScheduleOverrides: number;
  serviceAssignments: number;
  servicesUnavailableAtScannedBranch: number;
  branchDutyAssignments: number;
  activeDevices: number;
  openAttendanceRecords: number;
  otherPendingBranchCorrections: number;
  branchSpecificSchedulingPreference: boolean;
  resourcePermissionReviewRequired: boolean;
  payrollHistoryPreserved: true;
};

export type BranchCorrectionScanDetails = {
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

export type BranchCorrectionInboxItem = {
  id: string;
  staffId: string;
  staffName: string;
  staffNickname: string | null;
  staffPhone: string | null;
  staffType: string | null;
  staffSystemRole: string | null;
  staffIsActive: boolean;
  currentBranchId: string | null;
  currentBranchName: string;
  requestedBranchId: string;
  requestedBranchName: string;
  qrPointLabel: string | null;
  qrPublicCode: string | null;
  scanEventId: string | null;
  requestSource: string;
  reason: string | null;
  status: BranchCorrectionStatus;
  createdAt: string;
  reviewedAt: string | null;
  reviewerNote: string | null;
  reviewerName: string | null;
  decisionType: BranchCorrectionDecisionType | null;
  resolutionStatus: BranchCorrectionResolutionStatus | null;
  temporaryValidFrom: string | null;
  temporaryValidUntil: string | null;
  attendanceBusinessDate: string | null;
  permanentEffectiveDate: string | null;
  attendanceCheckinId: string | null;
  continuationScanEventId: string | null;
  attendanceResult: Record<string, unknown> | null;
  impactSummary: BranchCorrectionImpactSummary | null;
  isTest: boolean;
};

export type BranchCorrectionResolutionInput = {
  requestId: string;
  decisionType: Exclude<BranchCorrectionDecisionType, "rejected_wrong_branch">;
  reason?: string | null;
};

export type BranchCorrectionRequestResult =
  | {
      ok: true;
      requestId: string;
      alreadyPending: boolean;
      status: BranchCorrectionStatus;
      message: string;
    }
  | {
      ok: false;
      code:
        | "UNAUTHENTICATED"
        | "INVALID_INPUT"
        | "NOT_ELIGIBLE"
        | "QR_NOT_FOUND"
        | "ALREADY_MATCHES"
        | "REQUEST_FAILED";
      message: string;
    };

export type BranchCorrectionReviewResult =
  | {
      ok: true;
      requestId: string;
      status: BranchCorrectionStatus;
      resolutionStatus?: BranchCorrectionResolutionStatus;
      decisionType?: BranchCorrectionDecisionType;
      attendanceResult?: Record<string, unknown> | null;
      message: string;
    }
  | {
      ok: false;
      code:
        | "UNAUTHENTICATED"
        | "UNAUTHORIZED"
        | "INVALID_INPUT"
        | "NOT_PENDING"
        | "STALE_REQUEST"
        | "INACTIVE_BRANCH"
        | "SOURCE_SCAN_UNAVAILABLE"
        | "CONFLICTING_AUTHORIZATION"
        | "REASON_REQUIRED"
        | "TEST_MODE_RESTRICTED"
        | "INVALID_VALIDITY"
        | "EFFECTIVE_DATE_REQUIRED"
        | "ATTENDANCE_ALREADY_COMPLETED"
        | "ATTENDANCE_CONFLICT"
        | "REVIEW_FAILED";
      message: string;
    };

export type BranchAssignmentIssueSource =
  | "attendance_scan"
  | "staff_management"
  | "schedule_conflict"
  | "booking_assignment"
  | "availability_check"
  | "online_booking_exclusion"
  | "transfer_audit"
  | "temporary_access_conflict"
  | "manual_review"
  | "system_integrity_check";

export type BranchAssignmentIssueStatus =
  | "open"
  | "resolved"
  | "resolved_with_booking_review"
  | "requires_review"
  | "dismissed";

export type BranchAssignmentRootCause =
  | "profile_branch_incorrect"
  | "schedule_branch_incorrect"
  | "booking_branch_mismatch"
  | "service_assignment_mismatch"
  | "temporary_access_missing"
  | "temporary_access_expired"
  | "temporary_access_conflict"
  | "incomplete_permanent_transfer"
  | "inactive_primary_branch"
  | "missing_primary_branch"
  | "cross_branch_future_assignments"
  | "open_attendance_branch_conflict"
  | "wrong_qr_scan_only"
  | "ambiguous_branch_state"
  | "already_resolved";

export type BranchAssignmentResolutionType =
  | "correct_permanent_primary_branch"
  | "grant_temporary_branch_access"
  | "repair_schedule_branch"
  | "repair_service_assignments"
  | "review_future_bookings"
  | "complete_incomplete_transfer"
  | "fix_temporary_access_conflict"
  | "confirm_wrong_qr_scan"
  | "require_manual_review";

export type BranchAssignmentIssue = {
  id: string;
  staffId: string;
  staffName: string;
  staffNickname: string | null;
  staffType: string | null;
  staffSystemRole: string | null;
  staffIsActive: boolean;
  source: BranchAssignmentIssueSource;
  status: BranchAssignmentIssueStatus;
  profileBranchId: string | null;
  profileBranchName: string;
  affectedBranchId: string | null;
  affectedBranchName: string | null;
  scanEventId: string | null;
  rootCauses: BranchAssignmentRootCause[];
  scheduleBranches: string[];
  bookingBranches: Array<{ name: string; count: number }>;
  activeTemporaryPermissionCount: number;
  openAttendanceCount: number;
  recommendedResolution: BranchAssignmentResolutionType;
  repairsRequiringReview: Array<{ type: string; message: string }>;
  nextAction: string | null;
  reason: string | null;
  createdAt: string;
  decidedAt: string | null;
  resolutionType: BranchAssignmentResolutionType | null;
  isTest: boolean;
};

export type BranchAssignmentResolutionInput = {
  issueId: string;
  resolutionType: BranchAssignmentResolutionType;
  reason: string;
  effectiveDate?: string | null;
  validFrom?: string | null;
  validUntil?: string | null;
  selectedRepairs?: Record<string, unknown>;
  impactSummary?: Record<string, unknown>;
};

export type BranchAssignmentResolutionResult =
  | {
      ok: true;
      issueId: string;
      issueStatus: BranchAssignmentIssueStatus;
      resolutionType: BranchAssignmentResolutionType;
      previousBranchId: string | null;
      resolvedBranchId: string | null;
      temporaryAuthorizationId: string | null;
      repairsApplied: Array<Record<string, unknown>>;
      repairsRequiringReview: Array<Record<string, unknown>>;
      nextAction: string;
      message: string;
    }
  | {
      ok: false;
      code:
        | "INVALID_INPUT"
        | "UNAUTHENTICATED"
        | "UNAUTHORIZED"
        | "NOT_FOUND"
        | "NOT_PENDING"
        | "REASON_REQUIRED"
        | "INVALID_TEMPORARY_VALIDITY"
        | "REQUIRES_REVIEW"
        | "RESOLUTION_FAILED";
      message: string;
    };
