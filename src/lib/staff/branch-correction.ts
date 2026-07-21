import "server-only";

import { hashSecret } from "@/lib/attendance/tokens";
import {
  buildAttendanceScanCommitRpcArgs,
  resumeAttendanceScanFromStoredSource,
  resolveClosingInterventionSignals,
  type AttendanceScanCommitInput,
  type AttendanceScanCommitResult,
  type ProvisionalAttendanceReconcileInput,
} from "@/lib/attendance/scan-engine";
import { getAttendanceSettings } from "@/lib/attendance/queries";
import {
  isAttendanceScanError,
  logAttendanceScanError,
} from "@/lib/attendance/scan-errors";
import {
  branchDateTimeToIsoInTimezone,
  getAttendanceBranchNow,
} from "@/lib/attendance/shift-instance";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createOrUpdateNotification,
  createOrUpdateWorkflowTask,
} from "@/lib/notifications/workflow-signals";
import type { Database, Json } from "@/types/supabase";
import { mapBranchResolutionCode } from "./branch-correction-errors";
import {
  canRequestBranchCorrection,
  canReviewBranchCorrectionRequest,
  canSeeAllBranchCorrectionRequests,
  type BranchCorrectionActor,
} from "./branch-correction-policy";
import type {
  BranchCorrectionInboxItem,
  BranchCorrectionImpactSummary,
  BranchCorrectionDecisionType,
  BranchCorrectionRequestResult,
  BranchCorrectionResolutionInput,
  BranchCorrectionReviewResult,
  BranchCorrectionReviewStatus,
  BranchCorrectionScanDetails,
  BranchCorrectionStatus,
} from "./branch-correction-types";
import type { PublicScanResult } from "@/lib/attendance/types";

type AdminClient = ReturnType<typeof createAdminClient>;
type RequestRow = Database["public"]["Tables"]["staff_branch_change_requests"]["Row"];

type BranchRelation =
  | { id?: string | null; name: string | null; is_active?: boolean | null }
  | Array<{ id?: string | null; name: string | null; is_active?: boolean | null }>
  | null
  | undefined;

type StaffRelation =
  | {
      id: string;
      full_name: string | null;
      nickname: string | null;
      phone: string | null;
      staff_type: string | null;
      system_role: string | null;
      is_active: boolean;
      branch_id: string | null;
      branches?: BranchRelation;
    }
  | Array<{
      id: string;
      full_name: string | null;
      nickname: string | null;
      phone: string | null;
      staff_type: string | null;
      system_role: string | null;
      is_active: boolean;
      branch_id: string | null;
      branches?: BranchRelation;
    }>
  | null
  | undefined;

type QrPointRelation =
  | { id: string; label: string | null }
  | Array<{ id: string; label: string | null }>
  | null
  | undefined;

type InboxRow = RequestRow & {
  staff?: StaffRelation;
  reviewer?: StaffRelation;
  current_branch?: BranchRelation;
  requested_branch?: BranchRelation;
  qr_points?: QrPointRelation;
};

type ResolutionRpcRow = {
  success: boolean;
  code: string;
  request_id: string;
  request_status: string;
  resolution_status: string | null;
  authorization_id: string | null;
  scan_event_id: string | null;
  checkin_id: string | null;
  operation_result: unknown;
  message: string;
};

class BranchResolutionTransactionError extends Error {
  readonly resolutionCode: string | null;

  constructor(resolutionCode: string | null) {
    super("branch_resolution_transaction_failed");
    this.name = "BranchResolutionTransactionError";
    this.resolutionCode = resolutionCode;
  }
}

function scanCommitFailureCode(...diagnostics: Array<string | null | undefined>): string | null {
  const match = diagnostics
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .match(/branch_correction_scan_commit_failed:([a-z0-9_]+)/i);
  return match?.[1]?.toLowerCase() ?? null;
}

type AuthStaffRow = {
  id: string;
  branch_id: string | null;
  full_name: string | null;
  is_active: boolean;
  branches?: BranchRelation;
};

type DeviceStaffRow = {
  id: string;
  branch_id: string | null;
  status: string;
  staff?:
    | {
        id: string;
        branch_id: string | null;
        full_name: string | null;
        is_active: boolean;
        branches?: BranchRelation;
      }
    | Array<{
        id: string;
        branch_id: string | null;
        full_name: string | null;
        is_active: boolean;
        branches?: BranchRelation;
      }>
    | null;
};

type QrPointRow = {
  id: string;
  branch_id: string;
  label: string | null;
  point_type: string;
  is_active: boolean;
  public_code?: string | null;
  branches?: BranchRelation;
};

function first<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function branchName(branch: BranchRelation, fallback: string): string {
  return first(branch)?.name ?? fallback;
}

function metadataObject(metadata: Json): Record<string, unknown> {
  return metadata !== null && typeof metadata === "object" && !Array.isArray(metadata) ? metadata : {};
}

function normalizeStatus(status: string): BranchCorrectionStatus {
  if (
    status === "approved" ||
    status === "rejected" ||
    status === "cancelled" ||
    status === "pending"
  ) {
    return status;
  }
  return "pending";
}

function normalizeDecisionType(value: unknown): BranchCorrectionDecisionType | null {
  return value === "temporary_branch_access_shift" ||
    value === "temporary_branch_access_day" ||
    value === "permanent_branch_transfer" ||
    value === "rejected_wrong_branch"
    ? value
    : null;
}

function jsonRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function impactSummary(value: unknown): BranchCorrectionImpactSummary | null {
  const record = jsonRecord(value);
  if (!record || typeof record.effectiveDate !== "string") return null;
  return record as unknown as BranchCorrectionImpactSummary;
}

function isPublicScanResult(value: unknown): value is PublicScanResult {
  const record = jsonRecord(value);
  return Boolean(
    record &&
      typeof record.ok === "boolean" &&
      typeof record.outcome === "string" &&
      typeof record.title === "string" &&
      typeof record.message === "string"
  );
}

