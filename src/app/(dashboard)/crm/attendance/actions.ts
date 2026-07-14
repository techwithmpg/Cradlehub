"use server";

import { headers } from "next/headers";
import {
  completeDueServiceSessionsNow,
  createDeviceActivationLink,
  deactivateQrPoint,
  ensureBranchAttendanceQrPoint,
  ensureRoomQrPoints,
  getAttendanceActionContext,
  resolveAttendanceException,
  revalidateAttendanceSurfaces,
} from "@/lib/attendance/queries";
import {
  generateDeviceRecoveryLink,
  renameAttendanceDevice,
  revokeAttendanceDeviceWithReason,
  revokeDeviceRecoveryLink,
  type DeviceActionResult,
  type GenerateDeviceRecoveryInput,
} from "@/lib/attendance/device-recovery";
import {
  applyAttendanceCorrection,
  updateAttendanceRules,
  type ApplyAttendanceCorrectionInput,
  type UpdateAttendanceRulesInput,
} from "@/lib/attendance/attendance-correction-service";
import { buildScanUrl, renderQrSvg } from "@/lib/attendance/qr-code";
import { getRequestOrigin } from "@/lib/http/request-origin";
import type {
  AttendanceQrPoint,
  AttendanceSettings,
  AttendanceTab,
  DeviceRevocationReason,
  RecoveryLinkResult,
} from "@/lib/attendance/types";
import {
  reviewStaffDeviceRegistrationRequest,
  type StaffDeviceRegistrationRejectionReason,
  type StaffDeviceRegistrationRequest,
} from "@/lib/attendance/device-registration";

export type AttendanceActionResult =
  | { ok: false; tab?: AttendanceTab; message: string }
  | { ok: true; kind: "attendance_qr"; tab: "qr"; message: string; qrPoint: AttendanceQrPoint }
  | { ok: true; kind: "room_qrs"; tab: "qr"; message: string; createdCount: number; qrPoints: AttendanceQrPoint[] }
  | { ok: true; kind: "activation"; tab: "devices"; message: string; activationUrl: string; expiresAt: string }
  | { ok: true; kind: "device_revoked"; tab: "devices"; message: string; deviceId: string }
  | { ok: true; kind: "exception_resolved"; tab: "exceptions"; message: string; exceptionId: string }
  | { ok: true; kind: "attendance_correction"; tab: "exceptions"; message: string }
  | { ok: true; kind: "attendance_rules"; tab: "exceptions"; message: string; settings: AttendanceSettings }
  | { ok: true; kind: "sessions_completed"; tab: "sessions"; message: string; completedCount: number }
  | { ok: true; kind: "qr_deactivated"; tab: "qr"; message: string; qrPointId: string };

type AttendanceContext = NonNullable<Awaited<ReturnType<typeof getAttendanceActionContext>>>;

async function getContextOrResult(
  tab?: AttendanceTab,
  branchId?: string | null
): Promise<{ ctx: AttendanceContext } | { result: AttendanceActionResult }> {
  const ctx = await getAttendanceActionContext({ branchId });
  if (!ctx) {
    return {
      result: {
        ok: false,
        tab,
        message: "Please sign in again before changing Attendance settings.",
      },
    };
  }
  return { ctx };
}

async function getDeviceContext(branchId?: string | null): Promise<DeviceActionResult<AttendanceContext>> {
  const ctx = await getAttendanceActionContext({ branchId });
  if (!ctx) {
    return {
      success: false,
      error: "Please sign in again before changing Attendance devices.",
      code: "unauthorized",
    };
  }
  return { success: true, data: ctx };
}

async function getOrigin(): Promise<string | null> {
  const headerStore = await headers();
  return getRequestOrigin(headerStore);
}

async function hydrateQrPoint(point: AttendanceQrPoint, origin: string | null): Promise<AttendanceQrPoint> {
  const scanUrl = buildScanUrl(point.public_code, origin);
  return {
    ...point,
    scan_url: scanUrl,
    svg: await renderQrSvg(scanUrl),
  };
}

function safeError(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;
  if (error.message.includes("duplicate key")) return "A QR already exists for this point.";
  if (error.message.includes("PostgrestError")) return fallback;
  if (error.message.includes("NEXT_")) return fallback;
  return error.message || fallback;
}

