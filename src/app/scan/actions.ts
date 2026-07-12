"use server";

import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  activateDeviceWithToken,
  processQrScan,
  registerDeviceForAuthenticatedScan,
} from "@/lib/attendance/scan-engine";
import { consumeDeviceRecoveryLink } from "@/lib/attendance/device-recovery";
import { revalidateAttendanceSurfaces } from "@/lib/attendance/queries";
import { DEVICE_COOKIE_NAME, LEGACY_DEVICE_COOKIE_NAME } from "@/lib/attendance/tokens";
import {
  cancelOwnBranchCorrectionRequestForScan,
  createBranchCorrectionRequestForScan,
} from "@/lib/staff/branch-correction";
import { createClient } from "@/lib/supabase/server";
import type { PublicScanResult } from "@/lib/attendance/types";
import type {
  BranchCorrectionRequestResult,
  BranchCorrectionReviewResult,
  BranchCorrectionScanDetails,
} from "@/lib/staff/branch-correction-types";

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

type FirstTimeScanLoginInput = {
  publicCode: string;
  email: string;
  password: string;
  requestId?: string | null;
};

type BranchCorrectionRequestInput = {
  details: BranchCorrectionScanDetails;
  reason?: string | null;
};

type BranchCorrectionCancelInput = {
  requestId?: string | null;
};

export type FirstTimeScanFieldErrors = {
  email?: string;
  password?: string;
};

export type FirstTimeAttendanceDeviceRegistrationResult =
  | {
      ok: true;
      deviceRegistered: true;
      cookieSet: true;
      nextScanRequired: true;
      staffDeviceId: string;
      staffName: string;
      branchName: string;
      message: string;
    }
  | {
      ok: false;
      error?: string;
      fieldErrors?: FirstTimeScanFieldErrors;
      result?: PublicScanResult;
    };

