import "server-only";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isDevAuthBypassEnabled } from "@/lib/dev-bypass";
import { getDevBypassBranchContext } from "@/lib/dev-bypass-server";
import { canAccessCrmWorkspace } from "@/lib/auth/crm-permissions";
import { canonicalizeSystemRole } from "@/constants/staff-roles";
import { asAttendanceDb, type AttendanceDb } from "@/lib/attendance/db";
import { buildActivationUrl, getAppBaseUrl, renderQrSvg } from "@/lib/attendance/qr-code";
import { createActivationToken, createPublicCode, hashSecret } from "@/lib/attendance/tokens";
import { getBranchBusinessDate } from "@/lib/engine/slot-time";
import type {
  AttendanceDevice,
  AttendanceException,
  AttendanceQrConfiguration,
  AttendanceQrPoint,
  AttendanceRecord,
  AttendanceScanEvent,
  AttendanceSession,
  AttendanceSettings,
  AttendanceWorkspaceData,
} from "@/lib/attendance/types";

export type AttendanceActionContext = {
  branchId: string;
  branchName: string;
  actorStaffId: string | null;
  role: string;
};

const DEFAULT_SETTINGS: Omit<AttendanceSettings, "branch_id"> = {
  duplicate_scan_window_seconds: 90,
  clock_in_early_grace_minutes: 15,
  clock_in_late_grace_minutes: 5,
  clock_out_early_grace_minutes: 5,
  clock_out_late_grace_minutes: 15,
  overnight_shift_cutoff_time: "06:00:00",
  active_service_blocks_clock_out: true,
  require_registered_device_for_attendance: false,
};

type Relation<T> = T | T[] | null | undefined;
type BranchRow = { id: string; name: string | null };

function first<T>(value: Relation<T>): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function safeNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

async function requireBranch(admin: AttendanceDb, branchId: string): Promise<BranchRow> {
  const { data, error } = await admin
    .from("branches")
    .select("id, name")
    .eq("id", branchId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) {
    throw new Error("Attendance needs a real active branch before QR codes can be generated.");
  }

  return data as unknown as BranchRow;
}

export async function getAttendanceActionContext(): Promise<AttendanceActionContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: me } = await supabase
    .from("staff")
    .select("id, branch_id, branches(name), system_role")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (me?.branch_id && canAccessCrmWorkspace(me.system_role)) {
    const branch = first(me.branches as Relation<{ name: string | null }>);
    return {
      branchId: me.branch_id,
      branchName: branch?.name ?? "Branch",
      actorStaffId: me.id,
      role: canonicalizeSystemRole(me.system_role),
    };
  }

  if (isDevAuthBypassEnabled()) {
    const devBranch = await getDevBypassBranchContext();
    if (!devBranch) return null;
    return {
      branchId: devBranch.branchId,
      branchName: devBranch.branchName,
      actorStaffId: null,
      role: canonicalizeSystemRole(devBranch.role),
    };
  }

  return null;
}

export async function getAttendanceSettings(branchId: string): Promise<AttendanceSettings> {
  const admin = asAttendanceDb(createAdminClient());
  const { data } = await admin
    .from("attendance_settings")
    .select("*")
    .eq("branch_id", branchId)
    .maybeSingle();

  if (data) return data as unknown as AttendanceSettings;

  await requireBranch(admin, branchId);
  const fallback = { branch_id: branchId, ...DEFAULT_SETTINGS };
  const { data: inserted } = await admin
    .from("attendance_settings")
    .insert(fallback)
    .select("*")
    .maybeSingle();

  return (inserted as unknown as AttendanceSettings | null) ?? fallback;
}

