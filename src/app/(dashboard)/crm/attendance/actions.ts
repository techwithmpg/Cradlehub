"use server";

import { headers } from "next/headers";
import {
  completeDueServiceSessionsNow,
  createDeviceActivationLink,
  deactivateQrPoint,
  ensureBranchAttendanceQrPoint,
  ensureRoomQrPoints,
  getAttendanceActionContext,
  getAttendanceWorkspaceData,
  resolveAttendanceException,
  reviewAttendanceException,
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
import { createAdminClient } from "@/lib/supabase/admin";
import { createOrUpdateNotification } from "@/lib/notifications/workflow-notifications-store";
import { createOrUpdateWorkflowTask } from "@/lib/notifications/workflow-task-store";

export type AttendanceActionResult =
  | { ok: false; tab?: AttendanceTab; message: string }
  | { ok: true; kind: "attendance_qr"; tab: "qr"; message: string; qrPoint: AttendanceQrPoint }
  | { ok: true; kind: "room_qrs"; tab: "qr"; message: string; createdCount: number; qrPoints: AttendanceQrPoint[] }
  | { ok: true; kind: "activation"; tab: "devices"; message: string; activationUrl: string; expiresAt: string }
  | { ok: true; kind: "device_revoked"; tab: "devices"; message: string; deviceId: string }
  | { ok: true; kind: "exception_resolved"; tab: "exceptions"; message: string; exceptionId: string }
  | { ok: true; kind: "exception_reviewed"; tab: "exceptions"; message: string; exceptionId: string }
  | { ok: true; kind: "issue_message" | "technical_escalation"; tab: "exceptions"; message: string; exceptionId: string }
  | { ok: true; kind: "attendance_correction"; tab: "exceptions"; message: string }
  | { ok: true; kind: "attendance_rules"; tab: "exceptions"; message: string; settings: AttendanceSettings }
  | { ok: true; kind: "sessions_completed"; tab: "sessions"; message: string; completedCount: number }
  | { ok: true; kind: "qr_deactivated"; tab: "qr"; message: string; qrPointId: string };

type AttendanceContext = NonNullable<Awaited<ReturnType<typeof getAttendanceActionContext>>>;

export async function refreshAttendanceWorkspaceAction(
  branchId?: string | null
): Promise<
  | { ok: true; data: Awaited<ReturnType<typeof getAttendanceWorkspaceData>> }
  | { ok: false; error: string }
> {
  const ctx = await getAttendanceActionContext({ branchId });
  if (!ctx) return { ok: false, error: "Attendance access is no longer available." };

  try {
    return {
      ok: true,
      data: await getAttendanceWorkspaceData({
        branchId: ctx.branchId,
        branchName: ctx.branchName,
        origin: await getOrigin(),
        canSwitchBranch: ctx.canSwitchBranch,
      }),
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Attendance data could not be refreshed.",
    };
  }
}

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

export async function reviewAttendanceExceptionAction(formData: FormData): Promise<AttendanceActionResult> {
  const context = await getContextOrResult("exceptions");
  if ("result" in context) return context.result;
  const exceptionId = String(formData.get("exceptionId") ?? "");
  if (!exceptionId) return { ok: false, tab: "exceptions", message: "Exception ID is missing." };
  try {
    await reviewAttendanceException({ ctx: context.ctx, exceptionId });
    revalidateAttendanceSurfaces();
    return { ok: true, kind: "exception_reviewed", tab: "exceptions", message: "Issue reviewed and kept open.", exceptionId };
  } catch (error) {
    return { ok: false, tab: "exceptions", message: safeError(error, "Could not mark the issue reviewed.") };
  }
}

export async function askStaffAboutAttendanceIssueAction(input: {
  exceptionId: string;
  message: string;
  responseChoices?: string[];
}): Promise<AttendanceActionResult> {
  const context = await getContextOrResult("exceptions");
  if ("result" in context) return context.result;
  const message = input.message.trim();
  if (!message || message.length > 1000) return { ok: false, tab: "exceptions", message: "Enter a question up to 1,000 characters." };
  const admin = createAdminClient();
  const issue = await admin.from("attendance_exceptions").select("id, branch_id, staff_id, exception_type").eq("id", input.exceptionId).eq("branch_id", context.ctx.branchId).eq("status", "open").maybeSingle();
  if (issue.error || !issue.data?.staff_id) return { ok: false, tab: "exceptions", message: "This open issue is not linked to a staff member." };
  const now = new Date().toISOString();
  const messages = admin.from("attendance_issue_messages" as never) as unknown as { insert: (value: Record<string, unknown>) => Promise<{ error: { message: string } | null }> };
  const inserted = await messages.insert({ exception_id: issue.data.id, branch_id: issue.data.branch_id, staff_id: issue.data.staff_id, sender_staff_id: context.ctx.actorStaffId, sender_workspace: "crm", message, response_choices: input.responseChoices ?? [], created_at: now });
  if (inserted.error) return { ok: false, tab: "exceptions", message: "Could not save the staff question." };
  await admin.from("attendance_exceptions").update({ resolution_status: "waiting_for_staff", staff_response_required: true }).eq("id", issue.data.id);
  await createOrUpdateNotification({ branchId: issue.data.branch_id, targetWorkspace: "staff", recipientStaffId: issue.data.staff_id, actorStaffId: context.ctx.actorStaffId, type: "attendance_issue_question", title: "Attendance question from CRM", body: message, entityType: "attendance_exception", entityId: issue.data.id, actionHref: "/staff-portal/notifications", priority: "high", requiresAction: true, dedupeKey: `attendance-question:${issue.data.id}`, metadata: { exceptionId: issue.data.id, responseChoices: input.responseChoices ?? [], scanIssueType: issue.data.exception_type } });
  await createOrUpdateWorkflowTask({ branchId: issue.data.branch_id, workspaceScope: "crm", taskType: "attendance_issue_follow_up", title: "Waiting for staff Attendance response", body: message, entityType: "attendance_exception", entityId: issue.data.id, actionHref: "/crm/attendance?tab=exceptions", priority: "high", dedupeKey: `attendance-follow-up:${issue.data.id}` });
  revalidateAttendanceSurfaces();
  return { ok: true, kind: "issue_message", tab: "exceptions", message: "Question sent to the Staff Portal inbox.", exceptionId: issue.data.id };
}

export async function escalateAttendanceIssueAction(exceptionId: string): Promise<AttendanceActionResult> {
  const context = await getContextOrResult("exceptions");
  if ("result" in context) return context.result;
  const admin = createAdminClient();
  const issue = await admin.from("attendance_exceptions").select("id, branch_id, safe_error_code, exception_type").eq("id", exceptionId).eq("branch_id", context.ctx.branchId).eq("status", "open").maybeSingle();
  if (issue.error || !issue.data) return { ok: false, tab: "exceptions", message: "Open Attendance issue not found." };
  await admin.from("attendance_exceptions").update({ resolution_status: "waiting_for_technical_support", resolution_owner: "technical_support" }).eq("id", exceptionId);
  await createOrUpdateWorkflowTask({ branchId: issue.data.branch_id, workspaceScope: "owner", assignedToRole: "owner", taskType: "attendance_technical_escalation", title: "Attendance technical escalation", body: `Safe code: ${issue.data.safe_error_code ?? issue.data.exception_type}`, entityType: "attendance_exception", entityId: issue.data.id, actionHref: "/owner/attendance?tab=exceptions", priority: "critical", dedupeKey: `attendance-technical:${issue.data.id}` });
  revalidateAttendanceSurfaces();
  return { ok: true, kind: "technical_escalation", tab: "exceptions", message: "Escalated to technical support without exposing raw details to staff.", exceptionId };
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