async function loadStaffForRequest(
  admin: AdminClient,
  authUserId: string,
  staffId: string
): Promise<AuthStaffRow | null> {
  const { data, error } = await admin
    .from("staff")
    .select("id, branch_id, full_name, is_active, branches(name)")
    .eq("id", staffId)
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (error) return null;
  return (data as AuthStaffRow | null) ?? null;
}

async function loadStaffForDeviceCredential(
  admin: AdminClient,
  rawDeviceCredential: string,
  staffId: string
): Promise<{ staff: AuthStaffRow; deviceId: string; deviceBranchId: string | null } | null> {
  const { data, error } = await admin
    .from("staff_devices")
    .select(`
      id,
      branch_id,
      status,
      staff:staff!staff_devices_staff_id_fkey(
        id,
        branch_id,
        full_name,
        is_active,
        branches(name)
      )
    `)
    .eq("device_fingerprint_hash", hashSecret(rawDeviceCredential))
    .maybeSingle();

  if (error || !data) return null;

  const device = data as DeviceStaffRow;
  const staff = first(device.staff);
  if (!staff || device.status !== "active" || !staff.is_active || staff.id !== staffId) {
    return null;
  }

  return {
    staff: {
      id: staff.id,
      branch_id: staff.branch_id,
      full_name: staff.full_name,
      is_active: staff.is_active,
      branches: staff.branches,
    },
    deviceId: device.id,
    deviceBranchId: device.branch_id,
  };
}

async function loadAttendanceQrPoint(
  admin: AdminClient,
  details: BranchCorrectionScanDetails
): Promise<QrPointRow | null> {
  let query = admin
    .from("qr_points")
    .select("id, branch_id, label, point_type, is_active, public_code, branches(name, is_active)")
    .eq("id", details.qrPointId);

  if (details.publicCode) query = query.eq("public_code", details.publicCode);

  const { data, error } = await query.maybeSingle();
  if (error) return null;
  return (data as QrPointRow | null) ?? null;
}

async function loadPendingRequest(
  admin: AdminClient,
  staffId: string,
  requestedBranchId: string
): Promise<RequestRow | null> {
  const { data } = await admin
    .from("staff_branch_change_requests")
    .select("*")
    .eq("staff_id", staffId)
    .eq("requested_branch_id", requestedBranchId)
    .eq("status", "pending")
    .maybeSingle();

  return (data as RequestRow | null) ?? null;
}

async function loadSourceWrongBranchScan(params: {
  admin: AdminClient;
  scanEventId?: string | null;
  staffId: string;
  qrPointId: string;
  deviceId?: string | null;
  around?: string | null;
}): Promise<{ id: string; isTest: boolean } | null> {
  let exactQuery = params.admin
    .from("qr_scan_events")
    .select("id, is_test")
    .eq("staff_id", params.staffId)
    .eq("qr_point_id", params.qrPointId)
    .eq("reason_code", "wrong_branch");
  if (params.deviceId) exactQuery = exactQuery.eq("device_id", params.deviceId);

  if (params.scanEventId) {
    const exact = await exactQuery.eq("id", params.scanEventId).maybeSingle();
    if (!exact.error && exact.data) {
      return { id: exact.data.id, isTest: exact.data.is_test };
    }
    return null;
  }

  const center = params.around ? new Date(params.around) : new Date();
  const from = new Date(center.getTime() - 15 * 60_000).toISOString();
  const to = new Date(center.getTime() + 5 * 60_000).toISOString();
  const candidates = await exactQuery
    .gte("created_at", from)
    .lte("created_at", to)
    .order("created_at", { ascending: false })
    .limit(2);
  if (candidates.error || candidates.data?.length !== 1) return null;
  return {
    id: candidates.data[0]!.id,
    isTest: candidates.data[0]!.is_test,
  };
}