export async function ensureBranchAttendanceQrPoint(ctx: AttendanceActionContext): Promise<AttendanceQrPoint> {
  const admin = asAttendanceDb(createAdminClient());
  const branch = await requireBranch(admin, ctx.branchId);
  const existing = await admin
    .from("qr_points")
    .select("*, branch_resources(name)")
    .eq("branch_id", branch.id)
    .eq("point_type", "attendance")
    .eq("is_active", true)
    .maybeSingle();

  if (existing.data) {
    return mapQrPoint({ row: existing.data, scanUrl: null, svg: null });
  }

  const publicCode = createPublicCode("att");
  const inserted = await admin
    .from("qr_points")
    .insert({
      branch_id: branch.id,
      point_type: "attendance",
      public_code: publicCode,
      label: `${branch.name ?? ctx.branchName} Attendance`,
      description: "Branch staff attendance clock-in and clock-out",
      requires_registered_device: true,
      scan_behavior: "auto",
      created_by: ctx.actorStaffId,
    })
    .select("*, branch_resources(name)")
    .single();

  if (inserted.error) {
    const retry = await admin
      .from("qr_points")
      .select("*, branch_resources(name)")
      .eq("branch_id", branch.id)
      .eq("point_type", "attendance")
      .eq("is_active", true)
      .single();

    if (retry.data) return mapQrPoint({ row: retry.data, scanUrl: null, svg: null });
    throw new Error(inserted.error.message);
  }

  return mapQrPoint({ row: inserted.data, scanUrl: null, svg: null });
}

export async function ensureRoomQrPoints(ctx: AttendanceActionContext): Promise<{
  createdCount: number;
  qrPoints: AttendanceQrPoint[];
}> {
  const admin = asAttendanceDb(createAdminClient());
  const branch = await requireBranch(admin, ctx.branchId);
  const [resourcesResult, pointsResult] = await Promise.all([
    admin
      .from("branch_resources")
      .select("id, name, type, is_active")
      .eq("branch_id", branch.id)
      .eq("is_active", true),
    admin
      .from("qr_points")
      .select("resource_id")
      .eq("branch_id", branch.id)
      .in("point_type", ["room", "resource"])
      .eq("is_active", true),
  ]);

  if (resourcesResult.error) throw new Error(resourcesResult.error.message);
  if (pointsResult.error) throw new Error(pointsResult.error.message);

  const existingResourceIds = new Set(
    (pointsResult.data ?? [])
      .map((row: { resource_id?: string | null }) => row.resource_id)
      .filter((id: string | null | undefined): id is string => Boolean(id))
  );

  const missing = (resourcesResult.data ?? []).filter(
    (resource: { id: string }) => !existingResourceIds.has(resource.id)
  );

  if (missing.length === 0) return { createdCount: 0, qrPoints: [] };

  const rows = missing.map((resource: { id: string; name: string; type?: string | null }) => ({
    branch_id: branch.id,
    point_type: "room",
    resource_id: resource.id,
    public_code: createPublicCode("room"),
    label: resource.name,
    description: "Room or resource service-session start QR",
    requires_registered_device: true,
    scan_behavior: "start_session",
    created_by: ctx.actorStaffId,
  }));

  const { data, error } = await admin.from("qr_points").insert(rows).select("*, branch_resources(name)");
  if (error) throw new Error(error.message);
  return {
    createdCount: rows.length,
    qrPoints: (data ?? []).map((row: unknown) => mapQrPoint({ row, scanUrl: null, svg: null })),
  };
}

export async function deactivateQrPoint(params: {
  ctx: AttendanceActionContext;
  qrPointId: string;
}): Promise<void> {
  const admin = asAttendanceDb(createAdminClient());
  const { data, error } = await admin
    .from("qr_points")
    .update({ is_active: false })
    .eq("id", params.qrPointId)
    .eq("branch_id", params.ctx.branchId)
    .select("id");

  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error("The selected QR code is no longer available.");
  }
}

export async function createDeviceActivationLink(params: {
  ctx: AttendanceActionContext;
  staffId: string;
  origin?: string | null;
}): Promise<{ token: string; activationUrl: string; expiresAt: string }> {
  const admin = asAttendanceDb(createAdminClient());

  const { data: staff, error: staffError } = await admin
    .from("staff")
    .select("id, branch_id, full_name, is_active")
    .eq("id", params.staffId)
    .maybeSingle();

  if (staffError) throw new Error(staffError.message);
  if (!staff || staff.branch_id !== params.ctx.branchId || !staff.is_active) {
    throw new Error("Staff member is not active in this branch.");
  }

  const token = createActivationToken();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const { error } = await admin.from("device_activation_tokens").insert({
    staff_id: params.staffId,
    branch_id: params.ctx.branchId,
    token_hash: hashSecret(token),
    expires_at: expiresAt,
    requested_by: params.ctx.actorStaffId,
  });

  if (error) throw new Error(error.message);

  return {
    token,
    activationUrl: buildActivationUrl(token, params.origin),
    expiresAt,
  };
}

