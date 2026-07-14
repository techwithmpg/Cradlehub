import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { asAttendanceDb } from "@/lib/attendance/db";
import { inferDeviceClientHints } from "@/lib/attendance/device-display";
import { ACTIVE_ATTENDANCE_DEVICE_LIMIT } from "@/lib/attendance/device-policy";
import { createRecoveryToken, hashRecoveryToken, hashSecret } from "@/lib/attendance/tokens";
import { isOperationalStaff } from "@/lib/staff/operational-staff";
import { createNotification, createStaffNotification, resolveNotificationsForEntity } from "@/lib/notifications/create";
import { createOrUpdateWorkflowTask, resolveWorkflowTask } from "@/lib/notifications/workflow-task-store";
import type { AttendanceActionContext } from "@/lib/attendance/queries";
import type { Json } from "@/types/supabase";

export type StaffDeviceRegistrationRequestType = "new_phone" | "replacement";
export type StaffDeviceRegistrationRequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "completed"
  | "cancelled"
  | "expired";
export type StaffDeviceRegistrationRejectionReason =
  | "unable_to_verify_request"
  | "device_limit_reached"
  | "shared_phone_not_permitted"
  | "staff_account_inactive"
  | "security_concern"
  | "other";

export type StaffDeviceRegistrationRequest = {
  id: string;
  staffId: string;
  staffName: string;
  branchId: string;
  requestType: StaffDeviceRegistrationRequestType;
  status: StaffDeviceRegistrationRequestStatus;
  deviceLabel: string;
  browserName: string | null;
  platformName: string | null;
  existingDeviceId: string | null;
  replacementDeviceId: string | null;
  completedDeviceId: string | null;
  requestedAt: string;
  reviewedAt: string | null;
  reviewerNote: string | null;
  rejectionReason: StaffDeviceRegistrationRejectionReason | null;
  expiresAt: string | null;
};

export type StaffAttendancePhoneState = {
  staffId: string;
  registeredDevice: { id: string; label: string; lastSeenAt: string | null } | null;
  activeDevices: Array<{ id: string; label: string; isCurrent: boolean }>;
  request: StaffDeviceRegistrationRequest | null;
};

type StaffRow = {
  id: string;
  branch_id: string;
  full_name: string;
  is_active: boolean;
  archived_at: string | null;
  merged_into_staff_id: string | null;
  metadata: Record<string, unknown> | null;
};

type RequestRow = {
  id: string;
  staff_id: string;
  branch_id: string;
  request_type: string;
  status: string;
  device_label: string | null;
  browser_name: string | null;
  platform_name: string | null;
  existing_device_id: string | null;
  replacement_device_id: string | null;
  completed_device_id: string | null;
  requested_at: string;
  reviewed_at: string | null;
  reviewer_note: string | null;
  rejection_reason: string | null;
  expires_at: string | null;
  staff?: { full_name: string | null } | Array<{ full_name: string | null }> | null;
};

const ENTITY_TYPE = "staff_device_registration_request";
const TASK_TYPE = "review_staff_device_registration";

function first<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function mapRequest(row: RequestRow, fallbackName = "Staff member"): StaffDeviceRegistrationRequest {
  return {
    id: row.id,
    staffId: row.staff_id,
    staffName: first(row.staff)?.full_name ?? fallbackName,
    branchId: row.branch_id,
    requestType: row.request_type as StaffDeviceRegistrationRequestType,
    status: row.status as StaffDeviceRegistrationRequestStatus,
    deviceLabel: row.device_label?.trim() || "Attendance phone",
    browserName: row.browser_name,
    platformName: row.platform_name,
    existingDeviceId: row.existing_device_id,
    replacementDeviceId: row.replacement_device_id,
    completedDeviceId: row.completed_device_id,
    requestedAt: row.requested_at,
    reviewedAt: row.reviewed_at,
    reviewerNote: row.reviewer_note,
    rejectionReason: row.rejection_reason as StaffDeviceRegistrationRejectionReason | null,
    expiresAt: row.expires_at,
  };
}

async function getAuthenticatedStaff(): Promise<{ staff: StaffRow; authUserId: string } | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from("staff")
    .select("id, branch_id, full_name, is_active, archived_at, merged_into_staff_id, metadata")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (error || !data) return null;
  const staff = data as unknown as StaffRow;
  return isOperationalStaff(staff) ? { staff, authUserId: user.id } : null;
}