async function getRequestContext(requestId?: string | null, rawDeviceCredentialOverride?: string | null) {
  const headerStore = await headers();
  const cookieStore = await cookies();
  return {
    requestId,
    rawDeviceCredential:
      rawDeviceCredentialOverride ??
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

async function clearDeviceCookies(): Promise<void> {
  const cookieStore = await cookies();
  const base = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 0,
  };
  cookieStore.set(DEVICE_COOKIE_NAME, "", { ...base, path: "/" });
  cookieStore.set(LEGACY_DEVICE_COOKIE_NAME, "", { ...base, path: "/" });
  cookieStore.set(LEGACY_DEVICE_COOKIE_NAME, "", { ...base, path: "/scan" });
}

function isUuidLike(value: string | null | undefined): value is string {
  return Boolean(
    value &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

function appendRequestStep(requestId: string | null | undefined, step: string): string | null {
  return requestId ? `${requestId}:${step}` : null;
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

function validateFirstTimeScanLogin(input: FirstTimeScanLoginInput): {
  publicCode: string;
  email: string;
  password: string;
  fieldErrors?: FirstTimeScanFieldErrors;
} {
  const publicCode = input.publicCode?.trim() ?? "";
  const email = input.email?.trim() ?? "";
  const password = input.password ?? "";
  const fieldErrors: FirstTimeScanFieldErrors = {};

  if (!email) {
    fieldErrors.email = "Enter your email address.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    fieldErrors.email = "Enter a valid email address.";
  }

  if (!password) {
    fieldErrors.password = "Enter your password.";
  }

  return {
    publicCode,
    email,
    password,
    fieldErrors: Object.keys(fieldErrors).length > 0 ? fieldErrors : undefined,
  };
}

function revalidatePublicScanResult(result: PublicScanResult): void {
  if (result.scanEventId || result.attendance || result.countdown || result.reasonCode === "device_restored") {
    revalidateAttendanceSurfaces({
      includeOperationalReadiness: Boolean(
        result.attendance ||
          result.countdown ||
          result.reasonCode === "device_restored"
      ),
    });
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
    branchCorrection: result.branchCorrection,
  };
}

function validateBranchCorrectionDetails(
  input: BranchCorrectionRequestInput | null | undefined
): BranchCorrectionScanDetails | null {
  const details = input?.details;
  if (!details || typeof details !== "object") return null;

  const required = [
    details.staffId,
    details.staffName,
    details.currentBranchId,
    details.currentBranchName,
    details.requestedBranchId,
    details.requestedBranchName,
    details.qrPointId,
  ];

  if (required.some((value) => typeof value !== "string" || value.trim().length === 0)) {
    return null;
  }

  return {
    staffId: details.staffId.trim(),
    staffName: details.staffName.trim(),
    currentBranchId: details.currentBranchId.trim(),
    currentBranchName: details.currentBranchName.trim(),
    requestedBranchId: details.requestedBranchId.trim(),
    requestedBranchName: details.requestedBranchName.trim(),
    qrPointId: details.qrPointId.trim(),
    scanEventId: details.scanEventId?.trim() || undefined,
    publicCode: details.publicCode?.trim() || undefined,
    deviceId: details.deviceId?.trim() || undefined,
    canRequestBranchCorrection: details.canRequestBranchCorrection,
    existingPendingRequest: details.existingPendingRequest ?? null,
  };
}

export async function signInAndRegisterAttendanceDeviceAction(
  input: FirstTimeScanLoginInput
): Promise<FirstTimeAttendanceDeviceRegistrationResult> {
  const parsed = validateFirstTimeScanLogin(input);
  if (!parsed.publicCode) {
    return {
      ok: false,
      result: {
        ok: false,
        outcome: "blocked",
        reasonCode: "invalid_qr",
        severity: "warning",
        title: "QR not recognized",
        message: "This scan link is missing its QR code.",
        securityNote: "No attendance change was recorded from this scan.",
      },
    };
  }

  if (parsed.fieldErrors) {
    return {
      ok: false,
      error: "Check your email and password, then try again.",
      fieldErrors: parsed.fieldErrors,
    };
  }

  const supabase = await createClient();

  try {
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: parsed.email,
      password: parsed.password,
    });

    if (authError) {
      return {
        ok: false,
        error: "Check your email and password, then try again.",
      };
    }

    const user = data.user ?? (await supabase.auth.getUser()).data.user;
    if (!user) {
      return {
        ok: false,
        error: "Check your email and password, then try again.",
      };
    }

    const registration = await registerDeviceForAuthenticatedScan(
      parsed.publicCode,
      user.id,
      await getRequestContext(appendRequestStep(input.requestId, "register"))
    );

    if (!registration.ok) {
      if (registration.result.reasonCode !== "wrong_branch") {
        await supabase.auth.signOut();
      }
      revalidatePublicScanResult(registration.result);
      return {
        ok: false,
        result: toPublicResult(registration.result),
      };
    }

    await setDeviceCookie(registration.rawDeviceCredential);
    revalidateAttendanceSurfaces();

    return {
      ok: true,
      deviceRegistered: true,
      cookieSet: true,
      nextScanRequired: true,
      staffDeviceId: registration.deviceId,
      staffName: registration.staffName,
      branchName: registration.branchName,
      message: "This phone is now connected for faster attendance scans.",
    };
  } catch {
    return {
      ok: false,
      result: safeScanError("Sign-in interrupted"),
    };
  }
}

export async function requestBranchCorrectionAction(
  input: BranchCorrectionRequestInput
): Promise<BranchCorrectionRequestResult> {
  const details = validateBranchCorrectionDetails(input);
  if (!details) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: "This correction request is missing scan details. Please scan again.",
    };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const requestContext = await getRequestContext(null);
  if (!user && !requestContext.rawDeviceCredential) {
    return {
      ok: false,
      code: "UNAUTHENTICATED",
      message: "Scan again on this phone or sign in with your staff account to request correction.",
    };
  }

  const result = await createBranchCorrectionRequestForScan({
    authUserId: user?.id ?? null,
    rawDeviceCredential: requestContext.rawDeviceCredential,
    details,
    reason: input.reason,
    userAgent: requestContext.userAgent,
  });

  if (result.ok) {
    revalidateAttendanceSurfaces();
    revalidatePath("/crm/staff");
  }

  return result;
}

export async function createBranchCorrectionRequestAction(
  input: BranchCorrectionRequestInput
): Promise<BranchCorrectionRequestResult> {
  return requestBranchCorrectionAction(input);
}

export async function cancelOwnBranchCorrectionRequestAction(
  input: BranchCorrectionCancelInput
): Promise<BranchCorrectionReviewResult> {
  if (!isUuidLike(input.requestId)) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: "This branch correction request could not be found.",
    };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const requestContext = await getRequestContext(null);
  const result = await cancelOwnBranchCorrectionRequestForScan({
    authUserId: user?.id ?? null,
    rawDeviceCredential: requestContext.rawDeviceCredential,
    requestId: input.requestId,
  });

  if (result.ok) {
    revalidateAttendanceSurfaces();
    revalidatePath("/crm/staff");
  }

  return result;
}

export async function tryAnotherScanAccountAction(): Promise<{ ok: true }> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  await clearDeviceCookies();
  return { ok: true };
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