export async function revokeAttendanceDevice(params: {
  ctx: AttendanceActionContext;
  deviceId: string;
}): Promise<void> {
  const admin = asAttendanceDb(createAdminClient());
  const { error } = await admin
    .from("staff_devices")
    .update({
      status: "revoked",
      revoked_at: new Date().toISOString(),
      revoked_by: params.ctx.actorStaffId,
    })
    .eq("id", params.deviceId)
    .eq("branch_id", params.ctx.branchId);

  if (error) throw new Error(error.message);
}

export async function resolveAttendanceException(params: {
  ctx: AttendanceActionContext;
  exceptionId: string;
  resolutionNote?: string | null;
}): Promise<void> {
  const admin = asAttendanceDb(createAdminClient());
  const { error } = await admin
    .from("attendance_exceptions")
    .update({
      status: "resolved",
      resolved_at: new Date().toISOString(),
      resolved_by: params.ctx.actorStaffId,
      resolution_note: params.resolutionNote?.trim() || null,
    })
    .eq("id", params.exceptionId)
    .eq("branch_id", params.ctx.branchId);

  if (error) throw new Error(error.message);
}

export async function completeDueServiceSessionsNow(): Promise<number> {
  const admin = asAttendanceDb(createAdminClient());
  const { data, error } = await admin.rpc("complete_due_service_sessions", { p_limit: 100 });
  if (error) throw new Error(error.message);
  return Array.isArray(data) ? data.length : 0;
}

export async function getAttendanceWorkspaceData(params: {
  branchId: string;
  branchName: string;
  origin?: string | null;
}): Promise<AttendanceWorkspaceData> {
  const admin = asAttendanceDb(createAdminClient());
  const today = getBranchBusinessDate();
  const settings = await getAttendanceSettings(params.branchId);

  const [
    qrPointsResult,
    devicesResult,
    recordsResult,
    exceptionsResult,
    scanEventsResult,
    sessionsResult,
    staffResult,
    resourcesResult,
  ] = await Promise.all([
    admin
      .from("qr_points")
      .select("*, branch_resources(name)")
      .eq("branch_id", params.branchId)
      .order("point_type")
      .order("label"),
    admin
      .from("staff_devices")
      .select("id, staff_id, branch_id, device_label, status, trusted_after, last_seen_at, created_at, staff(full_name)")
      .eq("branch_id", params.branchId)
      .order("created_at", { ascending: false })
      .limit(100),
    admin
      .from("staff_shift_checkins")
      .select("id, staff_id, shift_date, shift_type, checked_in_at, checked_out_at, status, attendance_status, worked_minutes, late_minutes, early_leave_minutes, overtime_minutes, staff(full_name), qr_points(label)")
      .eq("branch_id", params.branchId)
      .gte("shift_date", today)
      .order("checked_in_at", { ascending: false })
      .limit(100),
    admin
      .from("attendance_exceptions")
      .select("id, branch_id, staff_id, exception_type, severity, status, message, detected_at, resolved_at, staff(full_name)")
      .eq("branch_id", params.branchId)
      .order("detected_at", { ascending: false })
      .limit(100),
    admin
      .from("qr_scan_events")
      .select("id, scan_type, action, outcome, reason_code, message, created_at, booking_id, staff(full_name), qr_points(label)")
      .eq("branch_id", params.branchId)
      .order("created_at", { ascending: false })
      .limit(80),
    admin
      .from("bookings")
      .select("id, booking_date, start_time, status, booking_progress_status, session_started_at, session_due_at, session_completed_at, session_duration_minutes_snapshot, customers(full_name), services(name, duration_minutes), staff(full_name), branch_resources(name)")
      .eq("branch_id", params.branchId)
      .in("booking_progress_status", ["session_started", "completed"])
      .gte("booking_date", today)
      .order("session_started_at", { ascending: false, nullsFirst: false })
      .limit(100),
    admin
      .from("staff")
      .select("id, full_name, staff_type")
      .eq("branch_id", params.branchId)
      .eq("is_active", true)
      .order("full_name"),
    admin
      .from("branch_resources")
      .select("id, name, type, is_active")
      .eq("branch_id", params.branchId)
      .order("sort_order")
      .order("name"),
  ]);

  const qrRows = qrPointsResult.data ?? [];
  const qrWorkspaceData = await resolveQrWorkspaceData({
    rows: qrRows,
    origin: params.origin,
  });

  const devices = (devicesResult.data ?? []).map(mapDevice);
  const records = (recordsResult.data ?? []).map(mapRecord);
  const exceptions = (exceptionsResult.data ?? []).map(mapException);
  const scanEvents = (scanEventsResult.data ?? []).map(mapScanEvent);
  const sessions = (sessionsResult.data ?? []).map(mapSession);
  const activeSessions = sessions.filter((session) => session.booking_progress_status === "session_started").length;

  return {
    branchName: params.branchName,
    settings,
    summary: {
      checkedInNow: records.filter((record) => record.status === "checked_in").length,
      recordsToday: records.filter((record) => record.shift_date === today).length,
      openExceptions: exceptions.filter((exception) => exception.status === "open").length,
      activeSessions,
      activeDevices: devices.filter((device) => device.status === "active").length,
    },
    qrConfiguration: qrWorkspaceData.configuration,
    qrPoints: qrWorkspaceData.qrPoints,
    devices,
    records,
    exceptions,
    scanEvents,
    sessions,
    staffOptions: (staffResult.data ?? []).map((row: { id: string; full_name: string; staff_type?: string | null }) => ({
      id: row.id,
      full_name: row.full_name,
      staff_type: row.staff_type ?? null,
    })),
    resourceOptions: (resourcesResult.data ?? []).map((row: { id: string; name: string; type?: string | null; is_active: boolean }) => ({
      id: row.id,
      name: row.name,
      type: row.type ?? null,
      is_active: row.is_active,
    })),
  };
}

