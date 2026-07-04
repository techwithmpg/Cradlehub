import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { asAttendanceDb } from "@/lib/attendance/db";
import { inferDeviceClientHints } from "@/lib/attendance/device-display";
import { buildActivationUrl } from "@/lib/attendance/qr-url";
import {
  createDeviceCredential,
  createRecoveryToken,
  hashRecoveryToken,
  hashSecret,
} from "@/lib/attendance/tokens";
import type { AttendanceActionContext } from "@/lib/attendance/queries";
import type {
  DeviceRecoveryReason,
  DeviceRevocationReason,
  RecoveryLinkResult,
  RecoveryTokenPreview,
} from "@/lib/attendance/types";

export type DeviceActionResult<T> =
  | {
      success: true;
      data: T;
    }
  | {
      success: false;
      error: string;
      code?: string;
      fieldErrors?: Record<string, string[]>;
    };

export type GenerateDeviceRecoveryInput = {
  staffId: string;
  branchId: string;
  reason: DeviceRecoveryReason;
  expiresInMinutes: 15 | 30 | 60;
  revokePreviousDeviceId?: string | null;
};

export type ConsumeDeviceRecoveryResult =
  | {
      success: true;
      rawDeviceCredential: string;
      deviceId: string;
      staffId: string;
      staffName: string;
      staffType: string;
      branchId: string;
      branchName: string;
      expiresAt: string;
    }
  | {
      success: false;
      code: string;
      title: string;
      message: string;
    };

const RECOVERY_REASONS: readonly DeviceRecoveryReason[] = [
  "browser_data_cleared",
  "replacement_phone",
  "lost_phone",
  "device_cookie_expired",
  "support_recovery",
  "security_concern",
  "other",
];

const REVOCATION_REASONS: readonly DeviceRevocationReason[] = [
  "lost_phone",
  "replacement_phone",
  "shared_device",
  "security_concern",
  "staff_request",
  "browser_reset",
  "other",
];

const ALLOWED_TTLS = [15, 30, 60] as const;
const ACTIVE_DEVICE_LIMIT = 2;

type Relation<T> = T | T[] | null | undefined;

type StaffRow = {
  id: string;
  branch_id: string;
  full_name: string;
  staff_type: string | null;
  is_active: boolean;
};

type BranchRow = {
  id: string;
  name: string | null;
  is_active: boolean;
};

type RecoveryTokenRow = {
  id: string;
  purpose: string;
  staff_id: string;
  branch_id: string;
  reason: string | null;
  expires_at: string;
  used_at: string | null;
  revoked_at: string | null;
  staff?: Relation<{ full_name: string | null; staff_type: string | null; is_active: boolean }>;
  branches?: Relation<{ name: string | null; is_active: boolean }>;
};

type ConsumeRpcRow = {
  success: boolean;
  code: string;
  message: string;
  device_id: string | null;
  staff_id: string | null;
  staff_name: string | null;
  staff_type: string | null;
  branch_id: string | null;
  branch_name: string | null;
  expires_at: string | null;
};

type RecoveryTokenFailureCode = Extract<RecoveryTokenPreview, { ok: false }>["code"];

function first<T>(value: Relation<T>): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function isRecoveryReason(value: string): value is DeviceRecoveryReason {
  return RECOVERY_REASONS.includes(value as DeviceRecoveryReason);
}

function isRevocationReason(value: string): value is DeviceRevocationReason {
  return REVOCATION_REASONS.includes(value as DeviceRevocationReason);
}

function isAllowedTtl(value: number): value is 15 | 30 | 60 {
  return ALLOWED_TTLS.includes(value as 15 | 30 | 60);
}