export async function ensureAttendanceQrAction(): Promise<AttendanceActionResult> {
  const context = await getContextOrResult("qr");
  if ("result" in context) return context.result;

  try {
    const origin = await getOrigin();
    const point = await ensureBranchAttendanceQrPoint(context.ctx);
    revalidateAttendanceSurfaces();
    return {
      ok: true,
      kind: "attendance_qr",
      tab: "qr",
      message: "Attendance QR is ready.",
      qrPoint: await hydrateQrPoint(point, origin),
    };
  } catch (error) {
    return { ok: false, tab: "qr", message: safeError(error, "Could not generate the QR code.") };
  }
}

export async function ensureRoomQrPointsAction(): Promise<AttendanceActionResult> {
  const context = await getContextOrResult("qr");
  if ("result" in context) return context.result;

  try {
    const origin = await getOrigin();
    const result = await ensureRoomQrPoints(context.ctx);
    revalidateAttendanceSurfaces();
    return {
      ok: true,
      kind: "room_qrs",
      tab: "qr",
      message: result.createdCount === 0 ? "All room QR points are ready." : `${result.createdCount} room QR point(s) created.`,
      createdCount: result.createdCount,
      qrPoints: await Promise.all(result.qrPoints.map((point) => hydrateQrPoint(point, origin))),
    };
  } catch (error) {
    return { ok: false, tab: "qr", message: safeError(error, "Could not generate missing QR codes.") };
  }
}

export async function createDeviceActivationTokenAction(formData: FormData): Promise<AttendanceActionResult> {
  const context = await getContextOrResult("devices");
  if ("result" in context) return context.result;

  const staffId = String(formData.get("staffId") ?? "");
  if (!staffId) {
    return { ok: false, tab: "devices", message: "Choose a staff member." };
  }

  try {
    const activation = await createDeviceActivationLink({
      ctx: context.ctx,
      staffId,
      origin: await getOrigin(),
    });
    revalidateAttendanceSurfaces();
    return {
      ok: true,
      kind: "activation",
      tab: "devices",
      message: "Activation link created.",
      activationUrl: activation.activationUrl,
      expiresAt: activation.expiresAt,
    };
  } catch (error) {
    return { ok: false, tab: "devices", message: safeError(error, "Could not activate the phone.") };
  }
}

export async function revokeAttendanceDeviceAction(formData: FormData): Promise<AttendanceActionResult> {
  const context = await getContextOrResult("devices", String(formData.get("branchId") ?? ""));
  if ("result" in context) return context.result;

  const deviceId = String(formData.get("deviceId") ?? "");
  const reason = String(formData.get("reason") ?? "other") as DeviceRevocationReason;
  if (!deviceId) {
    return { ok: false, tab: "devices", message: "Device ID is missing." };
  }

  try {
    await revokeAttendanceDeviceWithReason({ ctx: context.ctx, deviceId, reason });
    revalidateAttendanceSurfaces();
    return { ok: true, kind: "device_revoked", tab: "devices", message: "Device revoked.", deviceId };
  } catch (error) {
    return { ok: false, tab: "devices", message: safeError(error, "The selected device is no longer active.") };
  }
}

export async function generateDeviceRecoveryLinkAction(
  input: GenerateDeviceRecoveryInput
): Promise<DeviceActionResult<RecoveryLinkResult>> {
  const context = await getDeviceContext(input.branchId);
  if (!context.success) return context;

  try {
    const recovery = await generateDeviceRecoveryLink({
      ctx: context.data,
      input,
      origin: await getOrigin(),
    });
    revalidateAttendanceSurfaces();
    return { success: true, data: recovery };
  } catch (error) {
    return {
      success: false,
      error: safeError(error, "Could not generate the recovery link."),
    };
  }
}

export async function renameAttendanceDeviceAction(input: {
  branchId: string;
  deviceId: string;
  label: string;
}): Promise<DeviceActionResult<{ deviceId: string; label: string }>> {
  const context = await getDeviceContext(input.branchId);
  if (!context.success) return context;

  try {
    const result = await renameAttendanceDevice({
      ctx: context.data,
      deviceId: input.deviceId,
      label: input.label,
    });
    revalidateAttendanceSurfaces();
    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error: safeError(error, "Could not rename the device."),
    };
  }
}

export async function revokeDeviceRecoveryLinkAction(input: {
  branchId: string;
  tokenId: string;
}): Promise<DeviceActionResult<{ tokenId: string }>> {
  const context = await getDeviceContext(input.branchId);
  if (!context.success) return context;

  try {
    const result = await revokeDeviceRecoveryLink({
      ctx: context.data,
      tokenId: input.tokenId,
    });
    revalidateAttendanceSurfaces();
    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error: safeError(error, "Could not revoke the recovery link."),
    };
  }
}