export function revalidateAttendanceSurfaces(): void {
  revalidatePath("/crm/attendance");
  revalidatePath("/crm/availability");
  revalidatePath("/crm/today");
  revalidatePath("/staff-portal");
}

function createUnavailableQrPoint(row: unknown): AttendanceQrPoint {
  return mapQrPoint({ row, scanUrl: null, svg: null });
}

async function resolveQrWorkspaceData(params: {
  rows: unknown[];
  origin?: string | null;
}): Promise<{
  qrPoints: AttendanceQrPoint[];
  configuration: AttendanceQrConfiguration;
}> {
  try {
    const baseUrl = getAppBaseUrl({ origin: params.origin });
    const qrPoints = await Promise.all(
      params.rows.map(async (row) => {
        const publicCode = (row as { public_code: string }).public_code;
        const scanUrl = `${baseUrl}/scan/${encodeURIComponent(publicCode)}`;
        const svg = await renderQrSvg(scanUrl);
        return mapQrPoint({ row, scanUrl, svg });
      })
    );

    return {
      qrPoints,
      configuration: {
        isConfigured: true,
        baseUrl,
        error: null,
      },
    };
  } catch {
    return {
      qrPoints: params.rows.map(createUnavailableQrPoint),
      configuration: {
        isConfigured: false,
        baseUrl: null,
        error: "QR links are unavailable because APP_URL or NEXT_PUBLIC_APP_URL is not configured with a public domain.",
      },
    };
  }
}

function mapQrPoint(params: {
  row: unknown;
  scanUrl: string | null;
  svg: string | null;
}): AttendanceQrPoint {
  const point = params.row as {
    id: string;
    branch_id: string;
    point_type: "attendance" | "room" | "resource";
    resource_id: string | null;
    public_code: string;
    label: string;
    description: string | null;
    is_active: boolean;
    requires_registered_device: boolean;
    scan_behavior: string;
    created_at: string;
    updated_at: string;
    branch_resources?: Relation<{ name: string | null }>;
  };

  return {
    id: point.id,
    branch_id: point.branch_id,
    point_type: point.point_type,
    resource_id: point.resource_id,
    public_code: point.public_code,
    label: point.label,
    description: point.description,
    is_active: point.is_active,
    requires_registered_device: point.requires_registered_device,
    scan_behavior: point.scan_behavior,
    created_at: point.created_at,
    updated_at: point.updated_at,
    resource_name: first(point.branch_resources)?.name ?? null,
    scan_url: params.scanUrl,
    svg: params.svg,
  };
}

function mapDevice(row: unknown): AttendanceDevice {
  const device = row as {
    id: string;
    staff_id: string;
    branch_id: string;
    device_label: string | null;
    status: "active" | "revoked";
    trusted_after: string;
    last_seen_at: string | null;
    created_at: string;
    staff?: Relation<{ full_name: string | null }>;
  };
  return {
    id: device.id,
    staff_id: device.staff_id,
    branch_id: device.branch_id,
    device_label: device.device_label,
    status: device.status,
    trusted_after: device.trusted_after,
    last_seen_at: device.last_seen_at,
    created_at: device.created_at,
    staff_name: first(device.staff)?.full_name ?? "Staff member",
  };
}