function trimInput(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

function previewFailure(code: RecoveryTokenFailureCode): RecoveryTokenPreview {
  switch (code) {
    case "token_expired":
      return { ok: false, code, title: "Link expired", message: "Ask the front desk to generate a new recovery link." };
    case "token_used":
      return { ok: false, code, title: "Link already used", message: "This recovery link has already restored a phone." };
    case "token_revoked":
      return { ok: false, code, title: "Link revoked", message: "This recovery link was revoked by the front desk." };
    case "staff_inactive":
      return { ok: false, code, title: "Staff inactive", message: "This staff account is no longer active." };
    case "branch_unavailable":
      return { ok: false, code, title: "Branch unavailable", message: "This recovery link is not available for the branch." };
    default:
      return { ok: false, code: "invalid_token", title: "Link invalid", message: "This recovery link could not be verified." };
  }
}

function consumeFailure(code: string, message?: string | null): ConsumeDeviceRecoveryResult {
  switch (code) {
    case "token_expired":
      return { success: false, code, title: "Link expired", message: "Ask the front desk to generate a new recovery link." };
    case "token_used":
      return { success: false, code, title: "Link already used", message: "This recovery link has already restored a phone." };
    case "token_revoked":
      return { success: false, code, title: "Link revoked", message: "This recovery link was revoked by the front desk." };
    case "staff_inactive":
      return { success: false, code, title: "Staff inactive", message: "This staff account is no longer active." };
    case "device_limit_reached":
      return { success: false, code, title: "Device limit reached", message: "Ask the front desk to revoke an old device first." };
    case "branch_unavailable":
      return { success: false, code, title: "Branch unavailable", message: "This recovery link is not available for the branch." };
    case "previous_device_invalid":
      return { success: false, code, title: "Previous device unavailable", message: "Ask the front desk to generate a replacement link." };
    default:
      return { success: false, code: "invalid_token", title: "Link invalid", message: message ?? "This recovery link could not be verified." };
  }
}

async function loadStaffAndBranch(input: {
  staffId: string;
  branchId: string;
}): Promise<{ staff: StaffRow; branch: BranchRow }> {
  const admin = asAttendanceDb(createAdminClient());
  const [staffResult, branchResult] = await Promise.all([
    admin
      .from("staff")
      .select("id, branch_id, full_name, staff_type, is_active")
      .eq("id", input.staffId)
      .maybeSingle(),
    admin
      .from("branches")
      .select("id, name, is_active")
      .eq("id", input.branchId)
      .maybeSingle(),
  ]);

  if (staffResult.error) throw new Error(staffResult.error.message);
  if (branchResult.error) throw new Error(branchResult.error.message);
  if (!staffResult.data || !branchResult.data) {
    throw new Error("Staff member or branch was not found.");
  }

  return {
    staff: staffResult.data as StaffRow,
    branch: branchResult.data as BranchRow,
  };
}

export async function generateDeviceRecoveryLink(params: {
  ctx: AttendanceActionContext;
  input: GenerateDeviceRecoveryInput;
  origin?: string | null;
}): Promise<RecoveryLinkResult> {
  const staffId = trimInput(params.input.staffId);
  const branchId = trimInput(params.input.branchId);
  if (!staffId) throw new Error("Choose a staff member.");
  if (!branchId || branchId !== params.ctx.branchId) throw new Error("Branch is not available.");
  if (!isRecoveryReason(params.input.reason)) throw new Error("Choose a valid recovery reason.");
  if (!isAllowedTtl(params.input.expiresInMinutes)) throw new Error("Choose a valid expiration.");

  const admin = asAttendanceDb(createAdminClient());
  const { staff, branch } = await loadStaffAndBranch({ staffId, branchId });
  if (!staff.is_active || staff.branch_id !== branchId) throw new Error("Staff member is not active in this branch.");
  if (!branch.is_active) throw new Error("Branch is not active.");

  const previousDeviceId = trimInput(params.input.revokePreviousDeviceId ?? null) || null;
  if (previousDeviceId) {
    const { data, error } = await admin
      .from("staff_devices")
      .select("id")
      .eq("id", previousDeviceId)
      .eq("staff_id", staffId)
      .eq("branch_id", branchId)
      .eq("status", "active")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Previous device is no longer active for this staff member.");
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + params.input.expiresInMinutes * 60 * 1000).toISOString();
  const rawToken = createRecoveryToken();

  await admin
    .from("device_activation_tokens")
    .update({
      revoked_at: now.toISOString(),
      revoked_by: params.ctx.actorStaffId,
      updated_at: now.toISOString(),
    })
    .eq("staff_id", staffId)
    .eq("branch_id", branchId)
    .eq("purpose", "device_recovery")
    .is("used_at", null)
    .is("revoked_at", null)
    .gt("expires_at", now.toISOString());

  const { data: insertedToken, error } = await admin
    .from("device_activation_tokens")
    .insert({
      staff_id: staffId,
      branch_id: branchId,
      token_hash: hashRecoveryToken(rawToken),
      expires_at: expiresAt,
      requested_by: params.ctx.actorStaffId,
      purpose: "device_recovery",
      reason: params.input.reason,
      revoke_previous_device_id: previousDeviceId,
      metadata: {
        source: "device_registry",
        ttl_minutes: params.input.expiresInMinutes,
      },
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  if (!insertedToken) throw new Error("Recovery link could not be created.");

  return {
    tokenId: insertedToken.id as string,
    recoveryUrl: buildActivationUrl(rawToken, params.origin),
    expiresAt,
    staffName: staff.full_name,
    branchName: branch.name ?? "Branch",
    reason: params.input.reason,
  };
}

export async function renameAttendanceDevice(params: {
  ctx: AttendanceActionContext;
  deviceId: string;
  label: string;
}): Promise<{ deviceId: string; label: string }> {
  const deviceId = trimInput(params.deviceId);
  const label = trimInput(params.label);
  if (!deviceId) throw new Error("Device ID is missing.");
  if (label.length < 2) throw new Error("Device name must be at least 2 characters.");
  if (label.length > 60) throw new Error("Device name must be 60 characters or fewer.");

  const admin = asAttendanceDb(createAdminClient());
  const { data, error } = await admin
    .from("staff_devices")
    .update({
      device_label: label,
      updated_at: new Date().toISOString(),
    })
    .eq("id", deviceId)
    .eq("branch_id", params.ctx.branchId)
    .select("id")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Device is not available in this workspace.");
  return { deviceId, label };
}

export async function revokeAttendanceDeviceWithReason(params: {
  ctx: AttendanceActionContext;
  deviceId: string;
  reason: DeviceRevocationReason;
}): Promise<{ deviceId: string; reason: DeviceRevocationReason }> {
  const deviceId = trimInput(params.deviceId);
  if (!deviceId) throw new Error("Device ID is missing.");
  if (!isRevocationReason(params.reason)) throw new Error("Choose a valid revocation reason.");

  const admin = asAttendanceDb(createAdminClient());
  const { data, error } = await admin
    .from("staff_devices")
    .update({
      status: "revoked",
      revoked_at: new Date().toISOString(),
      revoked_by: params.ctx.actorStaffId,
      revocation_reason: params.reason,
      updated_at: new Date().toISOString(),
    })
    .eq("id", deviceId)
    .eq("branch_id", params.ctx.branchId)
    .select("id")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Device is not available in this workspace.");
  return { deviceId, reason: params.reason };
}

export async function revokeDeviceRecoveryLink(params: {
  ctx: AttendanceActionContext;
  tokenId: string;
}): Promise<{ tokenId: string }> {
  const tokenId = trimInput(params.tokenId);
  if (!tokenId) throw new Error("Recovery link ID is missing.");

  const admin = asAttendanceDb(createAdminClient());
  const { data, error } = await admin
    .from("device_activation_tokens")
    .update({
      revoked_at: new Date().toISOString(),
      revoked_by: params.ctx.actorStaffId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", tokenId)
    .eq("branch_id", params.ctx.branchId)
    .eq("purpose", "device_recovery")
    .is("used_at", null)
    .is("revoked_at", null)
    .select("id")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Recovery link is no longer pending.");
  return { tokenId };
}

export async function getRecoveryTokenPreview(rawToken: string): Promise<RecoveryTokenPreview> {
  const token = trimInput(rawToken);
  if (!token) return previewFailure("invalid_token");

  const admin = asAttendanceDb(createAdminClient());
  const { data, error } = await admin
    .from("device_activation_tokens")
    .select("id, purpose, staff_id, branch_id, reason, expires_at, used_at, revoked_at, staff:staff!device_activation_tokens_staff_id_fkey(full_name, staff_type, is_active), branches(name, is_active)")
    .eq("token_hash", hashRecoveryToken(token))
    .maybeSingle();

  if (error) throw new Error(error.message);
  const row = data as RecoveryTokenRow | null;
  if (!row || row.purpose !== "device_recovery") return previewFailure("invalid_token");
  if (row.used_at) return previewFailure("token_used");
  if (row.revoked_at) return previewFailure("token_revoked");
  if (new Date(row.expires_at).getTime() <= Date.now()) return previewFailure("token_expired");

  const staff = first(row.staff);
  if (!staff?.is_active) return previewFailure("staff_inactive");
  const branch = first(row.branches);
  if (!branch?.is_active) return previewFailure("branch_unavailable");

  return {
    ok: true,
    staffName: staff.full_name ?? "Staff member",
    staffType: staff.staff_type ?? "staff",
    branchName: branch.name ?? "Branch",
    expiresAt: row.expires_at,
    reason: row.reason ?? "other",
  };
}

export async function consumeDeviceRecoveryLink(params: {
  rawToken: string;
  userAgent?: string | null;
}): Promise<ConsumeDeviceRecoveryResult> {
  const token = trimInput(params.rawToken);
  if (!token) return consumeFailure("invalid_token");

  const rawDeviceCredential = createDeviceCredential();
  const hints = inferDeviceClientHints(params.userAgent);
  const admin = asAttendanceDb(createAdminClient());
  const { data, error } = await admin.rpc("consume_attendance_device_recovery", {
    p_raw_token: token,
    p_device_fingerprint_hash: hashSecret(rawDeviceCredential),
    p_device_label: hints.label,
    p_user_agent: params.userAgent ?? null,
    p_browser_name: hints.browserName,
    p_browser_version: hints.browserVersion,
    p_platform_name: hints.platformName,
    p_active_device_limit: ACTIVE_DEVICE_LIMIT,
  });

  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? (data[0] as ConsumeRpcRow | undefined) : (data as ConsumeRpcRow | null);
  if (!row) return consumeFailure("invalid_token");
  if (!row.success) return consumeFailure(row.code, row.message);
  if (!row.device_id || !row.staff_id || !row.branch_id) return consumeFailure("invalid_token");

  return {
    success: true,
    rawDeviceCredential,
    deviceId: row.device_id,
    staffId: row.staff_id,
    staffName: row.staff_name ?? "Staff member",
    staffType: row.staff_type ?? "staff",
    branchId: row.branch_id,
    branchName: row.branch_name ?? "Branch",
    expiresAt: row.expires_at ?? new Date().toISOString(),
  };
}