function requestHref(requestId: string): string {
  return `/crm/attendance?tab=devices&requestId=${encodeURIComponent(requestId)}`;
}

async function signalRequestCreated(request: StaffDeviceRegistrationRequest): Promise<void> {
  const dedupeKey = `attendance-device-request:${request.id}`;
  await Promise.all([
    createNotification({
      branchId: request.branchId,
      targetWorkspace: "crm",
      type: "attendance_device_registration_requested",
      title: "Attendance phone approval needed",
      body: `${request.staffName} requested ${request.requestType === "replacement" ? "a replacement phone" : "a new phone"}.`,
      entityType: ENTITY_TYPE,
      entityId: request.id,
      actionHref: requestHref(request.id),
      priority: "high",
      requiresAction: true,
      dedupeKey,
    }),
    createOrUpdateWorkflowTask({
      branchId: request.branchId,
      workspaceScope: "crm",
      taskType: TASK_TYPE,
      title: "Review attendance phone request",
      body: `${request.staffName} is waiting for phone approval.`,
      entityType: ENTITY_TYPE,
      entityId: request.id,
      actionHref: requestHref(request.id),
      priority: "high",
      dedupeKey,
    }),
  ]);
}

async function resolveCrmSignals(request: StaffDeviceRegistrationRequest, actorStaffId?: string | null): Promise<void> {
  const dedupeKey = `attendance-device-request:${request.id}`;
  await Promise.all([
    resolveNotificationsForEntity(ENTITY_TYPE, request.id, "crm", "attendance_device_registration_requested"),
    resolveWorkflowTask({
      branchId: request.branchId,
      workspaceScope: "crm",
      taskType: TASK_TYPE,
      entityType: ENTITY_TYPE,
      entityId: request.id,
      completedByStaffId: actorStaffId ?? null,
      dedupeKey,
    }),
  ]);
}

export async function getOwnAttendancePhoneState(rawCredential: string | null): Promise<StaffAttendancePhoneState | null> {
  const auth = await getAuthenticatedStaff();
  if (!auth) return null;
  const supabase = await createClient();
  const fingerprint = rawCredential ? hashSecret(rawCredential) : null;
  const requestQuery = supabase
    .from("staff_device_registration_requests")
    .select("id, staff_id, branch_id, request_type, status, device_label, browser_name, platform_name, existing_device_id, replacement_device_id, completed_device_id, requested_at, reviewed_at, reviewer_note, rejection_reason, expires_at")
    .eq("staff_id", auth.staff.id)
    .order("requested_at", { ascending: false })
    .limit(1);
  if (fingerprint) requestQuery.eq("device_fingerprint_hash", fingerprint);
  const [devicesResult, requestsResult] = await Promise.all([
    supabase
      .from("staff_devices")
      .select("id, device_label, last_seen_at, device_fingerprint_hash")
      .eq("staff_id", auth.staff.id)
      .eq("status", "active")
      .order("created_at", { ascending: false }),
    fingerprint ? requestQuery : Promise.resolve({ data: [], error: null }),
  ]);
  if (devicesResult.error) throw new Error(devicesResult.error.message);
  if (requestsResult.error) throw new Error(requestsResult.error.message);
  const devices = (devicesResult.data ?? []).map((device) => ({
    id: device.id,
    label: device.device_label?.trim() || "Attendance phone",
    lastSeenAt: device.last_seen_at,
    isCurrent: Boolean(fingerprint && device.device_fingerprint_hash === fingerprint),
  }));
  const current = devices.find((device) => device.isCurrent) ?? null;
  let requestRow = (requestsResult.data?.[0] as RequestRow | undefined) ?? null;
  if (requestRow?.status === "approved" && requestRow.expires_at && new Date(requestRow.expires_at).getTime() <= Date.now()) {
    const admin = asAttendanceDb(createAdminClient());
    await admin.from("staff_device_registration_requests").update({ status: "expired" })
      .eq("id", requestRow.id).eq("status", "approved");
    requestRow = { ...requestRow, status: "expired" };
  }
  return {
    staffId: auth.staff.id,
    registeredDevice: current ? { id: current.id, label: current.label, lastSeenAt: current.lastSeenAt } : null,
    activeDevices: devices.map(({ id, label, isCurrent }) => ({ id, label, isCurrent })),
    request: requestRow ? mapRequest(requestRow, auth.staff.full_name) : null,
  };
}

