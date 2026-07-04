import { NextRequest, NextResponse } from "next/server";
import { processQrScan } from "@/lib/attendance/scan-engine";
import { revalidateAttendanceSurfaces } from "@/lib/attendance/queries";
import { DEVICE_COOKIE_NAME, LEGACY_DEVICE_COOKIE_NAME } from "@/lib/attendance/tokens";
import type { PublicScanResult } from "@/lib/attendance/types";

type PublicScanBody = {
  publicCode?: string | null;
  requestId?: string | null;
};

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

  if (!publicCode) {
    return NextResponse.json({
      ok: false,
      outcome: "blocked",
      reasonCode: "invalid_qr",
      severity: "warning",
      title: "QR not recognized",
      message: "This scan link is missing its QR code.",
      securityNote: "No attendance change was recorded from this scan.",
    } satisfies PublicScanResult);
  }

  try {
    const result = await processQrScan(publicCode, {
      requestId: input.requestId,
      rawDeviceCredential:
        request.cookies.get(DEVICE_COOKIE_NAME)?.value ??
        request.cookies.get(LEGACY_DEVICE_COOKIE_NAME)?.value ??
        null,
      userAgent: request.headers.get("user-agent"),
      ipAddress: request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip"),
    });
    revalidatePublicScanResult(result);
    return NextResponse.json(toPublicResult(result));
  } catch {
    return NextResponse.json(safeScanError());
  }
}
