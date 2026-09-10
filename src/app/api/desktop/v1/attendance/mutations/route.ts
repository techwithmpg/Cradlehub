import { NextRequest, NextResponse } from "next/server";
import { verifyDesktopBearerAuth } from "@/lib/auth/desktop-bearer-auth";
import {
  ensureBranchAttendanceQrPoint,
  ensureRoomQrPoints,
  replaceBranchAttendanceQrPoint,
  resolveAttendanceException,
  reviewAttendanceException,
  type AttendanceActionContext,
} from "@/lib/attendance/queries";
import {
  applyAttendanceCorrection,
  updateAttendanceRules,
  type ApplyAttendanceCorrectionInput,
  type UpdateAttendanceRulesInput,
} from "@/lib/attendance/attendance-correction-service";
import {
  renameAttendanceDevice,
  revokeAttendanceDeviceWithReason,
  revokeDeviceRecoveryLink,
  type GenerateDeviceRecoveryInput,
} from "@/lib/attendance/device-recovery";
import { generateAttendanceDeviceRecoveryOperation } from "@/lib/attendance/device-recovery-operation";
import {
  reviewStaffDeviceRegistrationRequest,
  type StaffDeviceRegistrationRejectionReason,
} from "@/lib/attendance/device-registration";
import type { DeviceRevocationReason } from "@/lib/attendance/types";
import { logError } from "@/lib/logger";

type AttendanceMutationAction =
  | "review_exception"
  | "resolve_exception"
  | "apply_correction"
  | "update_rules"
  | "generate_device_recovery"
  | "rename_device"
  | "revoke_device"
  | "revoke_recovery_link"
  | "review_device_registration_request"
  | "ensure_attendance_qr"
  | "ensure_room_qrs"
  | "replace_attendance_qr";

const VALID_ACTIONS = new Set<AttendanceMutationAction>([
  "review_exception",
  "resolve_exception",
  "apply_correction",
  "update_rules",
  "generate_device_recovery",
  "rename_device",
  "revoke_device",
  "revoke_recovery_link",
  "review_device_registration_request",
  "ensure_attendance_qr",
  "ensure_room_qrs",
  "replace_attendance_qr",
]);

const RECOVERY_TTLS = new Set([15, 30, 60]);

