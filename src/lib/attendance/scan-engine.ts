import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { asAttendanceDb, type AttendanceDb } from "@/lib/attendance/db";
import { inferDeviceClientHints } from "@/lib/attendance/device-display";
import { getAttendanceSettings } from "@/lib/attendance/queries";
import { createDeviceCredential, hashSecret, maskId } from "@/lib/attendance/tokens";
import {
  branchDateTimeToIso,
  computeAttendanceMetrics,
  formatMinutesCompact,
  getBranchNow,
  isOvernightWindow,
} from "@/lib/attendance/time";
import { getResolvedStaffSchedulesForDate } from "@/lib/queries/resolved-staff-schedules";
import { isTimeWithinScheduleWindows, type ResolvedStaffScheduleWindow } from "@/lib/schedule/resolve-staff-schedule";
import type { PublicScanResult, QrScanOutcome, QrScanType } from "@/lib/attendance/types";

export type ScanRequestContext = {
  requestId?: string | null;
  rawDeviceCredential?: string | null;
  userAgent?: string | null;
  ipAddress?: string | null;
};

export type ActivationResult = PublicScanResult & {
  rawDeviceCredential?: string;
};

export type FirstScanDeviceRegistrationResult =
  | {
      ok: true;
      rawDeviceCredential: string;
      deviceId: string;
      staffId: string;
      branchId: string;
      staffName: string;
      branchName: string;
      scanEventId?: string;
      registeredNewDevice: boolean;
    }
  | {
      ok: false;
      result: PublicScanResult;
    };

type StaffDeviceRow = {
  id: string;
  staff_id: string;
  branch_id: string;
  status: "active" | "revoked";
  staff?: { full_name: string | null; staff_type: string | null; is_active: boolean } | Array<{ full_name: string | null; staff_type: string | null; is_active: boolean }> | null;
};

type AuthenticatedStaffRow = {
  id: string;
  branch_id: string;
  full_name: string | null;
  staff_type: string | null;
  is_active: boolean;
  branches?: { name: string | null } | Array<{ name: string | null }> | null;
};

type QrPointRow = {
  id: string;
  branch_id: string;
  point_type: "attendance" | "room" | "resource";
  resource_id: string | null;
  label: string;
  is_active: boolean;
  requires_registered_device: boolean;
  scan_behavior: string;
  branch_resources?: { name: string | null; type: string | null } | Array<{ name: string | null; type: string | null }> | null;
  branches?: { name: string | null } | Array<{ name: string | null }> | null;
};

type CheckinRow = {
  id: string;
  staff_id: string;
  branch_id: string;
  shift_date: string;
  shift_type: string;
  checked_in_at: string;
  checked_out_at: string | null;
  status: string;
  scheduled_start_at?: string | null;
  scheduled_end_at?: string | null;
};

type BookingRow = {
  id: string;
  branch_id: string;
  staff_id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: string;
  booking_progress_status: string;
  resource_id: string | null;
  session_started_at: string | null;
  session_due_at?: string | null;
  session_completed_at?: string | null;
  session_duration_minutes_snapshot?: number | null;
  customers?: { full_name: string | null } | Array<{ full_name: string | null }> | null;
  services?: { name: string | null; duration_minutes: number | null } | Array<{ name: string | null; duration_minutes: number | null }> | null;
  branch_resources?: { name: string | null } | Array<{ name: string | null }> | null;
};

type ScheduleSelection = {
  shiftDate: string;
  shiftType: string;
  scheduledStartAt: string | null;
  scheduledEndAt: string | null;
  isUnscheduled: boolean;
};

type EventInput = {
  branchId?: string | null;
  qrPointId?: string | null;
  staffId?: string | null;
  deviceId?: string | null;
  checkinId?: string | null;
  bookingId?: string | null;
  resourceId?: string | null;
  scanType: QrScanType;
  action: string;
  outcome: QrScanOutcome;
  reasonCode?: string | null;
  message?: string | null;
  requestId?: string | null;
  userAgent?: string | null;
  ipAddress?: string | null;
  metadata?: Record<string, unknown>;
};

function first<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function scanTypeForPoint(point: QrPointRow): QrScanType {
  return point.point_type === "attendance" ? "attendance" : "room";
}

function success(title: string, message: string, extra: Partial<PublicScanResult> = {}): PublicScanResult {
  const outcome = extra.outcome ?? "success";
  return {
    ok: true,
    outcome,
    severity: extra.severity ?? (outcome === "noop" ? "info" : "success"),
    title,
    message,
    ...extra,
  };
}

function blocked(title: string, message: string, extra: Partial<PublicScanResult> = {}): PublicScanResult {
  const outcome = extra.outcome ?? "blocked";
  return {
    ok: false,
    outcome,
    severity: extra.severity ?? (outcome === "error" ? "critical" : "warning"),
    title,
    message,
    ...extra,
  };
}

function parseIp(value: string | null | undefined): string | null {
  const firstIp = value?.split(",")[0]?.trim();
  if (!firstIp) return null;
  if (!/^[0-9a-fA-F:.]+$/.test(firstIp)) return null;
  return firstIp;
}

async function recordScanEvent(admin: AttendanceDb, input: EventInput): Promise<string | null> {
  const payload = {
    branch_id: input.branchId ?? null,
    qr_point_id: input.qrPointId ?? null,
    staff_id: input.staffId ?? null,
    device_id: input.deviceId ?? null,
    checkin_id: input.checkinId ?? null,
    booking_id: input.bookingId ?? null,
    resource_id: input.resourceId ?? null,
    scan_type: input.scanType,
    action: input.action,
    outcome: input.outcome,
    reason_code: input.reasonCode ?? null,
    message: input.message ?? null,
    request_id: input.requestId || null,
    user_agent: input.userAgent ?? null,
    ip_address: parseIp(input.ipAddress),
    metadata: input.metadata ?? {},
  };

  const inserted = await admin.from("qr_scan_events").insert(payload).select("id").maybeSingle();
  if (!inserted.error) return inserted.data?.id ?? null;

  if (inserted.error.code === "23505" && input.requestId) {
    const existing = await admin
      .from("qr_scan_events")
      .select("id")
      .eq("request_id", input.requestId)
      .maybeSingle();
    return existing.data?.id ?? null;
  }

  if (payload.ip_address) {
    const retry = await admin
      .from("qr_scan_events")
      .insert({ ...payload, ip_address: null })
      .select("id")
      .maybeSingle();
    return retry.data?.id ?? null;
  }

  return null;
}

async function recordException(admin: AttendanceDb, input: {
  branchId: string;
  staffId?: string | null;
  checkinId?: string | null;
  scanEventId?: string | null;
  exceptionType: string;
  severity?: "info" | "warning" | "critical";
  message: string;
  metadata?: Record<string, unknown>;
}) {
  await admin.from("attendance_exceptions").insert({
    branch_id: input.branchId,
    staff_id: input.staffId ?? null,
    checkin_id: input.checkinId ?? null,
    scan_event_id: input.scanEventId ?? null,
    exception_type: input.exceptionType,
    severity: input.severity ?? "warning",
    message: input.message,
    metadata: input.metadata ?? {},
  });
}

