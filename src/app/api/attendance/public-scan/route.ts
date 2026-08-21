import { NextRequest, NextResponse } from "next/server";
import { processQrScan, resolveAttendanceScanIdentity } from "@/lib/attendance/scan-engine";
import { revalidateAttendanceSurfaces } from "@/lib/attendance/queries";
import { DEVICE_COOKIE_NAME, LEGACY_DEVICE_COOKIE_NAME } from "@/lib/attendance/tokens";
import { createClient } from "@/lib/supabase/server";
import { createDeviceCredential } from "@/lib/attendance/tokens";
import {
  ATTENDANCE_REGISTRATION_COOKIE_NAME,
  ATTENDANCE_SCAN_INTENT_COOKIE_NAME,
  ATTENDANCE_SCAN_INTENT_TTL_SECONDS,
  createAttendanceScanIntent,
} from "@/lib/attendance/scan-continuation";
import {
  attendanceScanFailureFromError,
  logAttendanceScanError,
  normalizeAttendanceOperationId,
} from "@/lib/attendance/scan-errors";
import type { PublicScanResult } from "@/lib/attendance/types";
import { withAttendanceScanResolution } from "@/lib/attendance/scan-resolution";

type PublicScanBody = {
  publicCode?: string | null;
  requestId?: string | null;
};

function revalidatePublicScanResult(result: PublicScanResult): void {
  if (
    result.scanEventId ||
    result.attendance ||
    result.countdown ||
    result.reasonCode === "device_restored"
  ) {
    revalidateAttendanceSurfaces();
  }
}

function toPublicResult(result: PublicScanResult): PublicScanResult {
  return {
    ok: result.ok,
    outcome: result.outcome,
    reasonCode: result.reasonCode,
    severity: result.severity,
    title: result.title,
    message: result.message,
    reviewLabel: result.reviewLabel,
    isTest: result.isTest,
    securityNote: result.securityNote,
    scanEventId: result.scanEventId,
    operationId: result.operationId,
    recoverable: result.recoverable,
    nextHref: result.nextHref,
    deviceConnection: result.deviceConnection,
    accountDeviceMismatch: result.accountDeviceMismatch,
    attendance: result.attendance,
    countdown: result.countdown,
    branchCorrection: result.branchCorrection
      ? { ...result.branchCorrection, deviceId: undefined }
      : undefined,
  };
}

async function readBody(request: NextRequest): Promise<PublicScanBody> {
  try {
    return (await request.json()) as PublicScanBody;
  } catch {
    return {};
  }
}

export async function POST(request: NextRequest) {
  const input = await readBody(request);
  const publicCode = input.publicCode?.trim();
  const operationId = normalizeAttendanceOperationId(input.requestId);

  if (!publicCode) {
    return NextResponse.json({
      ok: false,
      outcome: "blocked",
      reasonCode: "invalid_qr",
      severity: "warning",
      title: "QR not recognized",
      message: "This scan link is missing its QR code.",
      securityNote: "No attendance change was recorded from this scan.",
      operationId,
    } satisfies PublicScanResult);
  }

  try {
    const rawDeviceCredential =
      request.cookies.get(DEVICE_COOKIE_NAME)?.value ??
      request.cookies.get(LEGACY_DEVICE_COOKIE_NAME)?.value ??
      null;
    const requestContext = {
      requestId: operationId,
      rawDeviceCredential,
      userAgent: request.headers.get("user-agent"),
      ipAddress: request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip"),
    };
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const identity = await resolveAttendanceScanIdentity({
      publicCode,
      authenticatedUserId: user?.id ?? null,
      requestContext,
    });
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
    };

    if (!identity.ok) {
      const identityResult = {
        ...identity.result,
        operationId: identity.result.operationId ?? operationId,
      };
      revalidatePublicScanResult(identityResult);
      const response = NextResponse.json(
        toPublicResult(withAttendanceScanResolution(identityResult))
      );

      if (identity.state === "sign_in_required") {
        const temporaryCredential =
          request.cookies.get(ATTENDANCE_REGISTRATION_COOKIE_NAME)?.value ??
          createDeviceCredential();
        response.cookies.set(ATTENDANCE_REGISTRATION_COOKIE_NAME, temporaryCredential, {
          ...cookieOptions,
          path: "/",
          maxAge: 60 * 60 * 24 * 30,
        });
        response.cookies.set(
          ATTENDANCE_SCAN_INTENT_COOKIE_NAME,
          createAttendanceScanIntent({ publicCode, operationId }),
          { ...cookieOptions, path: "/scan", maxAge: ATTENDANCE_SCAN_INTENT_TTL_SECONDS }
        );
      }

      return response;
    }

    const scanResult = await processQrScan(publicCode, {
      ...requestContext,
      rawDeviceCredential: identity.rawDeviceCredential,
    });
    const result: PublicScanResult = {
      ...scanResult,
      deviceConnection: identity.state,
    };
    revalidatePublicScanResult(result);
    const response = NextResponse.json(toPublicResult(withAttendanceScanResolution(result)));

    if (identity.state === "auto_registered_from_session") {
      response.cookies.set(DEVICE_COOKIE_NAME, identity.rawDeviceCredential, {
        ...cookieOptions,
        path: "/",
        maxAge: 60 * 60 * 24 * 180,
      });
      response.cookies.set(LEGACY_DEVICE_COOKIE_NAME, "", {
        ...cookieOptions,
        path: "/scan",
        maxAge: 0,
      });
    }

    return response;
  } catch (error) {
    logAttendanceScanError({
      scope: "public-attendance-scan-route",
      operationId,
      error,
      context: { publicCodeLength: publicCode.length },
    });
    const failure = attendanceScanFailureFromError({ error, operationId });
    return NextResponse.json(toPublicResult(withAttendanceScanResolution(failure.result)), {
      status: failure.status,
    });
  }
}