export async function createBranchCorrectionRequestForScan(params: {
  authUserId?: string | null;
  rawDeviceCredential?: string | null;
  details: BranchCorrectionScanDetails;
  reason?: string | null;
  userAgent?: string | null;
}): Promise<BranchCorrectionRequestResult> {
  const admin = createAdminClient();
  const point = await loadAttendanceQrPoint(admin, params.details);
  const pointBranch = first(point?.branches);
  if (!point || !point.is_active || point.point_type !== "attendance") {
    return {
      ok: false,
      code: "QR_NOT_FOUND",
      message: "This attendance QR could not be verified. Please scan again.",
    };
  }

  if (pointBranch?.is_active === false) {
    return {
      ok: false,
      code: "QR_NOT_FOUND",
      message: "This attendance branch is not active. Please ask the front desk for help.",
    };
  }

  const authStaff = params.authUserId
    ? await loadStaffForRequest(admin, params.authUserId, params.details.staffId)
    : null;
  const deviceStaff = params.rawDeviceCredential
    ? await loadStaffForDeviceCredential(admin, params.rawDeviceCredential, params.details.staffId)
    : null;
  const staff = authStaff ?? deviceStaff?.staff ?? null;
  const deviceId = params.details.deviceId ?? deviceStaff?.deviceId ?? null;

  if (!staff) {
    return {
      ok: false,
      code: "NOT_ELIGIBLE",
      message: "This staff account could not be verified for branch correction.",
    };
  }

  if (staff.branch_id === point.branch_id) {
    return {
      ok: false,
      code: "ALREADY_MATCHES",
      message: "Your branch already matches this QR branch.",
    };
  }

  if (
    point.branch_id !== params.details.requestedBranchId ||
    staff.branch_id !== params.details.currentBranchId ||
    !canRequestBranchCorrection({
      staffIsActive: staff.is_active,
      currentBranchId: staff.branch_id,
      requestedBranchId: point.branch_id,
    })
  ) {
    return {
      ok: false,
      code: "NOT_ELIGIBLE",
      message: "This branch correction request is no longer eligible. Please scan again.",
    };
  }

  const existing = await loadPendingRequest(admin, staff.id, point.branch_id);
  if (existing) {
    return {
      ok: true,
      requestId: existing.id,
      alreadyPending: true,
      status: "pending",
      message: "A branch correction request is already waiting for CRM review.",
    };
  }


  const sourceScan = await loadSourceWrongBranchScan({
    admin,
    scanEventId: params.details.scanEventId,
    staffId: staff.id,
    qrPointId: point.id,
    deviceId,
  });
  if (!sourceScan) {
    return {
      ok: false,
      code: "REQUEST_FAILED",
      message: "The original Attendance scan could not be linked. Please scan once more or ask CRM for help.",
    };
  }

  const metadata: Json = {
    request_source: "qr_wrong_branch",
    source: "public_wrong_branch_scan",
    scanned_branch_id: point.branch_id,
    scanned_branch_name: branchName(point.branches, params.details.requestedBranchName),
    current_staff_branch_id: staff.branch_id,
    current_staff_branch_name: branchName(staff.branches, params.details.currentBranchName),
    applicant_selected_branch_id: point.branch_id,
    applicant_selected_branch_name: branchName(point.branches, params.details.requestedBranchName),
    qr_point_id: point.id,
    qr_public_code: params.details.publicCode ?? point.public_code ?? null,
    scan_event_id: sourceScan.id,
    device_id: deviceId,
    device_branch_id: deviceStaff?.deviceBranchId ?? null,
    staff_branch_name_seen: branchName(staff.branches, params.details.currentBranchName),
    requested_branch_name_seen: branchName(point.branches, params.details.requestedBranchName),
    user_agent: params.userAgent ?? null,
  };

  const inserted = await admin
    .from("staff_branch_change_requests")
    .insert({
      staff_id: staff.id,
      current_branch_id: staff.branch_id,
      requested_branch_id: point.branch_id,
      qr_point_id: point.id,
      scan_event_id: sourceScan.id,
      requested_by_auth_user_id: params.authUserId ?? null,
      requested_by_staff_id: staff.id,
      request_source: "qr_wrong_branch",
      reason: params.reason?.trim() || null,
      status: "pending",
      resolution_status: "pending",
      is_test: sourceScan.isTest,
      metadata,
    })
    .select("id, status")
    .single();

  if (inserted.error) {
    const duplicate = await loadPendingRequest(admin, staff.id, point.branch_id);
    if (duplicate) {
      return {
        ok: true,
        requestId: duplicate.id,
        alreadyPending: true,
        status: "pending",
        message: "A branch correction request is already waiting for CRM review.",
      };
    }

    return {
      ok: false,
      code: "REQUEST_FAILED",
      message: "We could not send this request. Please ask the front desk for help.",
    };
  }

  return {
    ok: true,
    requestId: inserted.data.id,
    alreadyPending: false,
    status: normalizeStatus(inserted.data.status),
    message: "Request submitted. CRM can resolve this scan; you do not need to scan again.",
  };
}

export async function getBranchCorrectionInboxForActor(
  actor: BranchCorrectionActor
): Promise<BranchCorrectionInboxItem[]> {
  const admin = createAdminClient();
  let query = admin
    .from("staff_branch_change_requests")
    .select(`
      *,
      staff:staff!staff_branch_change_requests_staff_id_fkey(
        id,
        full_name,
        nickname,
        phone,
        staff_type,
        system_role,
        is_active,
        branch_id,
        branches(name)
      ),
      reviewer:staff!staff_branch_change_requests_reviewed_by_staff_id_fkey(
        id,
        full_name,
        nickname,
        phone,
        staff_type,
        system_role,
        is_active,
        branch_id
      ),
      current_branch:branches!staff_branch_change_requests_current_branch_id_fkey(id, name),
      requested_branch:branches!staff_branch_change_requests_requested_branch_id_fkey(id, name),
      qr_points:qr_points!staff_branch_change_requests_qr_point_id_fkey(id, label)
    `)
    .in("status", ["pending", "approved", "rejected"])
    .order("created_at", { ascending: false })
    .limit(50);

  if (!canSeeAllBranchCorrectionRequests(actor.systemRole)) {
    if (!actor.branchId) return [];
    query = query.eq("requested_branch_id", actor.branchId);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[staff/branch-correction] inbox query failed", {
      errorCode: error.code,
      safeMessage: "branch correction inbox query failed",
      actorRole: actor.systemRole,
      actorBranchId: actor.branchId,
    });
    return [];
  }

  return ((data ?? []) as InboxRow[]).map((row) => {
    const staff = first(row.staff);
    const reviewer = first(row.reviewer);
    const metadata = metadataObject(row.metadata);
    const qrPublicCode =
      typeof metadata.qr_public_code === "string" ? metadata.qr_public_code : null;
    return {
      id: row.id,
      staffId: row.staff_id,
      staffName: staff?.full_name ?? "Staff member",
      staffNickname: staff?.nickname ?? null,
      staffPhone: staff?.phone ?? null,
      staffType: staff?.staff_type ?? null,
      staffSystemRole: staff?.system_role ?? null,
      staffIsActive: staff?.is_active ?? false,
      currentBranchId: row.current_branch_id,
      currentBranchName: branchName(row.current_branch, "Current branch"),
      requestedBranchId: row.requested_branch_id,
      requestedBranchName: branchName(row.requested_branch, "Requested branch"),
      qrPointLabel: first(row.qr_points)?.label ?? null,
      qrPublicCode,
      scanEventId: row.scan_event_id,
      requestSource: row.request_source,
      reason: row.reason,
      status: normalizeStatus(row.status),
      createdAt: row.created_at,
      reviewedAt: row.reviewed_at,
      reviewerNote: row.reviewer_note,
      reviewerName: reviewer?.full_name ?? null,
      decisionType: normalizeDecisionType(row.decision_type),
      resolutionStatus:
        row.resolution_status === "pending" ||
        row.resolution_status === "resolved" ||
        row.resolution_status === "requires_review"
          ? row.resolution_status
          : null,
      temporaryValidFrom: row.temporary_valid_from,
      temporaryValidUntil: row.temporary_valid_until,
      attendanceBusinessDate: row.attendance_business_date,
      permanentEffectiveDate: row.permanent_effective_date,
      attendanceCheckinId: row.attendance_checkin_id,
      continuationScanEventId: row.continuation_scan_event_id,
      attendanceResult: jsonRecord(row.attendance_result),
      impactSummary: impactSummary(row.impact_summary),
      isTest: row.is_test,
    };
  });
}

