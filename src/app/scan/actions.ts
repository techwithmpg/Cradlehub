"use server";

import { cookies, headers } from "next/headers";
import { activateDeviceWithToken, processQrScan } from "@/lib/attendance/scan-engine";
import { consumeDeviceRecoveryLink } from "@/lib/attendance/device-recovery";
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

export async function processPublicQrScanAction(input: PublicScanInput): Promise<PublicScanResult> {
  const publicCode = input.publicCode?.trim();
  if (!publicCode) {
    return {
      ok: false,
      outcome: "blocked",
      title: "QR not recognized",
      message: "This scan link is missing its QR code.",
    };
  }

  return processQrScan(publicCode, await getRequestContext(input.requestId));
}

export async function activateDeviceAction(input: ActivationInput): Promise<PublicScanResult> {
  const token = input.token?.trim();
  if (!token) {
    return {
      ok: false,
      outcome: "blocked",
      title: "Activation expired",
      message: "Ask the front desk for a new activation link.",
    };
  }

  const result = await activateDeviceWithToken(token, await getRequestContext(input.requestId));
  if (result.ok && result.rawDeviceCredential) {
    await setDeviceCookie(result.rawDeviceCredential);
  }

  return {
    ok: result.ok,
    outcome: result.outcome,
    title: result.title,
    message: result.message,
    detail: result.detail,
    scanEventId: result.scanEventId,
    nextHref: result.nextHref,
    attendance: result.attendance,
    countdown: result.countdown,
  };
}

export async function consumeDeviceRecoveryLinkAction(input: RecoveryInput): Promise<PublicScanResult> {
  const token = input.token?.trim();
  if (!token) {
    return {
      ok: false,
      outcome: "blocked",
      title: "Link invalid",
      message: "This recovery link could not be verified.",
    };
  }

  const headerStore = await headers();
  const result = await consumeDeviceRecoveryLink({
    rawToken: token,
    userAgent: headerStore.get("user-agent"),
  });

  if (!result.success) {
    return {
      ok: false,
      outcome: "blocked",
      title: result.title,
      message: result.message,
    };
  }

  await setDeviceCookie(result.rawDeviceCredential);

  return {
    ok: true,
    outcome: "success",
    title: "Phone connected",
    message: "This phone is ready for attendance and service QR scanning.",
    detail: `${result.staffName} - ${result.branchName}`,
  };
}