function noStore(status = 200): ResponseInit {
  return {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requiredString(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key];

  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function optionalString(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key];

  if (value == null) return null;
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function safeAttendanceError(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;

  if (error.message.includes("duplicate key")) return fallback;
  if (error.message.includes("PostgrestError")) return fallback;
  if (error.message.includes("NEXT_")) return fallback;

  return error.message || fallback;
}

/**
 * POST /api/desktop/v1/attendance/mutations
 *
 * Auth: Bearer <Supabase access_token>
 *
 * Branch and actor authority are derived from the verified bearer identity.
 * Renderer-supplied branchId is never trusted.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const authResult = await verifyDesktopBearerAuth(req);

  if (!authResult.ok) {
    return NextResponse.json(
      {
        ok: false,
        code: authResult.code,
        message: authResult.message,
      },
      noStore(authResult.status)
    );
  }

  const { operator, client, user } = authResult;
  const staff = operator.staff;

  if (!staff || !operator.staffRole) {
    return NextResponse.json(
      {
        ok: false,
        code: "CRM_PERMISSION_DENIED",
        message: "Attendance access is unavailable for this account.",
      },
      noStore(403)
    );
  }

  const branchId = staff.branch_id;

  if (!branchId) {
    return NextResponse.json(
      {
        ok: false,
        code: "STAFF_NOT_FOUND",
        message: "No branch associated with this staff account.",
      },
      noStore(403)
    );
  }

  const branchResult = await client
    .from("branches")
    .select("id, name")
    .eq("id", branchId)
    .maybeSingle();

  if (branchResult.error || !branchResult.data) {
    return NextResponse.json(
      {
        ok: false,
        code: "BRANCH_NOT_FOUND",
        message: "The authenticated Attendance branch is unavailable.",
      },
      noStore(403)
    );
  }

  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        code: "VALIDATION_ERROR",
        message: "Invalid JSON payload.",
      },
      noStore(400)
    );
  }

  if (!isRecord(body)) {
    return NextResponse.json(
      {
        ok: false,
        code: "VALIDATION_ERROR",
        message: "Request body must be a JSON object.",
      },
      noStore(400)
    );
  }

  const action = body.action;
  const payload = body.payload;

  if (typeof action !== "string" || !VALID_ACTIONS.has(action as AttendanceMutationAction)) {
    return NextResponse.json(
      {
        ok: false,
        code: "VALIDATION_ERROR",
        message: "Unknown or missing Attendance action.",
      },
      noStore(400)
    );
  }

  if (!isRecord(payload)) {
    return NextResponse.json(
      {
        ok: false,
        code: "VALIDATION_ERROR",
        message: "Attendance mutation payload must be a JSON object.",
      },
      noStore(400)
    );
  }

  const ctx: AttendanceActionContext = {
    branchId,
    branchName: branchResult.data.name ?? "Branch",
    actorStaffId: staff.id,
    role: operator.staffRole,
    canSwitchBranch: false,
  };

  try {
    switch (action as AttendanceMutationAction) {
      case "ensure_attendance_qr": {
        const point = await ensureBranchAttendanceQrPoint(ctx);

        return NextResponse.json(
          {
            ok: true,
            action,
            message: "Attendance QR is ready.",
            qrPointId: point.id,
          },
          noStore()
        );
      }

      case "ensure_room_qrs": {
        const result = await ensureRoomQrPoints(ctx);

        return NextResponse.json(
          {
            ok: true,
            action,
            message:
              result.createdCount === 0
                ? "All room QR points are ready."
                : `${result.createdCount} room QR point(s) created.`,
            createdCount: result.createdCount,
            qrPointIds: result.qrPoints.map((point) => point.id),
          },
          noStore()
        );
      }

      case "replace_attendance_qr": {
        const qrPointId = requiredString(payload, "qrPointId");

        if (!qrPointId) {
          return NextResponse.json(
            {
              ok: false,
              code: "VALIDATION_ERROR",
              message: "Attendance QR point ID is required.",
            },
            noStore(400)
          );
        }

        const point = await replaceBranchAttendanceQrPoint({
          ctx,
          qrPointId,
        });

        return NextResponse.json(
          {
            ok: true,
            action,
            message: "Official Attendance QR replaced.",
            replacedQrPointId: qrPointId,
            qrPointId: point.id,
          },
          noStore()
        );
      }

      case "review_exception": {
        const exceptionId = requiredString(payload, "exceptionId");

        if (!exceptionId) {
          return NextResponse.json(
            {
              ok: false,
              code: "VALIDATION_ERROR",
              message: "Attendance exception ID is required.",
            },
            noStore(400)
          );
        }

        await reviewAttendanceException({
          ctx,
          exceptionId,
        });

        return NextResponse.json(
          {
            ok: true,
            action,
            message: "Issue reviewed and kept open.",
            exceptionId,
          },
          noStore()
        );
      }

      case "resolve_exception": {
        const exceptionId = requiredString(payload, "exceptionId");

        if (!exceptionId) {
          return NextResponse.json(
            {
              ok: false,
              code: "VALIDATION_ERROR",
              message: "Attendance exception ID is required.",
            },
            noStore(400)
          );
        }

        const resolutionNote = optionalString(payload, "resolutionNote");

        await resolveAttendanceException({
          ctx,
          exceptionId,
          resolutionNote,
        });

        return NextResponse.json(
          {
            ok: true,
            action,
            message: "Exception resolved.",
            exceptionId,
          },
          noStore()
        );
      }

      case "apply_correction": {
        if (typeof payload.actionType !== "string") {
          return NextResponse.json(
            {
              ok: false,
              code: "VALIDATION_ERROR",
              message: "Attendance correction actionType is required.",
            },
            noStore(400)
          );
        }

        const input = {
          ...(payload as unknown as ApplyAttendanceCorrectionInput),
          branchId,
        };

        const result = await applyAttendanceCorrection({
          ctx,
          input,
        });

        return NextResponse.json(
          {
            ok: true,
            action,
            message: result.message,
          },
          noStore()
        );
      }

      case "update_rules": {
        if (!isRecord(payload.settings)) {
          return NextResponse.json(
            {
              ok: false,
              code: "VALIDATION_ERROR",
              message: "Attendance rules settings are required.",
            },
            noStore(400)
          );
        }

        const input = {
          ...(payload as unknown as UpdateAttendanceRulesInput),
          branchId,
        };

        const result = await updateAttendanceRules({
          ctx,
          input,
        });

        return NextResponse.json(
          {
            ok: true,
            action,
            message: "Attendance rules saved.",
            settings: result.settings,
          },
          noStore()
        );
      }

      case "generate_device_recovery": {
        const staffId = requiredString(payload, "staffId");
        const reason = requiredString(payload, "reason");
        const deliveryMethod = requiredString(payload, "deliveryMethod");
        const expiresInMinutes = payload.expiresInMinutes;

        if (
          !staffId ||
          !reason ||
          !deliveryMethod ||
          !RECOVERY_TTLS.has(expiresInMinutes as number) ||
          !["staff_profile", "copy_link"].includes(deliveryMethod)
        ) {
          return NextResponse.json(
            {
              ok: false,
              code: "VALIDATION_ERROR",
              message: "Invalid Attendance phone recovery request.",
            },
            noStore(400)
          );
        }

        const input: GenerateDeviceRecoveryInput = {
          staffId,
          branchId,
          reason: reason as GenerateDeviceRecoveryInput["reason"],
          expiresInMinutes: expiresInMinutes as GenerateDeviceRecoveryInput["expiresInMinutes"],
          deliveryMethod: deliveryMethod as GenerateDeviceRecoveryInput["deliveryMethod"],
          revokePreviousDeviceId: optionalString(payload, "revokePreviousDeviceId"),
        };

        const recovery = await generateAttendanceDeviceRecoveryOperation({
          ctx,
          input,
          origin: req.nextUrl.origin,
        });

        return NextResponse.json(
          {
            ok: true,
            action,
            data: recovery,
          },
          noStore()
        );
      }

      case "rename_device": {
        const deviceId = requiredString(payload, "deviceId");
        const label = requiredString(payload, "label");

        if (!deviceId || !label) {
          return NextResponse.json(
            {
              ok: false,
              code: "VALIDATION_ERROR",
              message: "Device ID and phone name are required.",
            },
            noStore(400)
          );
        }

        const result = await renameAttendanceDevice({
          ctx,
          deviceId,
          label,
        });

        return NextResponse.json(
          {
            ok: true,
            action,
            data: result,
          },
          noStore()
        );
      }

      case "revoke_device": {
        const deviceId = requiredString(payload, "deviceId");
        const reason = requiredString(payload, "reason");

        if (!deviceId || !reason) {
          return NextResponse.json(
            {
              ok: false,
              code: "VALIDATION_ERROR",
              message: "Device ID and revocation reason are required.",
            },
            noStore(400)
          );
        }

        const result = await revokeAttendanceDeviceWithReason({
          ctx,
          deviceId,
          reason: reason as DeviceRevocationReason,
        });

        return NextResponse.json(
          {
            ok: true,
            action,
            data: result,
          },
          noStore()
        );
      }

      case "revoke_recovery_link": {
        const tokenId = requiredString(payload, "tokenId");

        if (!tokenId) {
          return NextResponse.json(
            {
              ok: false,
              code: "VALIDATION_ERROR",
              message: "Recovery link ID is required.",
            },
            noStore(400)
          );
        }

        const result = await revokeDeviceRecoveryLink({
          ctx,
          tokenId,
        });

        return NextResponse.json(
          {
            ok: true,
            action,
            data: result,
          },
          noStore()
        );
      }

      case "review_device_registration_request": {
        const requestId = requiredString(payload, "requestId");
        const decision = requiredString(payload, "decision");

        if (!requestId || !decision || !["approved", "rejected"].includes(decision)) {
          return NextResponse.json(
            {
              ok: false,
              code: "VALIDATION_ERROR",
              message: "Valid registration request ID and decision are required.",
            },
            noStore(400)
          );
        }

        const request = await reviewStaffDeviceRegistrationRequest({
          ctx,
          requestId,
          decision: decision as "approved" | "rejected",
          reviewerNote: optionalString(payload, "reviewerNote"),
          rejectionReason: optionalString(
            payload,
            "rejectionReason"
          ) as StaffDeviceRegistrationRejectionReason | null,
          replacementDeviceId: optionalString(payload, "replacementDeviceId"),
          reviewerAuthUserId: user.id,
        });

        return NextResponse.json(
          {
            ok: true,
            action,
            data: request,
          },
          noStore()
        );
      }
    }
  } catch (error) {
    logError("api.desktop.v1.attendance.mutations.failed", {
      error,
      action,
      branchId,
      staffId: staff.id,
    });

    return NextResponse.json(
      {
        ok: false,
        code: "ATTENDANCE_ACTION_FAILED",
        message: safeAttendanceError(
          error,
          "The Attendance action could not be completed. Please try again."
        ),
      },
      noStore(422)
    );
  }
}