export async function requestAttendancePhoneRegistration(params: {
  rawCredential: string;
  userAgent?: string | null;
  requestType: StaffDeviceRegistrationRequestType;
  existingDeviceId?: string | null;
}): Promise<StaffDeviceRegistrationRequest> {
  const auth = await getAuthenticatedStaff();
  if (!auth) throw new Error("Your staff account is not active.");
  const admin = asAttendanceDb(createAdminClient());
  const fingerprint = hashSecret(params.rawCredential);
  const conflicting = await admin
    .from("staff_devices")
    .select("id, staff_id, status")
    .eq("device_fingerprint_hash", fingerprint)
    .maybeSingle();
  if (conflicting.error) throw new Error(conflicting.error.message);
  if (conflicting.data?.status === "active") {
    throw new Error(
      conflicting.data.staff_id === auth.staff.id
        ? "This phone is already registered for Attendance."
        : "This phone is already linked to another staff account. Contact CRM or management."
    );
  }

  if (params.requestType === "replacement") {
    if (!params.existingDeviceId) throw new Error("Choose the phone you want to replace.");
    const existing = await admin
      .from("staff_devices")
      .select("id")
      .eq("id", params.existingDeviceId)
      .eq("staff_id", auth.staff.id)
      .eq("status", "active")
      .maybeSingle();
    if (existing.error) throw new Error(existing.error.message);
    if (!existing.data) throw new Error("The phone selected for replacement is no longer active.");
  }

  const open = await admin
    .from("staff_device_registration_requests")
    .select("id, staff_id, branch_id, request_type, status, device_label, browser_name, platform_name, existing_device_id, replacement_device_id, completed_device_id, requested_at, reviewed_at, reviewer_note, rejection_reason, expires_at")
    .eq("staff_id", auth.staff.id)
    .eq("device_fingerprint_hash", fingerprint)
    .in("status", ["pending", "approved"])
    .maybeSingle();
  if (open.error) throw new Error(open.error.message);
  if (open.data) return mapRequest(open.data as RequestRow, auth.staff.full_name);

  const hints = inferDeviceClientHints(params.userAgent);
  const inserted = await admin
    .from("staff_device_registration_requests")
    .insert({
      staff_id: auth.staff.id,
      branch_id: auth.staff.branch_id,
      request_type: params.requestType,
      device_fingerprint_hash: fingerprint,
      device_label: hints.label,
      browser_name: hints.browserName,
      platform_name: hints.platformName,
      existing_device_id: params.existingDeviceId ?? null,
      metadata: { source: "staff_portal", user_agent: params.userAgent ?? null } as Json,
    })
    .select("id, staff_id, branch_id, request_type, status, device_label, browser_name, platform_name, existing_device_id, replacement_device_id, completed_device_id, requested_at, reviewed_at, reviewer_note, rejection_reason, expires_at")
    .single();
  if (inserted.error || !inserted.data) throw new Error(inserted.error?.message ?? "Request could not be created.");
  const request = mapRequest(inserted.data as RequestRow, auth.staff.full_name);
  await signalRequestCreated(request);
  return request;
}

export async function cancelOwnAttendancePhoneRequest(requestId: string): Promise<void> {
  const auth = await getAuthenticatedStaff();
  if (!auth) throw new Error("Your staff account is not active.");
  const admin = asAttendanceDb(createAdminClient());
  const now = new Date().toISOString();
  const updated = await admin
    .from("staff_device_registration_requests")
    .update({ status: "cancelled", cancelled_at: now })
    .eq("id", requestId)
    .eq("staff_id", auth.staff.id)
    .eq("status", "pending")
    .select("id, staff_id, branch_id, request_type, status, device_label, browser_name, platform_name, existing_device_id, replacement_device_id, completed_device_id, requested_at, reviewed_at, reviewer_note, rejection_reason, expires_at")
    .maybeSingle();
  if (updated.error) throw new Error(updated.error.message);
  if (!updated.data) throw new Error("Only a pending request can be cancelled.");
  await resolveCrmSignals(mapRequest(updated.data as RequestRow, auth.staff.full_name));
}