function mapRecord(row: unknown): AttendanceRecord {
  const record = row as {
    id: string;
    staff_id: string;
    shift_date: string;
    shift_type: string;
    checked_in_at: string;
    checked_out_at: string | null;
    status: string;
    attendance_status?: string | null;
    worked_minutes?: number | null;
    late_minutes?: number | null;
    early_leave_minutes?: number | null;
    overtime_minutes?: number | null;
    staff?: Relation<{ full_name: string | null }>;
    qr_points?: Relation<{ label: string | null }>;
  };

  return {
    id: record.id,
    staff_id: record.staff_id,
    staff_name: first(record.staff)?.full_name ?? "Staff member",
    shift_date: record.shift_date,
    shift_type: record.shift_type,
    checked_in_at: record.checked_in_at,
    checked_out_at: record.checked_out_at,
    status: record.status,
    attendance_status: record.attendance_status ?? "present",
    worked_minutes: safeNumber(record.worked_minutes),
    late_minutes: safeNumber(record.late_minutes),
    early_leave_minutes: safeNumber(record.early_leave_minutes),
    overtime_minutes: safeNumber(record.overtime_minutes),
    source_label: first(record.qr_points)?.label ?? null,
  };
}

function mapException(row: unknown): AttendanceException {
  const exception = row as {
    id: string;
    branch_id: string;
    staff_id: string | null;
    exception_type: string;
    severity: string;
    status: string;
    message: string;
    detected_at: string;
    resolved_at: string | null;
    staff?: Relation<{ full_name: string | null }>;
  };

  return {
    id: exception.id,
    branch_id: exception.branch_id,
    staff_id: exception.staff_id,
    staff_name: first(exception.staff)?.full_name ?? null,
    exception_type: exception.exception_type,
    severity: exception.severity,
    status: exception.status,
    message: exception.message,
    detected_at: exception.detected_at,
    resolved_at: exception.resolved_at,
  };
}

function mapScanEvent(row: unknown): AttendanceScanEvent {
  const event = row as {
    id: string;
    scan_type: AttendanceScanEvent["scan_type"];
    action: string;
    outcome: AttendanceScanEvent["outcome"];
    reason_code: string | null;
    message: string | null;
    created_at: string;
    booking_id: string | null;
    staff?: Relation<{ full_name: string | null }>;
    qr_points?: Relation<{ label: string | null }>;
  };

  return {
    id: event.id,
    scan_type: event.scan_type,
    action: event.action,
    outcome: event.outcome,
    reason_code: event.reason_code,
    message: event.message,
    created_at: event.created_at,
    staff_name: first(event.staff)?.full_name ?? null,
    point_label: first(event.qr_points)?.label ?? null,
    booking_id: event.booking_id,
  };
}

function mapSession(row: unknown): AttendanceSession {
  const booking = row as {
    id: string;
    booking_date: string;
    start_time: string;
    status: string;
    booking_progress_status: string;
    session_started_at: string | null;
    session_due_at: string | null;
    session_completed_at: string | null;
    session_duration_minutes_snapshot: number | null;
    customers?: Relation<{ full_name: string | null }>;
    services?: Relation<{ name: string | null; duration_minutes: number | null }>;
    staff?: Relation<{ full_name: string | null }>;
    branch_resources?: Relation<{ name: string | null }>;
  };

  const service = first(booking.services);
  return {
    id: booking.id,
    customer_name: first(booking.customers)?.full_name ?? "Customer",
    service_name: service?.name ?? "Service",
    staff_name: first(booking.staff)?.full_name ?? "Staff member",
    resource_name: first(booking.branch_resources)?.name ?? null,
    booking_date: booking.booking_date,
    start_time: booking.start_time,
    status: booking.status,
    booking_progress_status: booking.booking_progress_status,
    session_started_at: booking.session_started_at,
    session_due_at: booking.session_due_at,
    session_completed_at: booking.session_completed_at,
    duration_minutes: booking.session_duration_minutes_snapshot ?? service?.duration_minutes ?? null,
  };
}