type ResolutionRequestRow = {
  id: string;
  staff_id: string;
  current_branch_id: string | null;
  requested_branch_id: string;
  qr_point_id: string | null;
  scan_event_id: string | null;
  status: string;
  decision_type: string | null;
  resolution_status: string | null;
  attendance_result: unknown;
  created_at: string;
};

async function loadResolutionRequest(
  admin: AdminClient,
  requestId: string
): Promise<ResolutionRequestRow | null> {
  const { data, error } = await admin
    .from("staff_branch_change_requests")
    .select("id, staff_id, current_branch_id, requested_branch_id, qr_point_id, scan_event_id, status, decision_type, resolution_status, attendance_result, created_at")
    .eq("id", requestId)
    .maybeSingle();
  return error ? null : data as ResolutionRequestRow | null;
}

async function buildBranchCorrectionImpactSummary(params: {
  admin: AdminClient;
  request: ResolutionRequestRow;
  effectiveDate: string;
}): Promise<BranchCorrectionImpactSummary> {
  const { admin, request, effectiveDate } = params;
  const [
    bookings,
    weeklySchedules,
    scheduleOverrides,
    staffServices,
    dutyAssignments,
    activeDevices,
    openAttendance,
    pendingCorrections,
    schedulingPreference,
  ] = await Promise.all([
    admin
      .from("bookings")
      .select("id, branch_id")
      .eq("staff_id", request.staff_id)
      .gte("booking_date", effectiveDate)
      .not("status", "in", '("cancelled","completed","no_show")')
      .limit(500),
    admin
      .from("staff_schedules")
      .select("id", { count: "exact", head: true })
      .eq("staff_id", request.staff_id)
      .eq("is_active", true),
    admin
      .from("schedule_overrides")
      .select("id", { count: "exact", head: true })
      .eq("staff_id", request.staff_id)
      .gte("override_date", effectiveDate),
    admin
      .from("staff_services")
      .select("service_id")
      .eq("staff_id", request.staff_id)
      .limit(500),
    admin
      .from("staff_duty_assignments")
      .select("id", { count: "exact", head: true })
      .eq("staff_id", request.staff_id)
      .eq("is_active", true),
    admin
      .from("staff_devices")
      .select("id", { count: "exact", head: true })
      .eq("staff_id", request.staff_id)
      .eq("status", "active"),
    admin
      .from("staff_shift_checkins")
      .select("id", { count: "exact", head: true })
      .eq("staff_id", request.staff_id)
      .eq("status", "checked_in")
      .is("checked_out_at", null),
    admin
      .from("staff_branch_change_requests")
      .select("id", { count: "exact", head: true })
      .eq("staff_id", request.staff_id)
      .eq("status", "pending")
      .neq("id", request.id),
    admin
      .from("staff_scheduling_preferences")
      .select("branch_id")
      .eq("staff_id", request.staff_id)
      .maybeSingle(),
  ]);

  const impactQueryError = [
    bookings.error,
    weeklySchedules.error,
    scheduleOverrides.error,
    staffServices.error,
    dutyAssignments.error,
    activeDevices.error,
    openAttendance.error,
    pendingCorrections.error,
    schedulingPreference.error,
  ].find(Boolean);
  if (impactQueryError) throw new Error("branch_correction_impact_query_failed");

  const serviceIds = (staffServices.data ?? []).map((row) => row.service_id);
  const targetBranchServices = serviceIds.length > 0
    ? await admin
        .from("branch_services")
        .select("service_id")
        .eq("branch_id", request.requested_branch_id)
        .eq("is_active", true)
        .in("service_id", serviceIds)
        .limit(500)
    : { data: [] as Array<{ service_id: string }>, error: null };
  if (targetBranchServices.error) throw new Error("branch_correction_service_impact_query_failed");
  const availableServiceIds = new Set(
    (targetBranchServices.data ?? []).map((row) => row.service_id)
  );
  const futureBookings = bookings.data ?? [];

  return {
    effectiveDate,
    futureBookings: futureBookings.length,
    futureBookingsAtCurrentBranch: futureBookings.filter(
      (booking) => booking.branch_id === request.current_branch_id
    ).length,
    activeWeeklySchedules: weeklySchedules.count ?? 0,
    futureScheduleOverrides: scheduleOverrides.count ?? 0,
    serviceAssignments: serviceIds.length,
    servicesUnavailableAtScannedBranch: serviceIds.filter(
      (serviceId) => !availableServiceIds.has(serviceId)
    ).length,
    branchDutyAssignments: dutyAssignments.count ?? 0,
    activeDevices: activeDevices.count ?? 0,
    openAttendanceRecords: openAttendance.count ?? 0,
    otherPendingBranchCorrections: pendingCorrections.count ?? 0,
    branchSpecificSchedulingPreference: Boolean(schedulingPreference.data?.branch_id),
    resourcePermissionReviewRequired: (dutyAssignments.count ?? 0) > 0,
    payrollHistoryPreserved: true,
  };
}

export async function getBranchCorrectionImpactForActor(params: {
  actor: BranchCorrectionActor;
  requestId: string;
}): Promise<
  | { ok: true; summary: BranchCorrectionImpactSummary }
  | { ok: false; message: string }