export async function completeOwnAttendancePhoneRequest(params: {
  requestId: string;
  rawCredential: string;
  userAgent?: string | null;
}): Promise<{ deviceId: string }> {
  const auth = await getAuthenticatedStaff();
  if (!auth) throw new Error("Your staff account is not active.");
  const hints = inferDeviceClientHints(params.userAgent);
  const admin = asAttendanceDb(createAdminClient());
  const result = await admin.rpc("complete_staff_device_registration_request", {
    p_request_id: params.requestId,
    p_staff_id: auth.staff.id,
    p_device_fingerprint_hash: hashSecret(params.rawCredential),
    p_device_label: hints.label,
    p_user_agent: params.userAgent ?? undefined,
    p_browser_name: hints.browserName ?? undefined,
    p_browser_version: hints.browserVersion ?? undefined,
    p_platform_name: hints.platformName ?? undefined,
    p_active_device_limit: ACTIVE_ATTENDANCE_DEVICE_LIMIT,
  });
  if (result.error) throw new Error(result.error.message);
  const row = result.data?.[0];
  if (!row?.success || !row.device_id) {
    throw new Error(row?.code === "approval_expired" ? "This approval expired. Submit a new request." : "This approval cannot be activated on this phone.");
  }
  const request = await getRegistrationRequestById(params.requestId);
  if (request) {
    await Promise.all([
      resolveCrmSignals(request),
      createStaffNotification({
        branchId: request.branchId,
        recipientStaffId: request.staffId,
        type: "attendance_device_registration_completed",
        title: "Attendance phone connected",
        body: `${request.deviceLabel} is ready for attendance scans.`,
        entityType: ENTITY_TYPE,
        entityId: request.id,
        actionHref: "/staff-portal/profile",
      }),
    ]);
  }
  return { deviceId: row.device_id };
}

export async function renameOwnAttendanceDevice(deviceId: string, label: string): Promise<void> {
  const auth = await getAuthenticatedStaff();
  if (!auth) throw new Error("Your staff account is not active.");
  const trimmed = label.trim();
  if (trimmed.length < 2 || trimmed.length > 60) throw new Error("Use a phone name between 2 and 60 characters.");
  const admin = asAttendanceDb(createAdminClient());
  const updated = await admin.from("staff_devices").update({ device_label: trimmed })
    .eq("id", deviceId).eq("staff_id", auth.staff.id).eq("status", "active").select("id").maybeSingle();
  if (updated.error) throw new Error(updated.error.message);
  if (!updated.data) throw new Error("This phone is no longer active.");
}

export async function listStaffDeviceRegistrationRequests(branchId: string): Promise<StaffDeviceRegistrationRequest[]> {
  const admin = asAttendanceDb(createAdminClient());
  const result = await admin
    .from("staff_device_registration_requests")
    .select("id, staff_id, branch_id, request_type, status, device_label, browser_name, platform_name, existing_device_id, replacement_device_id, completed_device_id, requested_at, reviewed_at, reviewer_note, rejection_reason, expires_at, staff:staff!staff_device_registration_requests_staff_id_fkey(full_name)")
    .eq("branch_id", branchId)
    .order("requested_at", { ascending: false })
    .limit(100);
  if (result.error) throw new Error(result.error.message);
  return (result.data ?? []).map((row) => mapRequest(row as unknown as RequestRow));
}

async function getRegistrationRequestById(requestId: string): Promise<StaffDeviceRegistrationRequest | null> {
  const admin = asAttendanceDb(createAdminClient());
  const result = await admin
    .from("staff_device_registration_requests")
    .select("id, staff_id, branch_id, request_type, status, device_label, browser_name, platform_name, existing_device_id, replacement_device_id, completed_device_id, requested_at, reviewed_at, reviewer_note, rejection_reason, expires_at, staff:staff!staff_device_registration_requests_staff_id_fkey(full_name)")
    .eq("id", requestId)
    .maybeSingle();
  if (result.error) throw new Error(result.error.message);
  return result.data ? mapRequest(result.data as unknown as RequestRow) : null;
}

