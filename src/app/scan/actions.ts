"use server";

import { cookies, headers } from "next/headers";
import { activateDeviceWithToken, processQrScan } from "@/lib/attendance/scan-engine";
import { consumeDeviceRecoveryLink } from "@/lib/attendance/device-recovery";
import { revalidateAttendanceSurfaces } from "@/lib/attendance/queries";
import { DEVICE_COOKIE_NAME, LEGACY_DEVICE_COOKIE_NAME } from "@/lib/attendance/tokens";
import type { PublicScanResult } from "@/lib/attendance/types";

type PublicScanInput = {
  publicCode: string;
  requestId?: string | null;
};

type ActivationInput = {
  token: string;
  requestId?: string | null;
};

type RecoveryInput = {
  token: string;
};

async function getRequestContext(requestId?: string | null) {
  const headerStore = await headers();
  const cookieStore = await cookies();
  return {
    requestId,
    rawDeviceCredential:
      cookieStore.get(DEVICE_COOKIE_NAME)?.value ??
      cookieStore.get(LEGACY_DEVICE_COOKIE_NAME)?.value ??
      null,
    userAgent: headerStore.get("user-agent"),
    ipAddress: headerStore.get("x-forwarded-for") ?? headerStore.get("x-real-ip"),
  };
}

async function setDeviceCookie(rawDeviceCredential: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(DEVICE_COOKIE_NAME, rawDeviceCredential, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
  });
  cookieStore.set(LEGACY_DEVICE_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/scan",
    maxAge: 0,
  });
}

function safeScanError(title = "Scan interrupted"): PublicScanResult {
  return {
    ok: false,
    outcome: "error",
    reasonCode: "server_action_error",
    severity: "critical",
    title,
    message: "Something interrupted the scan. Please try again or ask the front desk for help.",
    securityNote: "No attendance change was confirmed from this attempt.",
  };
}

function revalidatePublicScanResult(result: PublicScanResult): void {
  if (result.scanEventId || result.attendance || result.countdown || result.reasonCode === "device_restored") {
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
    detail: result.detail,
    securityNote: result.securityNote,
    scanEventId: result.scanEventId,
    nextHref: result.nextHref,
    attendance: result.attendance,
    countdown: result.countdown,
  };
}

export async function processPublicQrScanAction(input: PublicScanInput): Promise<PublicScanResult> {
  const publicCode = input.publicCode?.trim();
  if (!publicCode) {
    return {
      ok: false,
      outcome: "blocked",
      reasonCode: "invalid_qr",
      severity: "warning",
      title: "QR not recognized",
      message: "This scan link is missing its QR code.",
      securityNote: "No attendance change was recorded from this scan.",
    };
  }

  try {
    const result = await processQrScan(publicCode, await getRequestContext(input.requestId));
    revalidatePublicScanResult(result);
    return result;
  } catch {
    return safeScanError();
  }
}

export async function activateDeviceAction(input: ActivationInput): Promise<PublicScanResult> {
  const token = input.token?.trim();
  if (!token) {
    return {
      ok: false,
      outcome: "blocked",
      reasonCode: "invalid_token",
      severity: "warning",
      title: "Activation expired",
      message: "Ask the front desk for a new activation link.",
    };
  }

  try {
    const result = await activateDeviceWithToken(token, await getRequestContext(input.requestId));
    if (result.ok && result.rawDeviceCredential) {
      await setDeviceCookie(result.rawDeviceCredential);
    }
    revalidatePublicScanResult(result);

    return toPublicResult(result);
  } catch {
    return safeScanError("Activation interrupted");
  }
}

export async function consumeDeviceRecoveryLinkAction(input: RecoveryInput): Promise<PublicScanResult> {
  const token = input.token?.trim();
  if (!token) {
    return {
      ok: false,
      outcome: "blocked",
      reasonCode: "invalid_token",
      severity: "warning",
      title: "Link invalid",
      message: "This recovery link could not be verified.",
    };
  }

  try {
    const headerStore = await headers();
    const result = await consumeDeviceRecoveryLink({
      rawToken: token,
      userAgent: headerStore.get("user-agent"),
    });

    if (!result.success) {
      return {
        ok: false,
        outcome: "blocked",
        reasonCode: result.code,
        severity: "warning",
        title: result.title,
        message: result.message,
      };
    }

    await setDeviceCookie(result.rawDeviceCredential);
    revalidatePublicScanResult({
      ok: true,
      outcome: "success",
      reasonCode: "device_restored",
      title: "Phone connected",
      message: "This phone is ready for attendance and service QR scanning.",
    });

    return {
      ok: true,
      outcome: "success",
      reasonCode: "device_restored",
      severity: "success",
      title: "Phone connected",
      message: "This phone is ready for attendance and service QR scanning.",
      detail: `${result.staffName} - ${result.branchName}`,
      securityNote: "This phone is now trusted for this staff member.",
    };
  } catch {
    return safeScanError("Recovery interrupted");
  }
}