> {
  const admin = createAdminClient();
  const request = await loadResolutionRequest(admin, params.requestId);
  if (!request) return { ok: false, message: "This branch correction request was not found." };
  if (!canReviewBranchCorrectionRequest(params.actor, { requestedBranchId: request.requested_branch_id })) {
    return { ok: false, message: "You can only review correction requests for your branch." };
  }
  const settings = await getAttendanceSettings(request.requested_branch_id);
  const effectiveDate = getAttendanceBranchNow(settings).businessDate;
  try {
    return {
      ok: true,
      summary: await buildBranchCorrectionImpactSummary({ admin, request, effectiveDate }),
    };
  } catch {
    return { ok: false, message: "The transfer impact summary could not be loaded safely." };
  }
}

function temporaryValidity(params: {
  decisionType: "temporary_branch_access_shift" | "temporary_branch_access_day";
  businessDate: string;
  timezone: string;
  dayBoundary: string;
  now: Date;
}): { validFrom: string; validUntil: string } {
  const validFrom = params.now.toISOString();
  if (params.decisionType === "temporary_branch_access_shift") {
    return {
      validFrom,
      validUntil: new Date(params.now.getTime() + 36 * 60 * 60_000).toISOString(),
    };
  }
  return {
    validFrom,
    validUntil: branchDateTimeToIsoInTimezone({
      date: params.businessDate,
      time: params.dayBoundary,
      timezone: params.timezone,
      addDay: true,
    }),
  };
}

async function callResolutionRpc(params: {
  admin: AdminClient;
  actor: BranchCorrectionActor & { staffId: string; authUserId: string };
  request: ResolutionRequestRow;
  decisionType: BranchCorrectionDecisionType;
  reason?: string | null;
  businessDate: string;
  validFrom?: string | null;
  validUntil?: string | null;
  impact: BranchCorrectionImpactSummary;
  scanCommit?: { kind: "attendance" | "provisional"; args: Record<string, unknown> } | null;
}): Promise<ResolutionRpcRow> {
  const { data, error } = await params.admin
    .rpc("resolve_staff_branch_correction_transaction", {
      p_request_id: params.request.id,
      p_decision_type: params.decisionType,
      p_actor_auth_user_id: params.actor.authUserId,
      p_actor_staff_id: params.actor.staffId,
      p_reason: params.reason?.trim() || undefined,
      p_attendance_business_date: params.businessDate,
      p_valid_from: params.validFrom ?? undefined,
      p_valid_until: params.validUntil ?? undefined,
      p_permanent_effective_date:
        params.decisionType === "permanent_branch_transfer"
          ? params.businessDate
          : undefined,
      p_impact_summary: params.impact as unknown as Json,
      p_scan_commit: params.scanCommit as unknown as Json,
    })
    .maybeSingle();

  if (error) {
    const resolutionCode = scanCommitFailureCode(error.message, error.details, error.hint);
    console.error("[staff/branch-correction] resolution transaction failed", {
      requestId: params.request.id,
      decisionType: params.decisionType,
      rpcName: "resolve_staff_branch_correction_transaction",
      stage: resolutionCode ? "attendance_commit" : "resolution_rpc",
      errorCode: error.code ?? null,
      errorMessage: error.message ?? null,
      errorDetails: error.details ?? null,
      errorHint: error.hint ?? null,
      resolutionCode,
    });
    throw new BranchResolutionTransactionError(resolutionCode);
  }
  if (!data) throw new BranchResolutionTransactionError("resolution_result_missing");
  return data as ResolutionRpcRow;
}

function mapReviewError(message: string): BranchCorrectionReviewResult {
  if (message.includes("branch_correction_request_not_pending")) {
    return {
      ok: false,
      code: "NOT_PENDING",
      message: "This request has already been reviewed.",
    };
  }

  if (message.includes("branch_correction_staff_branch_changed")) {
    return {
      ok: false,
      code: "STALE_REQUEST",
      message: "This staff member's branch changed after the request. Ask them to scan again.",
    };
  }

  if (message.includes("branch_correction_not_authorized")) {
    return {
      ok: false,
      code: "UNAUTHORIZED",
      message: "You can only review correction requests for your branch.",
    };
  }

  if (message.includes("branch_correction_requested_branch_inactive")) {
    return {
      ok: false,
      code: "INACTIVE_BRANCH",
      message: "The requested branch is not active. Please ask an owner or manager to check the branch setup.",
    };
  }

  return {
    ok: false,
    code: "REVIEW_FAILED",
    message: "We could not review this request. Please refresh and try again.",
  };
}