export async function reviewStaffDeviceRegistrationRequest(params: {
  ctx: AttendanceActionContext;
  requestId: string;
  decision: "approved" | "rejected";
  reviewerNote?: string | null;
  rejectionReason?: StaffDeviceRegistrationRejectionReason | null;
  replacementDeviceId?: string | null;
}): Promise<StaffDeviceRegistrationRequest> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Please sign in again.");
  if (!params.ctx.actorStaffId) throw new Error("Your CRM staff profile is not available.");
  const tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const admin = asAttendanceDb(createAdminClient());
  const rpc = await admin.rpc("review_staff_device_registration_request", {
    p_request_id: params.requestId,
    p_review_status: params.decision,
    p_reviewer_auth_user_id: user.id,
    p_reviewer_staff_id: params.ctx.actorStaffId,
    p_reviewer_note: params.reviewerNote?.trim() || undefined,
    p_rejection_reason: params.rejectionReason ?? undefined,
    p_replacement_device_id: params.replacementDeviceId ?? undefined,
    p_token_hash: params.decision === "approved" ? hashRecoveryToken(createRecoveryToken()) : undefined,
    p_token_expires_at: params.decision === "approved" ? tokenExpiresAt : undefined,
    p_active_device_limit: ACTIVE_ATTENDANCE_DEVICE_LIMIT,
  });
  if (rpc.error) throw new Error(rpc.error.message);
  const request = await getRegistrationRequestById(params.requestId);
  if (!request) throw new Error("The registration request could not be reloaded.");
  await Promise.all([
    resolveCrmSignals(request, params.ctx.actorStaffId),
    createStaffNotification({
      branchId: request.branchId,
      recipientStaffId: request.staffId,
      actorStaffId: params.ctx.actorStaffId,
      type: params.decision === "approved"
        ? "attendance_device_registration_approved"
        : "attendance_device_registration_rejected",
      title: params.decision === "approved" ? "Attendance phone approved" : "Attendance phone request declined",
      body: params.decision === "approved"
        ? "Open Profile on the same phone within 24 hours to finish connecting it."
        : `CRM declined this request${request.reviewerNote ? `: ${request.reviewerNote}` : "."}`,
      entityType: ENTITY_TYPE,
      entityId: request.id,
      actionHref: "/staff-portal/profile",
      priority: params.decision === "approved" ? "normal" : "high",
    }),
  ]);
  return request;
}

export async function reconcileFirstScanDeviceRegistration(params: {
  staffId: string;
  deviceId: string;
  rawCredential: string;
}): Promise<void> {
  const admin = asAttendanceDb(createAdminClient());
  const fingerprint = hashSecret(params.rawCredential);
  const result = await admin
    .from("staff_device_registration_requests")
    .select("id, staff_id, branch_id, request_type, status, device_label, browser_name, platform_name, existing_device_id, replacement_device_id, completed_device_id, requested_at, reviewed_at, reviewer_note, rejection_reason, expires_at, activation_token_id")
    .eq("staff_id", params.staffId)
    .eq("device_fingerprint_hash", fingerprint)
    .in("status", ["pending", "approved"])
    .maybeSingle();
  if (result.error || !result.data) return;
  const now = new Date().toISOString();
  const replacementDeviceId = result.data.replacement_device_id ?? result.data.existing_device_id;
  if (result.data.request_type === "replacement" && replacementDeviceId && replacementDeviceId !== params.deviceId) {
    const replacement = await admin.from("staff_devices").select("id, device_role")
      .eq("id", replacementDeviceId).eq("staff_id", params.staffId).eq("status", "active").maybeSingle();
    if (replacement.data) {
      await admin.from("staff_devices").update({
        status: "revoked",
        revoked_at: now,
        revocation_reason: "replacement_phone",
        superseded_by_device_id: params.deviceId,
      }).eq("id", replacement.data.id);
      await admin.from("staff_devices").update({
        device_role: replacement.data.device_role,
        replacement_confirmed_at: now,
      }).eq("id", params.deviceId).eq("staff_id", params.staffId);
    }
  }
  if (result.data.activation_token_id) {
    await admin.from("device_activation_tokens").update({ used_at: now, updated_at: now })
      .eq("id", result.data.activation_token_id).is("used_at", null);
  }
  await admin.from("staff_device_registration_requests").update({
    status: "completed",
    registration_method: "first_scan_auto",
    completed_device_id: params.deviceId,
    completed_at: now,
  }).eq("id", result.data.id).in("status", ["pending", "approved"]);
  const request = mapRequest({ ...result.data, status: "completed", completed_device_id: params.deviceId } as RequestRow);
  await resolveCrmSignals(request);
}