export async function reviewStaffDeviceRegistrationRequestAction(input: {
  branchId: string;
  requestId: string;
  decision: "approved" | "rejected";
  reviewerNote?: string | null;
  rejectionReason?: StaffDeviceRegistrationRejectionReason | null;
  replacementDeviceId?: string | null;
}): Promise<DeviceActionResult<StaffDeviceRegistrationRequest>> {
  const context = await getDeviceContext(input.branchId);
  if (!context.success) return context;
  try {
    const request = await reviewStaffDeviceRegistrationRequest({
      ctx: context.data,
      requestId: input.requestId,
      decision: input.decision,
      reviewerNote: input.reviewerNote,
      rejectionReason: input.rejectionReason,
      replacementDeviceId: input.replacementDeviceId,
    });
    revalidateAttendanceSurfaces();
    return { success: true, data: request };
  } catch (error) {
    return { success: false, error: safeError(error, "The phone request could not be reviewed.") };
  }
}

export async function resolveAttendanceExceptionAction(formData: FormData): Promise<AttendanceActionResult> {
  const context = await getContextOrResult("exceptions");
  if ("result" in context) return context.result;

  const exceptionId = String(formData.get("exceptionId") ?? "");
  const resolutionNote = String(formData.get("resolutionNote") ?? "");
  if (!exceptionId) {
    return { ok: false, tab: "exceptions", message: "Exception ID is missing." };
  }

  try {
    await resolveAttendanceException({ ctx: context.ctx, exceptionId, resolutionNote });
    revalidateAttendanceSurfaces();
    return {
      ok: true,
      kind: "exception_resolved",
      tab: "exceptions",
      message: "Exception resolved.",
      exceptionId,
    };
  } catch (error) {
    return { ok: false, tab: "exceptions", message: safeError(error, "Could not resolve the exception.") };
  }
}

export async function applyAttendanceCorrectionAction(
  input: ApplyAttendanceCorrectionInput
): Promise<AttendanceActionResult> {
  const context = await getContextOrResult("exceptions", input.branchId);
  if ("result" in context) return context.result;

  try {
    const result = await applyAttendanceCorrection({
      ctx: context.ctx,
      input,
    });
    revalidateAttendanceSurfaces();
    return {
      ok: true,
      kind: "attendance_correction",
      tab: "exceptions",
      message: result.message,
    };
  } catch (error) {
    return { ok: false, tab: "exceptions", message: safeError(error, "Could not apply the attendance correction.") };
  }
}

export async function updateAttendanceRulesAction(
  input: UpdateAttendanceRulesInput
): Promise<AttendanceActionResult> {
  const context = await getContextOrResult("exceptions", input.branchId);
  if ("result" in context) return context.result;

  try {
    const result = await updateAttendanceRules({
      ctx: context.ctx,
      input,
    });
    revalidateAttendanceSurfaces();
    return {
      ok: true,
      kind: "attendance_rules",
      tab: "exceptions",
      message: "Attendance rules saved.",
      settings: result.settings,
    };
  } catch (error) {
    return { ok: false, tab: "exceptions", message: safeError(error, "Could not save attendance rules.") };
  }
}

export async function completeDueServiceSessionsAction(): Promise<AttendanceActionResult> {
  const context = await getContextOrResult("sessions");
  if ("result" in context) return context.result;

  try {
    const count = await completeDueServiceSessionsNow();
    revalidateAttendanceSurfaces();
    return {
      ok: true,
      kind: "sessions_completed",
      tab: "sessions",
      message: count === 0 ? "No due sessions found." : `${count} due session(s) completed.`,
      completedCount: count,
    };
  } catch (error) {
    return { ok: false, tab: "sessions", message: safeError(error, "Due sessions could not be completed.") };
  }
}

export async function deactivateQrPointAction(formData: FormData): Promise<AttendanceActionResult> {
  const context = await getContextOrResult("qr");
  if ("result" in context) return context.result;

  const qrPointId = String(formData.get("qrPointId") ?? "");
  if (!qrPointId) {
    return { ok: false, tab: "qr", message: "QR code ID is missing." };
  }

  try {
    await deactivateQrPoint({ ctx: context.ctx, qrPointId });
    revalidateAttendanceSurfaces();
    return {
      ok: true,
      kind: "qr_deactivated",
      tab: "qr",
      message: "QR code deactivated.",
      qrPointId,
    };
  } catch (error) {
    return { ok: false, tab: "qr", message: safeError(error, "Could not deactivate the QR code.") };
  }
}