async function emitBranchCorrectionResolutionSignals(params: {
  request: ResolutionRequestRow;
  decisionType: BranchCorrectionDecisionType;
  actorStaffId: string;
  impact: BranchCorrectionImpactSummary;
}): Promise<void> {
  const temporary = params.decisionType.startsWith("temporary_");
  const rejected = params.decisionType === "rejected_wrong_branch";
  const permanent = params.decisionType === "permanent_branch_transfer";
  const entityType = "staff_branch_change_request";
  const commonMetadata = {
    decision_type: params.decisionType,
    effective_date: params.impact.effectiveDate,
  };
  const signals: Array<Promise<unknown>> = [
    createOrUpdateNotification({
      branchId: params.request.requested_branch_id,
      targetWorkspace: "staff",
      targetRole: "staff",
      recipientStaffId: params.request.staff_id,
      actorStaffId: params.actorStaffId,
      type: rejected ? "branch_correction_rejected" : "branch_correction_resolved",
      title: rejected
        ? "Wrong-branch scan reviewed"
        : temporary
          ? "Temporary branch access approved"
          : "Primary branch updated",
      body: rejected
        ? "The wrong-branch scan was rejected. Use your assigned branch QR or ask CRM for help."
        : temporary
          ? "Your pending Attendance scan was resumed with temporary access to the scanned branch."
          : "Your primary branch was updated and the pending Attendance scan was resumed.",
      entityType,
      entityId: params.request.id,
      actionHref: "/staff-portal/attendance",
      priority: rejected ? "normal" : "low",
      requiresAction: false,
      metadata: commonMetadata,
    }),
    createOrUpdateNotification({
      branchId: params.request.requested_branch_id,
      targetWorkspace: "crm",
      targetRole: "crm",
      actorStaffId: params.actorStaffId,
      type: "branch_correction_decided",
      title: rejected ? "Branch correction rejected" : "Branch correction resolved",
      body: rejected
        ? "A wrong-branch Attendance scan was rejected."
        : "The original Attendance scan was resumed after branch resolution.",
      entityType,
      entityId: params.request.id,
      actionHref: "/crm/staff?tab=branch-corrections",
      priority: "low",
      requiresAction: false,
      metadata: commonMetadata,
    }),
  ];

  if (permanent) {
    signals.push(
      createOrUpdateNotification({
        branchId: params.request.requested_branch_id,
        targetWorkspace: "manager",
        targetRole: "manager",
        actorStaffId: params.actorStaffId,
        type: "staff_branch_transfer_completed",
        title: "Staff branch transfer completed",
        body: "Historical records were preserved. Review future schedules, bookings, and service availability when flagged.",
        entityType,
        entityId: params.request.id,
        actionHref: "/manager/staff",
        priority: "normal",
        requiresAction: false,
        metadata: commonMetadata,
      })
    );
    if (params.impact.futureBookingsAtCurrentBranch > 0) {
      signals.push(
        createOrUpdateWorkflowTask({
          branchId: params.request.current_branch_id,
          workspaceScope: "manager",
          assignedToRole: "manager",
          taskType: "staff.branch_transfer.booking_review",
          title: "Review bookings after staff transfer",
          body: `${params.impact.futureBookingsAtCurrentBranch} future booking(s) remain at the previous branch and were not moved.`,
          entityType,
          entityId: params.request.id,
          actionHref: "/manager/bookings",
          priority: "high",
          metadata: commonMetadata,
        })
      );
    }
    if (
      params.impact.activeWeeklySchedules > 0 ||
      params.impact.futureScheduleOverrides > 0 ||
      params.impact.branchSpecificSchedulingPreference ||
      params.impact.branchDutyAssignments > 0
    ) {
      signals.push(
        createOrUpdateWorkflowTask({
          branchId: params.request.requested_branch_id,
          workspaceScope: "manager",
          assignedToRole: "manager",
          taskType: "staff.branch_transfer.schedule_review",
          title: "Review schedule after staff transfer",
          body: "The staff member has schedule or branch-duty configuration that was intentionally preserved.",
          entityType,
          entityId: params.request.id,
          actionHref: "/manager/schedule",
          priority: "high",
          metadata: commonMetadata,
        })
      );
    }
    if (params.impact.servicesUnavailableAtScannedBranch > 0) {
      signals.push(
        createOrUpdateWorkflowTask({
          branchId: params.request.requested_branch_id,
          workspaceScope: "manager",
          assignedToRole: "manager",
          taskType: "staff.branch_transfer.service_review",
          title: "Review service eligibility after staff transfer",
          body: `${params.impact.servicesUnavailableAtScannedBranch} assigned service(s) are not active at the new branch.`,
          entityType,
          entityId: params.request.id,
          actionHref: "/manager/staff",
          priority: "high",
          metadata: commonMetadata,
        })
      );
    }
  }

  try {
    await Promise.all(signals);
  } catch {
    console.error("[staff/branch-correction] resolution signals could not be refreshed", {
      requestId: params.request.id,
      decisionType: params.decisionType,
    });
  }
}

