"use server";

import { cookies, headers } from "next/headers";
import { activateDeviceWithToken, processQrScan } from "@/lib/attendance/scan-engine";
import { DEVICE_COOKIE_NAME } from "@/lib/attendance/tokens";
import type { PublicScanResult } from "@/lib/attendance/types";

type PublicScanInput = {
  publicCode: string;
  requestId?: string | null;
};

type ActivationInput = {
  token: string;
  requestId?: string | null;
};

async function getRequestContext(requestId?: string | null) {
  const headerStore = await headers();
  const cookieStore = await cookies();
  return {
    requestId,
    rawDeviceCredential: cookieStore.get(DEVICE_COOKIE_NAME)?.value ?? null,
    userAgent: headerStore.get("user-agent"),
    ipAddress: headerStore.get("x-forwarded-for") ?? headerStore.get("x-real-ip"),
  };
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
    const cookieStore = await cookies();
    cookieStore.set(DEVICE_COOKIE_NAME, result.rawDeviceCredential, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/scan",
      maxAge: 60 * 60 * 24 * 180,
    });
  }

  return {
    ok: result.ok,
    outcome: result.outcome,
    title: result.title,
    message: result.message,
    detail: result.detail,
    scanEventId: result.scanEventId,
    nextHref: result.nextHref,
    countdown: result.countdown,
  };
}
