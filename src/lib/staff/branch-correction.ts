import "server-only";

import { hashSecret } from "@/lib/attendance/tokens";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, Json } from "@/types/supabase";
import {
  canRequestBranchCorrection,
  canReviewBranchCorrectionRequest,
  canSeeAllBranchCorrectionRequests,
  type BranchCorrectionActor,
} from "./branch-correction-policy";
import type {
  BranchCorrectionInboxItem,
  BranchCorrectionRequestResult,
  BranchCorrectionReviewResult,
  BranchCorrectionReviewStatus,
  BranchCorrectionScanDetails,
  BranchCorrectionStatus,
} from "./branch-correction-types";

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
  current_branch?: BranchRelation;
  requested_branch?: BranchRelation;
  qr_points?: QrPointRelation;
};

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
    scan_event_id: params.details.scanEventId ?? null,
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
      scan_event_id: params.details.scanEventId ?? null,
      requested_by_auth_user_id: params.authUserId ?? null,
      requested_by_staff_id: staff.id,
      request_source: "qr_wrong_branch",
      reason: params.reason?.trim() || null,
      status: "pending",
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
    message: "Request submitted. Please wait for front desk approval, then scan again.",
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
      current_branch:branches!staff_branch_change_requests_current_branch_id_fkey(id, name),
      requested_branch:branches!staff_branch_change_requests_requested_branch_id_fkey(id, name),
      qr_points:qr_points!staff_branch_change_requests_qr_point_id_fkey(id, label)
    `)
    .eq("status", "pending")
    .order("created_at", { ascending: true })
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
    };
  });
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
    p_reviewer_note: params.reviewerNote?.trim() || null,
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