async function resolveDevice(admin: AttendanceDb, rawCredential: string | null | undefined): Promise<StaffDeviceRow | null> {
  if (!rawCredential) return null;
  const { data } = await admin
    .from("staff_devices")
    .select("id, staff_id, branch_id, status, staff(full_name, staff_type, is_active)")
    .eq("device_fingerprint_hash", hashSecret(rawCredential))
    .maybeSingle();

  return (data as StaffDeviceRow | null) ?? null;
}

async function markDeviceScanSuccess(admin: AttendanceDb, params: {
  deviceId: string;
  scanType: "attendance" | "service";
  scannedAt?: string;
}) {
  const scannedAt = params.scannedAt ?? new Date().toISOString();
  const update =
    params.scanType === "attendance"
      ? { last_seen_at: scannedAt, last_attendance_scan_at: scannedAt }
      : { last_seen_at: scannedAt, last_service_scan_at: scannedAt };

  await admin.from("staff_devices").update(update).eq("id", params.deviceId);
}

async function loadQrPoint(admin: AttendanceDb, publicCode: string): Promise<QrPointRow | null> {
  const { data } = await admin
    .from("qr_points")
    .select("id, branch_id, point_type, resource_id, label, is_active, requires_registered_device, scan_behavior, branch_resources(name, type), branches(name)")
    .eq("public_code", publicCode)
    .maybeSingle();

  return (data as QrPointRow | null) ?? null;
}

export async function registerDeviceForAuthenticatedScan(
  publicCode: string,
  authUserId: string,
  ctx: ScanRequestContext
): Promise<FirstScanDeviceRegistrationResult> {
  const admin = asAttendanceDb(createAdminClient());
  const point = await loadQrPoint(admin, publicCode);

  if (!point || !point.is_active) {
    const eventId = await recordScanEvent(admin, {
      scanType: "unknown",
      action: "first_scan_register_device",
      outcome: "blocked",
      reasonCode: "invalid_qr",
      message: "Unknown or inactive QR code.",
      requestId: ctx.requestId,
      userAgent: ctx.userAgent,
      ipAddress: ctx.ipAddress,
      metadata: { publicCode: maskId(publicCode) },
    });

    return {
      ok: false,
      result: blocked("QR not recognized", "This QR code is not active in CradleHub.", {
        reasonCode: "invalid_qr",
        securityNote: "No attendance change was recorded from this scan.",
        scanEventId: eventId ?? undefined,
      }),
    };
  }

  const existingDevice = await resolveDevice(admin, ctx.rawDeviceCredential);
  const existingDeviceStaff = first(existingDevice?.staff);
  if (existingDevice && (existingDevice.status !== "active" || existingDeviceStaff?.is_active === false)) {
    const eventId = await recordScanEvent(admin, {
      branchId: point.branch_id,
      qrPointId: point.id,
      staffId: existingDevice.staff_id,
      deviceId: existingDevice.id,
      scanType: scanTypeForPoint(point),
      action: "first_scan_register_device",
      outcome: "blocked",
      reasonCode: "revoked_device",
      message: "The registered device is revoked or staff is inactive.",
      requestId: ctx.requestId,
      userAgent: ctx.userAgent,
      ipAddress: ctx.ipAddress,
    });

    await recordException(admin, {
      branchId: point.branch_id,
      staffId: existingDevice.staff_id,
      scanEventId: eventId,
      exceptionType: "revoked_device",
      severity: "critical",
      message: `A revoked or inactive device attempted first-scan login at ${point.label}.`,
    });

    return {
      ok: false,
      result: blocked("Device blocked", "This device is no longer active. Ask the front desk to re-activate it.", {
        reasonCode: "revoked_device",
        severity: "critical",
        securityNote: "This phone cannot be used for attendance until access is restored.",
        scanEventId: eventId ?? undefined,
      }),
    };
  }

  const staffResult = await admin
    .from("staff")
    .select("id, branch_id, full_name, staff_type, is_active, branches(name)")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  const staff = (staffResult.data as AuthenticatedStaffRow | null) ?? null;
  if (staffResult.error || !staff || !staff.is_active) {
    const eventId = await recordScanEvent(admin, {
      branchId: point.branch_id,
      qrPointId: point.id,
      scanType: scanTypeForPoint(point),
      action: "first_scan_register_device",
      outcome: staffResult.error ? "error" : "blocked",
      reasonCode: staffResult.error ? "device_registration_failed" : "account_not_eligible",
      message: staffResult.error?.message ?? "Authenticated user is not connected to an active staff profile.",
      requestId: ctx.requestId,
      userAgent: ctx.userAgent,
      ipAddress: ctx.ipAddress,
    });

    return {
      ok: false,
      result: blocked("Account not eligible", "This account is not connected to an active staff profile. Please contact the front desk.", {
        outcome: staffResult.error ? "error" : "blocked",
        reasonCode: staffResult.error ? "device_registration_failed" : "account_not_eligible",
        severity: staffResult.error ? "critical" : "warning",
        securityNote: "No phone was connected from this sign-in.",
        scanEventId: eventId ?? undefined,
      }),
    };
  }

  const staffName = staff.full_name ?? "Staff member";
  const branchName = first(point.branches)?.name ?? first(staff.branches)?.name ?? "Branch";

  if (existingDevice) {
    if (existingDevice.branch_id !== point.branch_id) {
      const eventId = await recordScanEvent(admin, {
        branchId: point.branch_id,
        qrPointId: point.id,
        staffId: existingDevice.staff_id,
        deviceId: existingDevice.id,
        scanType: scanTypeForPoint(point),
        action: "first_scan_register_device",
        outcome: "blocked",
        reasonCode: "wrong_branch",
        message: "Device belongs to a different branch.",
        requestId: ctx.requestId,
        userAgent: ctx.userAgent,
        ipAddress: ctx.ipAddress,
      });

      await recordException(admin, {
        branchId: point.branch_id,
        staffId: existingDevice.staff_id,
        scanEventId: eventId,
        exceptionType: "wrong_branch",
        severity: "critical",
        message: `${existingDeviceStaff?.full_name ?? "Staff member"} attempted first-scan login at another branch.`,
      });

      return {
        ok: false,
        result: blocked("Wrong branch", "This phone is linked to a different branch. Please use the correct branch QR or contact the front desk.", {
          reasonCode: "wrong_branch",
          severity: "critical",
          securityNote: "This phone is trusted, but not for this branch QR.",
          scanEventId: eventId ?? undefined,
        }),
      };
    }

    if (existingDevice.staff_id !== staff.id) {
      const eventId = await recordScanEvent(admin, {
        branchId: point.branch_id,
        qrPointId: point.id,
        staffId: staff.id,
        deviceId: existingDevice.id,
        scanType: scanTypeForPoint(point),
        action: "first_scan_register_device",
        outcome: "blocked",
        reasonCode: "device_staff_mismatch",
        message: "Authenticated staff does not own the existing device credential.",
        requestId: ctx.requestId,
        userAgent: ctx.userAgent,
        ipAddress: ctx.ipAddress,
      });

      return {
        ok: false,
        result: blocked("Phone already connected", "This phone is linked to a different staff account. Please contact the front desk.", {
          reasonCode: "device_staff_mismatch",
          severity: "critical",
          securityNote: "No attendance change was recorded from this sign-in.",
          scanEventId: eventId ?? undefined,
        }),
      };
    }

    return {
      ok: true,
      rawDeviceCredential: ctx.rawDeviceCredential ?? "",
      deviceId: existingDevice.id,
      staffId: staff.id,
      branchId: point.branch_id,
      staffName,
      branchName,
      registeredNewDevice: false,
    };
  }

  if (staff.branch_id !== point.branch_id) {
    const eventId = await recordScanEvent(admin, {
      branchId: point.branch_id,
      qrPointId: point.id,
      staffId: staff.id,
      scanType: scanTypeForPoint(point),
      action: "first_scan_register_device",
      outcome: "blocked",
      reasonCode: "wrong_branch",
      message: "Authenticated staff belongs to a different branch.",
      requestId: ctx.requestId,
      userAgent: ctx.userAgent,
      ipAddress: ctx.ipAddress,
    });

    await recordException(admin, {
      branchId: point.branch_id,
      staffId: staff.id,
      scanEventId: eventId,
      exceptionType: "wrong_branch",
      severity: "critical",
      message: `${staffName} attempted first-scan login at another branch.`,
    });

    return {
      ok: false,
      result: blocked("Wrong branch", "This account is connected to a different branch. Please use the correct branch QR or contact the front desk.", {
        reasonCode: "wrong_branch",
        severity: "critical",
        securityNote: "No phone was connected from this sign-in.",
        scanEventId: eventId ?? undefined,
      }),
    };
  }

  const rawDeviceCredential = createDeviceCredential();
  const deviceHints = inferDeviceClientHints(ctx.userAgent);
  const nowIso = new Date().toISOString();
  const inserted = await admin
    .from("staff_devices")
    .insert({
      staff_id: staff.id,
      branch_id: point.branch_id,
      device_fingerprint_hash: hashSecret(rawDeviceCredential),
      device_label: deviceHints.label,
      status: "active",
      registration_source: "first_scan_activation",
      browser_name: deviceHints.browserName,
      browser_version: deviceHints.browserVersion,
      platform_name: deviceHints.platformName,
      last_seen_at: nowIso,
      metadata: {
        source: "first_scan_login",
        qr_point_id: point.id,
        auth_user_id: authUserId,
        user_agent: ctx.userAgent ?? null,
      },
    })
    .select("id")
    .single();

  if (inserted.error || !inserted.data) {
    const eventId = await recordScanEvent(admin, {
      branchId: point.branch_id,
      qrPointId: point.id,
      staffId: staff.id,
      scanType: scanTypeForPoint(point),
      action: "first_scan_register_device",
      outcome: "error",
      reasonCode: "device_registration_failed",
      message: inserted.error?.message ?? "Device insert failed.",
      requestId: ctx.requestId,
      userAgent: ctx.userAgent,
      ipAddress: ctx.ipAddress,
    });

    return {
      ok: false,
      result: blocked("Phone connection failed", "This phone could not be connected. Please try again or contact the front desk.", {
        outcome: "error",
        reasonCode: "device_registration_failed",
        severity: "critical",
        securityNote: "No attendance change was recorded from this sign-in.",
        scanEventId: eventId ?? undefined,
      }),
    };
  }

  const eventId = await recordScanEvent(admin, {
    branchId: point.branch_id,
    staffId: staff.id,
    deviceId: inserted.data.id as string,
    scanType: "activation",
    action: "first_scan_device_registered",
    outcome: "success",
    reasonCode: "device_registered",
    message: "Device registered after staff sign-in.",
    requestId: ctx.requestId,
    userAgent: ctx.userAgent,
    ipAddress: ctx.ipAddress,
    metadata: {
      source: "first_scan_login",
      qr_point_id: point.id,
      registration_source: "first_scan_activation",
    },
  });

  return {
    ok: true,
    rawDeviceCredential,
    deviceId: inserted.data.id as string,
    staffId: staff.id,
    branchId: point.branch_id,
    staffName,
    branchName,
    scanEventId: eventId ?? undefined,
    registeredNewDevice: true,
  };
}