export async function resolveBranchCorrectionRequestForActor(params: {
  actor: BranchCorrectionActor & { staffId: string; authUserId: string };
  input: BranchCorrectionResolutionInput;
}): Promise<BranchCorrectionReviewResult> {
  const admin = createAdminClient();
  const request = await loadResolutionRequest(admin, params.input.requestId);
  if (!request) {
    return { ok: false, code: "INVALID_INPUT", message: "This branch correction request could not be found." };
  }
  if (!canReviewBranchCorrectionRequest(params.actor, { requestedBranchId: request.requested_branch_id })) {
    return { ok: false, code: "UNAUTHORIZED", message: "You can only resolve correction requests for your branch." };
  }
  if (request.status !== "pending") {
    if (
      request.decision_type === params.input.decisionType &&
      (request.resolution_status === "resolved" || request.resolution_status === "requires_review")
    ) {
      return {
        ok: true,
        requestId: request.id,
        status: normalizeStatus(request.status),
        resolutionStatus: request.resolution_status,
        decisionType: params.input.decisionType,
        attendanceResult: jsonRecord(request.attendance_result),
        message: "The existing branch resolution was replayed safely.",
      };
    }
    return { ok: false, code: "NOT_PENDING", message: "This request already has a final decision." };
  }

  const sourceScan = await loadSourceWrongBranchScan({
    admin,
    scanEventId: request.scan_event_id,
    staffId: request.staff_id,
    qrPointId: request.qr_point_id ?? "",
    around: request.created_at,
  });
  if (!sourceScan) {
    return mapBranchResolutionCode("source_scan_unavailable");
  }

  const settings = await getAttendanceSettings(request.requested_branch_id);
  const branchNow = getAttendanceBranchNow(settings);
  let impact: BranchCorrectionImpactSummary;
  try {
    impact = await buildBranchCorrectionImpactSummary({
      admin,
      request,
      effectiveDate: branchNow.businessDate,
    });
  } catch {
    return { ok: false, code: "REVIEW_FAILED", message: "The branch impact summary could not be verified. Refresh and try again." };
  }
  const now = new Date();
  const validity = params.input.decisionType === "permanent_branch_transfer"
    ? null
    : temporaryValidity({
        decisionType: params.input.decisionType,
        businessDate: branchNow.businessDate,
        timezone: branchNow.timezone,
        dayBoundary: branchNow.dayBoundary,
        now,
      });
  const resolutionState: { row: ResolutionRpcRow | null } = { row: null };
  let rejectedCode: string | null = null;

  async function commitResolution(
    attendanceAdmin: Parameters<NonNullable<Parameters<typeof resumeAttendanceScanFromStoredSource>[0]["commit"]>>[0],
    input: AttendanceScanCommitInput
  ): Promise<AttendanceScanCommitResult> {
    const args = buildAttendanceScanCommitRpcArgs(input);
    const row = await callResolutionRpc({
      admin: attendanceAdmin as unknown as AdminClient,
      actor: params.actor,
      request: request!,
      decisionType: params.input.decisionType,
      reason: params.input.reason,
      businessDate: branchNow.businessDate,
      validFrom: validity?.validFrom,
      validUntil: validity?.validUntil,
      impact,
      scanCommit: { kind: "attendance", args: args as unknown as Record<string, unknown> },
    });
    if (!row.success) {
      rejectedCode = row.code;
      throw new Error(`branch_resolution_rejected:${row.code}`);
    }
    resolutionState.row = row;
    const result = isPublicScanResult(row.operation_result)
      ? row.operation_result
      : input.result;
    return {
      result,
      scanEventId: row.scan_event_id ?? undefined,
      checkinId: row.checkin_id ?? undefined,
    };
  }

  async function reconcileResolution(
    attendanceAdmin: Parameters<NonNullable<Parameters<typeof resumeAttendanceScanFromStoredSource>[0]["reconcileProvisional"]>>[0],
    input: ProvisionalAttendanceReconcileInput
  ): Promise<PublicScanResult> {
    const row = await callResolutionRpc({
      admin: attendanceAdmin as unknown as AdminClient,
      actor: params.actor,
      request: request!,
      decisionType: params.input.decisionType,
      reason: params.input.reason,
      businessDate: branchNow.businessDate,
      validFrom: validity?.validFrom,
      validUntil: validity?.validUntil,
      impact,
      scanCommit: {
        kind: "provisional",
        args: input.args as unknown as Record<string, unknown>,
      },
    });
    if (!row.success) {
      rejectedCode = row.code;
      throw new Error(`branch_resolution_rejected:${row.code}`);
    }
    resolutionState.row = row;
    if (row.checkin_id) await resolveClosingInterventionSignals(attendanceAdmin, row.checkin_id);
    return isPublicScanResult(row.operation_result) ? row.operation_result : input.publicResult;
  }

  try {
    await resumeAttendanceScanFromStoredSource({
      sourceScanEventId: sourceScan.id,
      continuationRequestId: `branch-correction:${request.id}`,
      expectedStaffId: request.staff_id,
      expectedBranchId: request.requested_branch_id,
      commit: commitResolution,
      reconcileProvisional: reconcileResolution,
    });
  } catch (error) {
    if (error instanceof BranchResolutionTransactionError) {
      return mapBranchResolutionCode(error.resolutionCode);
    }
    if (isAttendanceScanError(error)) {
      logAttendanceScanError({
        scope: "staff/branch-correction",
        operationId: `branch-correction:${request.id}`,
        error,
        context: {
          requestId: request.id,
          decisionType: params.input.decisionType,
          stage: "resume_stored_source",
        },
      });
      const stage = typeof error.details?.stage === "string" ? error.details.stage : null;
      if (stage?.startsWith("resume_source_")) {
        return mapBranchResolutionCode("source_scan_unavailable");
      }
    } else {
      console.error("[staff/branch-correction] resolution continuation failed", {
        requestId: request.id,
        decisionType: params.input.decisionType,
        stage: "resume_stored_source",
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
    }
    return mapBranchResolutionCode(rejectedCode);
  }

  const resolvedRow = resolutionState.row;
  if (!resolvedRow || !resolvedRow.success) return mapBranchResolutionCode(rejectedCode);
  await emitBranchCorrectionResolutionSignals({
    request,
    decisionType: params.input.decisionType,
    actorStaffId: params.actor.staffId,
    impact,
  });
  return {
    ok: true,
    requestId: request.id,
    status: normalizeStatus(resolvedRow.request_status),
    resolutionStatus:
      resolvedRow.resolution_status === "requires_review" ? "requires_review" : "resolved",
    decisionType: params.input.decisionType,
    attendanceResult: jsonRecord(resolvedRow.operation_result),
    message: resolvedRow.message,
  };
}

export async function rejectBranchCorrectionScanForActor(params: {
  actor: BranchCorrectionActor & { staffId: string; authUserId: string };
  requestId: string;
  reason: string;
}): Promise<BranchCorrectionReviewResult> {
  const admin = createAdminClient();
  const request = await loadResolutionRequest(admin, params.requestId);
  if (!request) {
    return { ok: false, code: "INVALID_INPUT", message: "This branch correction request could not be found." };
  }
  if (!canReviewBranchCorrectionRequest(params.actor, { requestedBranchId: request.requested_branch_id })) {
    return { ok: false, code: "UNAUTHORIZED", message: "You can only reject correction requests for your branch." };
  }
  if (
    request.status !== "pending" &&
    request.decision_type === "rejected_wrong_branch" &&
    request.resolution_status === "resolved"
  ) {
    return {
      ok: true,
      requestId: request.id,
      status: "rejected",
      resolutionStatus: "resolved",
      decisionType: "rejected_wrong_branch",
      attendanceResult: jsonRecord(request.attendance_result),
      message: "The existing rejection was replayed safely.",
    };
  }
  if (request.status !== "pending") {
    return { ok: false, code: "NOT_PENDING", message: "This request already has a final decision." };
  }

  const settings = await getAttendanceSettings(request.requested_branch_id);
  const branchNow = getAttendanceBranchNow(settings);
  let impact: BranchCorrectionImpactSummary;
  try {
    impact = await buildBranchCorrectionImpactSummary({
      admin,
      request,
      effectiveDate: branchNow.businessDate,
    });
  } catch {
    return { ok: false, code: "REVIEW_FAILED", message: "The branch impact summary could not be verified. Refresh and try again." };
  }
  let row: ResolutionRpcRow;
  try {
    row = await callResolutionRpc({
      admin,
      actor: params.actor,
      request,
      decisionType: "rejected_wrong_branch",
      reason: params.reason,
      businessDate: branchNow.businessDate,
      impact,
      scanCommit: null,
    });
  } catch (error) {
    return mapBranchResolutionCode(
      error instanceof BranchResolutionTransactionError
        ? error.resolutionCode
        : null
    );
  }
  if (!row.success) return mapBranchResolutionCode(row.code);
  await emitBranchCorrectionResolutionSignals({
    request,
    decisionType: "rejected_wrong_branch",
    actorStaffId: params.actor.staffId,
    impact,
  });
  return {
    ok: true,
    requestId: request.id,
    status: "rejected",
    resolutionStatus: "resolved",
    decisionType: "rejected_wrong_branch",
    attendanceResult: jsonRecord(row.operation_result),
    message: row.message,
  };
}

export async function reviewBranchCorrectionRequestForActor(params: {
  actor: BranchCorrectionActor & { staffId: string; authUserId: string };
  requestId: string;
  status: BranchCorrectionReviewStatus;
  reviewerNote?: string | null;
}): Promise<BranchCorrectionReviewResult> {
  const admin = createAdminClient();
  const { data: request, error: requestError } = await admin
    .from("staff_branch_change_requests")
    .select("id, requested_branch_id, status")
    .eq("id", params.requestId)
    .maybeSingle();

  if (requestError || !request) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: "This branch correction request could not be found.",
    };
  }

  if (!canReviewBranchCorrectionRequest(params.actor, { requestedBranchId: request.requested_branch_id })) {
    return {
      ok: false,
      code: "UNAUTHORIZED",
      message: "You can only review correction requests for your branch.",
    };
  }

  if (request.status !== "pending") {
    return {
      ok: false,
      code: "NOT_PENDING",
      message: "This request has already been reviewed.",
    };
  }

  const { data, error } = await admin.rpc("review_staff_branch_change_request", {
    p_request_id: params.requestId,
    p_review_status: params.status,
    p_reviewer_auth_user_id: params.actor.authUserId,
    p_reviewer_staff_id: params.actor.staffId,
    p_reviewer_note: params.reviewerNote?.trim() || undefined,
  });

  if (error) return mapReviewError(error.message);

  const reviewed = data?.[0];
  return {
    ok: true,
    requestId: reviewed?.request_id ?? params.requestId,
    status: params.status,
    message:
      params.status === "approved"
        ? "Branch correction approved. The staff profile is now assigned to the requested branch."
        : "Branch correction rejected.",
    };
}

export async function cancelBranchCorrectionRequestForActor(params: {
  actor: BranchCorrectionActor & { staffId: string };
  requestId: string;
}): Promise<BranchCorrectionReviewResult> {
  const admin = createAdminClient();
  const { data: request, error } = await admin
    .from("staff_branch_change_requests")
    .select("id, staff_id, requested_branch_id, status")
    .eq("id", params.requestId)
    .maybeSingle();

  if (error || !request) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: "This branch correction request could not be found.",
    };
  }

  const ownsRequest = request.staff_id === params.actor.staffId;
  const canCancel =
    ownsRequest ||
    canReviewBranchCorrectionRequest(params.actor, { requestedBranchId: request.requested_branch_id });

  if (!canCancel) {
    return {
      ok: false,
      code: "UNAUTHORIZED",
      message: "You can only cancel your own request or requests you can review.",
    };
  }

  if (request.status !== "pending") {
    return {
      ok: false,
      code: "NOT_PENDING",
      message: "This request has already been reviewed.",
    };
  }

  const updated = await admin
    .from("staff_branch_change_requests")
    .update({
      status: "cancelled",
      reviewed_by_staff_id: ownsRequest ? null : params.actor.staffId,
      reviewed_at: new Date().toISOString(),
      reviewer_note: ownsRequest ? "Cancelled by staff." : "Cancelled by reviewer.",
    })
    .eq("id", params.requestId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (updated.error || !updated.data) {
    return {
      ok: false,
      code: "REVIEW_FAILED",
      message: "We could not cancel this request. Please refresh and try again.",
    };
  }

  return {
    ok: true,
    requestId: params.requestId,
    status: "cancelled",
    message: "Branch correction request cancelled.",
  };
}

export async function cancelOwnBranchCorrectionRequestForScan(params: {
  authUserId?: string | null;
  rawDeviceCredential?: string | null;
  requestId: string;
}): Promise<BranchCorrectionReviewResult> {
  const admin = createAdminClient();
  const { data: request, error } = await admin
    .from("staff_branch_change_requests")
    .select("id, staff_id, status")
    .eq("id", params.requestId)
    .maybeSingle();

  if (error || !request) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: "This branch correction request could not be found.",
    };
  }

  if (request.status !== "pending") {
    return {
      ok: false,
      code: "NOT_PENDING",
      message: "This request has already been reviewed.",
    };
  }

  const authStaff = params.authUserId
    ? await loadStaffForRequest(admin, params.authUserId, request.staff_id)
    : null;
  const deviceStaff = params.rawDeviceCredential
    ? await loadStaffForDeviceCredential(admin, params.rawDeviceCredential, request.staff_id)
    : null;
  const staff = authStaff ?? deviceStaff?.staff ?? null;

  if (!staff) {
    return {
      ok: false,
      code: "UNAUTHENTICATED",
      message: "Scan again on this phone or sign in with your staff account to cancel this request.",
    };
  }

  return cancelBranchCorrectionRequestForActor({
    actor: {
      systemRole: "staff",
      branchId: staff.branch_id,
      staffId: staff.id,
    },
    requestId: params.requestId,
  });
}