async function findRecentDuplicate(admin: AttendanceDb, params: {
  pointId: string;
  deviceId: string;
  seconds: number;
}): Promise<boolean> {
  const cutoff = new Date(Date.now() - params.seconds * 1000).toISOString();
  const { data } = await admin
    .from("qr_scan_events")
    .select("id")
    .eq("qr_point_id", params.pointId)
    .eq("device_id", params.deviceId)
    .eq("outcome", "success")
    .gte("created_at", cutoff)
    .limit(1);

  return (data?.length ?? 0) > 0;
}

async function getActiveCheckin(admin: AttendanceDb, params: {
  staffId: string;
  branchId: string;
}): Promise<CheckinRow | null> {
  const { data } = await admin
    .from("staff_shift_checkins")
    .select("id, staff_id, branch_id, shift_date, shift_type, checked_in_at, checked_out_at, status, scheduled_start_at, scheduled_end_at")
    .eq("staff_id", params.staffId)
    .eq("branch_id", params.branchId)
    .eq("status", "checked_in")
    .is("checked_out_at", null)
    .order("checked_in_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data as CheckinRow | null) ?? null;
}

async function hasActiveService(admin: AttendanceDb, params: {
  staffId: string;
  branchId: string;
}): Promise<BookingRow | null> {
  const { data } = await admin
    .from("bookings")
    .select("id, branch_id, staff_id, booking_date, start_time, end_time, status, booking_progress_status, resource_id, session_started_at, session_due_at, session_completed_at, session_duration_minutes_snapshot, customers(full_name), services(name, duration_minutes), branch_resources(name)")
    .eq("staff_id", params.staffId)
    .eq("branch_id", params.branchId)
    .eq("status", "in_progress")
    .eq("booking_progress_status", "session_started")
    .is("session_completed_at", null)
    .order("session_started_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  return (data as BookingRow | null) ?? null;
}

async function selectScheduleWindow(admin: AttendanceDb, params: {
  branchId: string;
  staffId: string;
  staffType: string | null;
  date: string;
  branchTime: string;
}): Promise<ScheduleSelection> {
  const schedules = await getResolvedStaffSchedulesForDate({
    supabase: admin as never,
    branchId: params.branchId,
    date: params.date,
    staff: [{ id: params.staffId, staff_type: params.staffType }],
  });

  const schedule = schedules.get(params.staffId);
  const windows = schedule?.windows ?? [];
  const selected =
    windows.find((window) => isTimeWithinScheduleWindows(params.branchTime, [window])) ??
    windows[0] ??
    null;

  if (!selected) {
    return {
      shiftDate: params.date,
      shiftType: "single",
      scheduledStartAt: null,
      scheduledEndAt: null,
      isUnscheduled: true,
    };
  }

  return scheduleSelectionFromWindow(params.date, selected);
}

function scheduleSelectionFromWindow(date: string, window: ResolvedStaffScheduleWindow): ScheduleSelection {
  const overnight = isOvernightWindow(window.startTime, window.endTime);
  return {
    shiftDate: date,
    shiftType: window.shiftType,
    scheduledStartAt: branchDateTimeToIso({ date, time: window.startTime }),
    scheduledEndAt: branchDateTimeToIso({ date, time: window.endTime, addDay: overnight }),
    isUnscheduled: false,
  };
}

function buildCountdown(booking: BookingRow, fallbackResourceName?: string | null): NonNullable<PublicScanResult["countdown"]> | undefined {
  if (!booking.session_started_at) return undefined;
  const service = first(booking.services);
  const durationMinutes = booking.session_duration_minutes_snapshot ?? service?.duration_minutes ?? 60;
  const dueAt =
    booking.session_due_at ??
    new Date(new Date(booking.session_started_at).getTime() + durationMinutes * 60000).toISOString();

  return {
    bookingId: booking.id,
    customerName: first(booking.customers)?.full_name ?? "Customer",
    serviceName: service?.name ?? "Service",
    resourceName: first(booking.branch_resources)?.name ?? fallbackResourceName ?? null,
    startedAt: booking.session_started_at,
    dueAt,
    durationMinutes,
  };
}

async function processAttendanceScan(admin: AttendanceDb, point: QrPointRow, device: StaffDeviceRow, ctx: ScanRequestContext): Promise<PublicScanResult> {
  const settings = await getAttendanceSettings(point.branch_id);
  const staff = first(device.staff);
  const staffName = staff?.full_name ?? "Staff member";
  const branchName = first(point.branches)?.name ?? "Branch";

  if (await findRecentDuplicate(admin, {
    pointId: point.id,
    deviceId: device.id,
    seconds: settings.duplicate_scan_window_seconds,
  })) {
    const eventId = await recordScanEvent(admin, {
      branchId: point.branch_id,
      qrPointId: point.id,
      staffId: device.staff_id,
      deviceId: device.id,
      scanType: "attendance",
      action: "duplicate_scan",
      outcome: "noop",
      reasonCode: "duplicate_scan",
      message: "Duplicate scan ignored.",
      requestId: ctx.requestId,
      userAgent: ctx.userAgent,
      ipAddress: ctx.ipAddress,
    });
    return success("Already recorded", "A recent attendance scan was already accepted.", {
      outcome: "noop",
      reasonCode: "duplicate_scan",
      securityNote: "No new attendance record was created.",
      scanEventId: eventId ?? undefined,
    });
  }

  const activeCheckin = await getActiveCheckin(admin, {
    staffId: device.staff_id,
    branchId: point.branch_id,
  });

  if (activeCheckin) {
    if (settings.active_service_blocks_clock_out) {
      const activeService = await hasActiveService(admin, {
        staffId: device.staff_id,
        branchId: point.branch_id,
      });
      if (activeService) {
        const eventId = await recordScanEvent(admin, {
          branchId: point.branch_id,
          qrPointId: point.id,
          staffId: device.staff_id,
          deviceId: device.id,
          checkinId: activeCheckin.id,
          bookingId: activeService.id,
          scanType: "attendance",
          action: "clock_out",
          outcome: "blocked",
          reasonCode: "active_service",
          message: "Clock-out blocked because a service session is still active.",
          requestId: ctx.requestId,
          userAgent: ctx.userAgent,
          ipAddress: ctx.ipAddress,
        });
        await recordException(admin, {
          branchId: point.branch_id,
          staffId: device.staff_id,
          checkinId: activeCheckin.id,
          scanEventId: eventId,
          exceptionType: "active_service",
          severity: "critical",
          message: `${staffName} attempted to clock out with an active service session.`,
          metadata: { bookingId: activeService.id },
        });
        return blocked("Service still active", "Complete the active service session before clocking out.", {
          reasonCode: "active_service",
          securityNote: "Finish the active service before scanning attendance again.",
          countdown: buildCountdown(activeService),
          scanEventId: eventId ?? undefined,
        });
      }
    }

    const nowIso = new Date().toISOString();
    const metrics = computeAttendanceMetrics({
      checkedInAt: activeCheckin.checked_in_at,
      checkedOutAt: nowIso,
      scheduledStartAt: activeCheckin.scheduled_start_at ?? null,
      scheduledEndAt: activeCheckin.scheduled_end_at ?? null,
      lateGraceMinutes: settings.clock_in_late_grace_minutes,
      earlyLeaveGraceMinutes: settings.clock_out_early_grace_minutes,
    });

    const { error: updateError } = await admin
      .from("staff_shift_checkins")
      .update({
        checked_out_at: nowIso,
        status: "checked_out",
        clock_out_method: "qr",
        worked_minutes: metrics.workedMinutes,
        late_minutes: metrics.lateMinutes,
        early_leave_minutes: metrics.earlyLeaveMinutes,
        overtime_minutes: metrics.overtimeMinutes,
        attendance_status: metrics.attendanceStatus,
        exception_state: metrics.exceptionState,
      })
      .eq("id", activeCheckin.id)
      .eq("status", "checked_in");

    if (updateError) {
      const eventId = await recordScanEvent(admin, {
        branchId: point.branch_id,
        qrPointId: point.id,
        staffId: device.staff_id,
        deviceId: device.id,
        checkinId: activeCheckin.id,
        scanType: "attendance",
        action: "clock_out",
        outcome: "error",
        reasonCode: "db_error",
        message: updateError.message,
        requestId: ctx.requestId,
        userAgent: ctx.userAgent,
        ipAddress: ctx.ipAddress,
      });
      return blocked("Clock-out failed", "The attendance record could not be updated.", {
        outcome: "error",
        reasonCode: "db_error",
        securityNote: "No clock-out was recorded from this attempt.",
        scanEventId: eventId ?? undefined,
      });
    }

    const eventId = await recordScanEvent(admin, {
      branchId: point.branch_id,
      qrPointId: point.id,
      staffId: device.staff_id,
      deviceId: device.id,
      checkinId: activeCheckin.id,
      scanType: "attendance",
      action: "clock_out",
      outcome: "success",
      message: "Clock-out recorded.",
      requestId: ctx.requestId,
      userAgent: ctx.userAgent,
      ipAddress: ctx.ipAddress,
      metadata: metrics,
    });

    if (eventId) {
      await admin
        .from("staff_shift_checkins")
        .update({ clock_out_scan_event_id: eventId })
        .eq("id", activeCheckin.id);
    }
    await markDeviceScanSuccess(admin, {
      deviceId: device.id,
      scanType: "attendance",
      scannedAt: nowIso,
    });

    if (metrics.earlyLeaveMinutes > 0 || metrics.overtimeMinutes > 0) {
      await recordException(admin, {
        branchId: point.branch_id,
        staffId: device.staff_id,
        checkinId: activeCheckin.id,
        scanEventId: eventId,
        exceptionType: metrics.earlyLeaveMinutes > 0 ? "early_leave" : "overtime",
        message:
          metrics.earlyLeaveMinutes > 0
            ? `${staffName} clocked out ${formatMinutesCompact(metrics.earlyLeaveMinutes)} early.`
            : `${staffName} worked ${formatMinutesCompact(metrics.overtimeMinutes)} overtime.`,
        metadata: metrics,
      });
    }

    return success("Clocked out", `${staffName} is clocked out. Worked ${formatMinutesCompact(metrics.workedMinutes)}.`, {
      reasonCode: "clock_out",
      securityNote: "This device is recognized and ready for future scans.",
      scanEventId: eventId ?? undefined,
      attendance: {
        action: "clock_out",
        staffName,
        branchName,
        shiftLabel: activeCheckin.shift_type,
        occurredAt: nowIso,
        sessionStartedAt: activeCheckin.checked_in_at,
        workedMinutes: metrics.workedMinutes,
      },
    });
  }

  const branchNow = getBranchNow();
  const schedule = await selectScheduleWindow(admin, {
    branchId: point.branch_id,
    staffId: device.staff_id,
    staffType: staff?.staff_type ?? null,
    date: branchNow.date,
    branchTime: branchNow.time,
  });

  const existingForShift = await admin
    .from("staff_shift_checkins")
    .select("id, status")
    .eq("staff_id", device.staff_id)
    .eq("branch_id", point.branch_id)
    .eq("shift_date", schedule.shiftDate)
    .eq("shift_type", schedule.shiftType)
    .neq("status", "voided")
    .maybeSingle();

  if (existingForShift.data?.status === "checked_out") {
    const eventId = await recordScanEvent(admin, {
      branchId: point.branch_id,
      qrPointId: point.id,
      staffId: device.staff_id,
      deviceId: device.id,
      scanType: "attendance",
      action: "clock_in",
      outcome: "blocked",
      reasonCode: "already_checked_out",
      message: "Staff already checked out for this shift.",
      requestId: ctx.requestId,
      userAgent: ctx.userAgent,
      ipAddress: ctx.ipAddress,
    });
    return blocked("Already checked out", "A manager must adjust the attendance record before another check-in.", {
      reasonCode: "already_checked_out",
      scanEventId: eventId ?? undefined,
    });
  }

  const nowIso = new Date().toISOString();
  const metrics = computeAttendanceMetrics({
    checkedInAt: nowIso,
    checkedOutAt: nowIso,
    scheduledStartAt: schedule.scheduledStartAt,
    scheduledEndAt: schedule.scheduledEndAt,
    lateGraceMinutes: settings.clock_in_late_grace_minutes,
    earlyLeaveGraceMinutes: settings.clock_out_early_grace_minutes,
  });

  const inserted = await admin
    .from("staff_shift_checkins")
    .insert({
      staff_id: device.staff_id,
      branch_id: point.branch_id,
      shift_date: schedule.shiftDate,
      shift_type: schedule.shiftType,
      checked_in_at: nowIso,
      status: "checked_in",
      source_qr_point_id: point.id,
      clock_in_method: "qr",
      scheduled_start_at: schedule.scheduledStartAt,
      scheduled_end_at: schedule.scheduledEndAt,
      late_minutes: metrics.lateMinutes,
      attendance_status: schedule.isUnscheduled ? "late" : metrics.attendanceStatus,
      exception_state: schedule.isUnscheduled || metrics.lateMinutes > 0 ? "open" : "none",
    })
    .select("id")
    .maybeSingle();

  if (inserted.error || !inserted.data) {
    const eventId = await recordScanEvent(admin, {
      branchId: point.branch_id,
      qrPointId: point.id,
      staffId: device.staff_id,
      deviceId: device.id,
      scanType: "attendance",
      action: "clock_in",
      outcome: "error",
      reasonCode: "db_error",
      message: inserted.error?.message ?? "Insert failed.",
      requestId: ctx.requestId,
      userAgent: ctx.userAgent,
      ipAddress: ctx.ipAddress,
    });
    return blocked("Clock-in failed", "The attendance record could not be created.", {
      outcome: "error",
      reasonCode: "db_error",
      securityNote: "No clock-in was recorded from this attempt.",
      scanEventId: eventId ?? undefined,
    });
  }

  const eventId = await recordScanEvent(admin, {
    branchId: point.branch_id,
    qrPointId: point.id,
    staffId: device.staff_id,
    deviceId: device.id,
    checkinId: inserted.data.id,
    scanType: "attendance",
    action: "clock_in",
    outcome: "success",
    message: "Clock-in recorded.",
    requestId: ctx.requestId,
    userAgent: ctx.userAgent,
    ipAddress: ctx.ipAddress,
    metadata: { schedule, lateMinutes: metrics.lateMinutes },
  });

  if (eventId) {
    await admin
      .from("staff_shift_checkins")
      .update({ clock_in_scan_event_id: eventId })
      .eq("id", inserted.data.id);
  }
  await markDeviceScanSuccess(admin, {
    deviceId: device.id,
    scanType: "attendance",
    scannedAt: nowIso,
  });

  if (schedule.isUnscheduled || metrics.lateMinutes > 0) {
    await recordException(admin, {
      branchId: point.branch_id,
      staffId: device.staff_id,
      checkinId: inserted.data.id,
      scanEventId: eventId,
      exceptionType: schedule.isUnscheduled ? "unscheduled" : "late",
      message: schedule.isUnscheduled
        ? `${staffName} clocked in without a resolved schedule.`
        : `${staffName} clocked in ${formatMinutesCompact(metrics.lateMinutes)} late.`,
      metadata: { schedule, lateMinutes: metrics.lateMinutes },
    });
  }

  return success("Clocked in", `${staffName} is clocked in for ${schedule.shiftType}.`, {
    reasonCode: "clock_in",
    securityNote: "This device is recognized and ready for future scans.",
    scanEventId: eventId ?? undefined,
    attendance: {
      action: "clock_in",
      staffName,
      branchName,
      shiftLabel: schedule.shiftType,
      occurredAt: nowIso,
      sessionStartedAt: nowIso,
    },
  });
}

function timeDistanceFromNow(startTime: string, nowMinutes: number): number {
  const [hh = "0", mm = "0"] = startTime.slice(0, 5).split(":");
  return Math.abs(Number(hh) * 60 + Number(mm) - nowMinutes);
}

async function findEligibleBooking(admin: AttendanceDb, params: {
  branchId: string;
  staffId: string;
  date: string;
  nowMinutes: number;
}): Promise<BookingRow | null> {
  const { data } = await admin
    .from("bookings")
    .select("id, branch_id, staff_id, booking_date, start_time, end_time, status, booking_progress_status, resource_id, session_started_at, session_due_at, session_completed_at, session_duration_minutes_snapshot, customers(full_name), services(name, duration_minutes), branch_resources(name)")
    .eq("branch_id", params.branchId)
    .eq("staff_id", params.staffId)
    .eq("booking_date", params.date)
    .eq("delivery_type", "in_spa")
    .not("status", "in", '("cancelled","completed","no_show")')
    .in("booking_progress_status", ["not_started", "checked_in", "session_started"])
    .order("start_time");

  const candidates = ((data as BookingRow[] | null) ?? []).filter((booking) => {
    const [startHour = "0", startMinute = "0"] = booking.start_time.slice(0, 5).split(":");
    const [endHour = "0", endMinute = "0"] = booking.end_time.slice(0, 5).split(":");
    const start = Number(startHour) * 60 + Number(startMinute);
    const end = Number(endHour) * 60 + Number(endMinute);
    return start <= params.nowMinutes + 90 && end >= params.nowMinutes - 45;
  });

  return candidates.sort((a, b) => timeDistanceFromNow(a.start_time, params.nowMinutes) - timeDistanceFromNow(b.start_time, params.nowMinutes))[0] ?? null;
}

async function processRoomScan(admin: AttendanceDb, point: QrPointRow, device: StaffDeviceRow, ctx: ScanRequestContext): Promise<PublicScanResult> {
  const settings = await getAttendanceSettings(point.branch_id);
  const staff = first(device.staff);
  const staffName = staff?.full_name ?? "Staff member";
  const resource = first(point.branch_resources);
  const resourceName = resource?.name ?? point.label;

  if (!point.resource_id) {
    const eventId = await recordScanEvent(admin, {
      branchId: point.branch_id,
      qrPointId: point.id,
      staffId: device.staff_id,
      deviceId: device.id,
      scanType: "room",
      action: "start_session",
      outcome: "blocked",
      reasonCode: "missing_resource",
      message: "QR point is not linked to a resource.",
      requestId: ctx.requestId,
      userAgent: ctx.userAgent,
      ipAddress: ctx.ipAddress,
    });
    return blocked("Room unavailable", "This QR is not linked to an active room.", {
      reasonCode: "missing_resource",
      scanEventId: eventId ?? undefined,
    });
  }

  const activeCheckin = await getActiveCheckin(admin, {
    staffId: device.staff_id,
    branchId: point.branch_id,
  });

  if (!activeCheckin) {
    const eventId = await recordScanEvent(admin, {
      branchId: point.branch_id,
      qrPointId: point.id,
      staffId: device.staff_id,
      deviceId: device.id,
      resourceId: point.resource_id,
      scanType: "room",
      action: "start_session",
      outcome: "blocked",
      reasonCode: "not_clocked_in",
      message: "Staff must be clocked in before starting a room session.",
      requestId: ctx.requestId,
      userAgent: ctx.userAgent,
      ipAddress: ctx.ipAddress,
    });
    return blocked("Clock in first", "Clock in at the attendance QR before starting a service session.", {
      reasonCode: "not_clocked_in",
      scanEventId: eventId ?? undefined,
    });
  }

  const activeService = await hasActiveService(admin, {
    staffId: device.staff_id,
    branchId: point.branch_id,
  });

  if (activeService) {
    const countdown = buildCountdown(activeService, resourceName);
    const sameResource = activeService.resource_id === point.resource_id;
    const eventId = await recordScanEvent(admin, {
      branchId: point.branch_id,
      qrPointId: point.id,
      staffId: device.staff_id,
      deviceId: device.id,
      bookingId: activeService.id,
      resourceId: point.resource_id,
      scanType: "room",
      action: sameResource ? "reopen_session" : "start_session",
      outcome: sameResource ? "success" : "blocked",
      reasonCode: sameResource ? null : "active_service",
      message: sameResource ? "Active session reopened." : "A different service session is already active.",
      requestId: ctx.requestId,
      userAgent: ctx.userAgent,
      ipAddress: ctx.ipAddress,
    });

    if (sameResource) {
      await markDeviceScanSuccess(admin, {
        deviceId: device.id,
        scanType: "service",
      });
      return success("Session active", "The service countdown is already running.", {
        reasonCode: "session_active",
        scanEventId: eventId ?? undefined,
        countdown,
      });
    }

    await recordException(admin, {
      branchId: point.branch_id,
      staffId: device.staff_id,
      scanEventId: eventId,
      exceptionType: "active_service",
      severity: "critical",
      message: `${staffName} scanned ${resourceName} while another service was active.`,
      metadata: { activeBookingId: activeService.id },
    });
    return blocked("Session already active", "Complete the current service before starting another room.", {
      reasonCode: "active_service",
      securityNote: "Finish the active service before scanning a different room.",
      countdown,
      scanEventId: eventId ?? undefined,
    });
  }

  if (await findRecentDuplicate(admin, {
    pointId: point.id,
    deviceId: device.id,
    seconds: settings.duplicate_scan_window_seconds,
  })) {
    const eventId = await recordScanEvent(admin, {
      branchId: point.branch_id,
      qrPointId: point.id,
      staffId: device.staff_id,
      deviceId: device.id,
      resourceId: point.resource_id,
      scanType: "room",
      action: "duplicate_scan",
      outcome: "noop",
      reasonCode: "duplicate_scan",
      message: "Duplicate room scan ignored.",
      requestId: ctx.requestId,
      userAgent: ctx.userAgent,
      ipAddress: ctx.ipAddress,
    });
    return success("Already recorded", "A recent room scan was already accepted.", {
      outcome: "noop",
      reasonCode: "duplicate_scan",
      securityNote: "No new service session was created.",
      scanEventId: eventId ?? undefined,
    });
  }

  const occupied = await admin
    .from("bookings")
    .select("id, staff_id")
    .eq("branch_id", point.branch_id)
    .eq("resource_id", point.resource_id)
    .eq("status", "in_progress")
    .eq("booking_progress_status", "session_started")
    .is("session_completed_at", null)
    .limit(1)
    .maybeSingle();

  if (occupied.data) {
    const eventId = await recordScanEvent(admin, {
      branchId: point.branch_id,
      qrPointId: point.id,
      staffId: device.staff_id,
      deviceId: device.id,
      bookingId: occupied.data.id,
      resourceId: point.resource_id,
      scanType: "room",
      action: "start_session",
      outcome: "blocked",
      reasonCode: "resource_conflict",
      message: "Room is already occupied by an active session.",
      requestId: ctx.requestId,
      userAgent: ctx.userAgent,
      ipAddress: ctx.ipAddress,
    });
    await recordException(admin, {
      branchId: point.branch_id,
      staffId: device.staff_id,
      scanEventId: eventId,
      exceptionType: "resource_conflict",
      severity: "critical",
      message: `${staffName} scanned occupied room ${resourceName}.`,
      metadata: { occupiedBookingId: occupied.data.id },
    });
    return blocked("Room in use", `${resourceName} already has an active service session.`, {
      reasonCode: "resource_conflict",
      scanEventId: eventId ?? undefined,
    });
  }

  const branchNow = getBranchNow();
  const booking = await findEligibleBooking(admin, {
    branchId: point.branch_id,
    staffId: device.staff_id,
    date: branchNow.date,
    nowMinutes: branchNow.minutesIntoDay,
  });

  if (!booking) {
    const eventId = await recordScanEvent(admin, {
      branchId: point.branch_id,
      qrPointId: point.id,
      staffId: device.staff_id,
      deviceId: device.id,
      resourceId: point.resource_id,
      scanType: "room",
      action: "start_session",
      outcome: "blocked",
      reasonCode: "no_eligible_booking",
      message: "No eligible in-spa booking found for this staff member.",
      requestId: ctx.requestId,
      userAgent: ctx.userAgent,
      ipAddress: ctx.ipAddress,
    });
    return blocked("No booking found", "No current in-spa booking is ready for this room scan.", {
      reasonCode: "no_eligible_booking",
      scanEventId: eventId ?? undefined,
    });
  }

  if (booking.resource_id && booking.resource_id !== point.resource_id) {
    const eventId = await recordScanEvent(admin, {
      branchId: point.branch_id,
      qrPointId: point.id,
      staffId: device.staff_id,
      deviceId: device.id,
      bookingId: booking.id,
      resourceId: point.resource_id,
      scanType: "room",
      action: "start_session",
      outcome: "blocked",
      reasonCode: "resource_conflict",
      message: "Booking already has a different room assigned.",
      requestId: ctx.requestId,
      userAgent: ctx.userAgent,
      ipAddress: ctx.ipAddress,
    });
    await recordException(admin, {
      branchId: point.branch_id,
      staffId: device.staff_id,
      scanEventId: eventId,
      exceptionType: "resource_conflict",
      message: `${staffName} scanned ${resourceName}, but the booking has another room assigned.`,
      metadata: { bookingId: booking.id, assignedResourceId: booking.resource_id },
    });
    return blocked("Different room assigned", "This booking is already assigned to another room.", {
      reasonCode: "resource_conflict",
      scanEventId: eventId ?? undefined,
    });
  }

  const service = first(booking.services);
  const durationMinutes = service?.duration_minutes ?? 60;
  const startedAt = new Date().toISOString();
  const dueAt = new Date(Date.now() + durationMinutes * 60000).toISOString();
  const update = await admin
    .from("bookings")
    .update({
      resource_id: booking.resource_id ?? point.resource_id,
      status: "in_progress",
      booking_progress_status: "session_started",
      session_started_at: startedAt,
      session_duration_minutes_snapshot: durationMinutes,
      session_due_at: dueAt,
      session_started_from_resource_id: point.resource_id,
      session_completion_source: null,
      updated_at: startedAt,
    })
    .eq("id", booking.id)
    .eq("branch_id", point.branch_id)
    .in("booking_progress_status", ["not_started", "checked_in"])
    .select("id, branch_id, staff_id, booking_date, start_time, end_time, status, booking_progress_status, resource_id, session_started_at, session_due_at, session_completed_at, session_duration_minutes_snapshot, customers(full_name), services(name, duration_minutes), branch_resources(name)")
    .maybeSingle();

  if (update.error || !update.data) {
    const eventId = await recordScanEvent(admin, {
      branchId: point.branch_id,
      qrPointId: point.id,
      staffId: device.staff_id,
      deviceId: device.id,
      bookingId: booking.id,
      resourceId: point.resource_id,
      scanType: "room",
      action: "start_session",
      outcome: "error",
      reasonCode: "db_error",
      message: update.error?.message ?? "Booking could not be updated.",
      requestId: ctx.requestId,
      userAgent: ctx.userAgent,
      ipAddress: ctx.ipAddress,
    });
    return blocked("Session start failed", "The booking could not be moved into session.", {
      outcome: "error",
      reasonCode: "db_error",
      scanEventId: eventId ?? undefined,
    });
  }

  const updatedBooking = update.data as unknown as BookingRow;
  const eventId = await recordScanEvent(admin, {
    branchId: point.branch_id,
    qrPointId: point.id,
    staffId: device.staff_id,
    deviceId: device.id,
    bookingId: booking.id,
    resourceId: point.resource_id,
    scanType: "room",
    action: "start_session",
    outcome: "success",
    message: "Service session started from room QR.",
    requestId: ctx.requestId,
    userAgent: ctx.userAgent,
    ipAddress: ctx.ipAddress,
    metadata: { durationMinutes, dueAt },
  });

  if (eventId) {
    await admin
      .from("bookings")
      .update({ session_start_scan_event_id: eventId })
      .eq("id", booking.id);
  }
  await markDeviceScanSuccess(admin, {
    deviceId: device.id,
    scanType: "service",
    scannedAt: startedAt,
  });

  return success("Session started", `${resourceName} session started for ${durationMinutes} minutes.`, {
    reasonCode: "session_started",
    scanEventId: eventId ?? undefined,
    countdown: buildCountdown(updatedBooking, resourceName),
  });
}

export async function processQrScan(publicCode: string, ctx: ScanRequestContext): Promise<PublicScanResult> {
  const admin = asAttendanceDb(createAdminClient());
  const point = await loadQrPoint(admin, publicCode);

  if (!point || !point.is_active) {
    const eventId = await recordScanEvent(admin, {
      scanType: "unknown",
      action: "scan",
      outcome: "blocked",
      reasonCode: "invalid_qr",
      message: "Unknown or inactive QR code.",
      requestId: ctx.requestId,
      userAgent: ctx.userAgent,
      ipAddress: ctx.ipAddress,
      metadata: { publicCode: maskId(publicCode) },
    });
    return blocked("QR not recognized", "This QR code is not active in CradleHub.", {
      reasonCode: "invalid_qr",
      securityNote: "No attendance change was recorded from this scan.",
      scanEventId: eventId ?? undefined,
    });
  }

  const device = await resolveDevice(admin, ctx.rawDeviceCredential);
  if (!device) {
    const eventId = await recordScanEvent(admin, {
      branchId: point.branch_id,
      qrPointId: point.id,
      scanType: point.point_type === "attendance" ? "attendance" : "room",
      action: "scan",
      outcome: "blocked",
      reasonCode: "unknown_device",
      message: "No registered device cookie was found.",
      requestId: ctx.requestId,
      userAgent: ctx.userAgent,
      ipAddress: ctx.ipAddress,
    });
    await recordException(admin, {
      branchId: point.branch_id,
      scanEventId: eventId,
      exceptionType: "unknown_device",
      message: `An unregistered device scanned ${point.label}.`,
    });
    return blocked("Device not registered", "Ask the front desk to activate this device before scanning.", {
      reasonCode: "unknown_device",
      securityNote: "This phone is not connected to a staff device record yet.",
      scanEventId: eventId ?? undefined,
    });
  }

  if (device.status !== "active" || first(device.staff)?.is_active === false) {
    const eventId = await recordScanEvent(admin, {
      branchId: point.branch_id,
      qrPointId: point.id,
      staffId: device.staff_id,
      deviceId: device.id,
      scanType: point.point_type === "attendance" ? "attendance" : "room",
      action: "scan",
      outcome: "blocked",
      reasonCode: "revoked_device",
      message: "The registered device is revoked or staff is inactive.",
      requestId: ctx.requestId,
      userAgent: ctx.userAgent,
      ipAddress: ctx.ipAddress,
    });
    await recordException(admin, {
      branchId: point.branch_id,
      staffId: device.staff_id,
      scanEventId: eventId,
      exceptionType: "revoked_device",
      severity: "critical",
      message: `A revoked or inactive device scanned ${point.label}.`,
    });
    return blocked("Device blocked", "This device is no longer active. Ask the front desk to re-activate it.", {
      reasonCode: "revoked_device",
      severity: "critical",
      securityNote: "This phone cannot be used for attendance until access is restored.",
      scanEventId: eventId ?? undefined,
    });
  }

  if (device.branch_id !== point.branch_id) {
    const eventId = await recordScanEvent(admin, {
      branchId: point.branch_id,
      qrPointId: point.id,
      staffId: device.staff_id,
      deviceId: device.id,
      scanType: point.point_type === "attendance" ? "attendance" : "room",
      action: "scan",
      outcome: "blocked",
      reasonCode: "wrong_branch",
      message: "Device belongs to a different branch.",
      requestId: ctx.requestId,
      userAgent: ctx.userAgent,
      ipAddress: ctx.ipAddress,
    });
    await recordException(admin, {
      branchId: point.branch_id,
      staffId: device.staff_id,
      scanEventId: eventId,
      exceptionType: "wrong_branch",
      severity: "critical",
      message: `${first(device.staff)?.full_name ?? "Staff member"} scanned a QR for another branch.`,
    });
    return blocked("Wrong branch", "This device is registered to a different branch.", {
      reasonCode: "wrong_branch",
      severity: "critical",
      securityNote: "This phone is trusted, but not for this branch QR.",
      scanEventId: eventId ?? undefined,
    });
  }

  await admin
    .from("staff_devices")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", device.id);

  if (point.point_type === "attendance") {
    return processAttendanceScan(admin, point, device, ctx);
  }

  return processRoomScan(admin, point, device, ctx);
}

export async function activateDeviceWithToken(token: string, ctx: ScanRequestContext): Promise<ActivationResult> {
  const admin = asAttendanceDb(createAdminClient());
  const tokenHash = hashSecret(token);
  const { data: activation } = await admin
    .from("device_activation_tokens")
    .select("id, staff_id, branch_id, expires_at, used_at, staff(full_name, is_active)")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  const activationRow = activation as {
    id: string;
    staff_id: string;
    branch_id: string;
    expires_at: string;
    used_at: string | null;
    staff?: { full_name: string | null; is_active: boolean } | Array<{ full_name: string | null; is_active: boolean }> | null;
  } | null;

  if (!activationRow) {
    const eventId = await recordScanEvent(admin, {
      scanType: "activation",
      action: "activate_device",
      outcome: "blocked",
      reasonCode: "invalid_token",
      message: "Device activation token was not found.",
      requestId: ctx.requestId,
      userAgent: ctx.userAgent,
      ipAddress: ctx.ipAddress,
      metadata: { token: maskId(token) },
    });
    return blocked("Activation expired", "Ask the front desk for a new device activation link.", {
      reasonCode: "invalid_token",
      scanEventId: eventId ?? undefined,
    });
  }

  const staff = first(activationRow.staff);
  if (activationRow.used_at || new Date(activationRow.expires_at).getTime() < Date.now() || staff?.is_active === false) {
    const eventId = await recordScanEvent(admin, {
      branchId: activationRow.branch_id,
      staffId: activationRow.staff_id,
      scanType: "activation",
      action: "activate_device",
      outcome: "blocked",
      reasonCode: activationRow.used_at ? "token_used" : "token_expired",
      message: "Device activation token is no longer valid.",
      requestId: ctx.requestId,
      userAgent: ctx.userAgent,
      ipAddress: ctx.ipAddress,
    });
    return blocked("Activation expired", "Ask the front desk for a new device activation link.", {
      reasonCode: activationRow.used_at ? "token_used" : "token_expired",
      scanEventId: eventId ?? undefined,
    });
  }

  const rawDeviceCredential = createDeviceCredential();
  const deviceHints = inferDeviceClientHints(ctx.userAgent);
  const inserted = await admin
    .from("staff_devices")
    .insert({
      staff_id: activationRow.staff_id,
      branch_id: activationRow.branch_id,
      device_fingerprint_hash: hashSecret(rawDeviceCredential),
      device_label: deviceHints.label,
      status: "active",
      registration_source: "first_scan_activation",
      browser_name: deviceHints.browserName,
      browser_version: deviceHints.browserVersion,
      platform_name: deviceHints.platformName,
      last_seen_at: new Date().toISOString(),
      metadata: {
        activated_from: "first_scan_activation",
        user_agent: ctx.userAgent ?? null,
      },
    })
    .select("id")
    .single();

  if (inserted.error || !inserted.data) {
    const eventId = await recordScanEvent(admin, {
      branchId: activationRow.branch_id,
      staffId: activationRow.staff_id,
      scanType: "activation",
      action: "activate_device",
      outcome: "error",
      reasonCode: "db_error",
      message: inserted.error?.message ?? "Device insert failed.",
      requestId: ctx.requestId,
      userAgent: ctx.userAgent,
      ipAddress: ctx.ipAddress,
    });
    return blocked("Activation failed", "The device could not be registered.", {
      outcome: "error",
      reasonCode: "db_error",
      scanEventId: eventId ?? undefined,
    });
  }

  await admin
    .from("device_activation_tokens")
    .update({
      used_at: new Date().toISOString(),
      used_by_device_id: inserted.data.id,
    })
    .eq("id", activationRow.id)
    .is("used_at", null);

  const eventId = await recordScanEvent(admin, {
    branchId: activationRow.branch_id,
    staffId: activationRow.staff_id,
    deviceId: inserted.data.id,
    scanType: "activation",
    action: "activate_device",
    outcome: "success",
    message: "Device activated.",
    requestId: ctx.requestId,
    userAgent: ctx.userAgent,
    ipAddress: ctx.ipAddress,
  });

  return {
    ...success("Device activated", `${staff?.full_name ?? "Staff member"} can now use this device for attendance and room scans.`, {
      reasonCode: "device_activated",
      securityNote: "This phone is now trusted for this staff member.",
      scanEventId: eventId ?? undefined,
    }),
    rawDeviceCredential,
  };
}
