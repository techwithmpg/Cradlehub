import "server-only";

import { timingSafeEqual } from "crypto";
import { hashSecret } from "@/lib/attendance/tokens";

export const ATTENDANCE_SCAN_INTENT_COOKIE_NAME = "cradle_attendance_scan_intent";
export const ATTENDANCE_REGISTRATION_COOKIE_NAME = "cradle_attendance_registration";
export const ATTENDANCE_SCAN_INTENT_TTL_SECONDS = 10 * 60;

type AttendanceScanIntent = {
  publicCode: string;
  operationId: string;
  issuedAt: number;
  expiresAt: number;
};

function encodePayload(payload: AttendanceScanIntent): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function createAttendanceScanIntent(params: {
  publicCode: string;
  operationId: string;
  now?: Date;
}): string {
  const issuedAt = Math.floor((params.now ?? new Date()).getTime() / 1000);
  const payload = encodePayload({
    publicCode: params.publicCode,
    operationId: params.operationId,
    issuedAt,
    expiresAt: issuedAt + ATTENDANCE_SCAN_INTENT_TTL_SECONDS,
  });
  return `${payload}.${hashSecret(payload)}`;
}

export function verifyAttendanceScanIntent(
  token: string | null | undefined,
  params: { publicCode: string; operationId: string; now?: Date }
): { ok: true; intent: AttendanceScanIntent } | { ok: false; code: "missing" | "invalid" | "expired" | "mismatch" } {
  if (!token) return { ok: false, code: "missing" };
  const [payload, signature, ...rest] = token.split(".");
  if (!payload || !signature || rest.length > 0 || !safeEqual(signature, hashSecret(payload))) {
    return { ok: false, code: "invalid" };
  }

  let intent: AttendanceScanIntent;
  try {
    intent = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as AttendanceScanIntent;
  } catch {
    return { ok: false, code: "invalid" };
  }

  if (
    !intent ||
    typeof intent.publicCode !== "string" ||
    typeof intent.operationId !== "string" ||
    typeof intent.issuedAt !== "number" ||
    typeof intent.expiresAt !== "number"
  ) {
    return { ok: false, code: "invalid" };
  }

  const now = Math.floor((params.now ?? new Date()).getTime() / 1000);
  if (intent.expiresAt < now || intent.issuedAt > now + 60) return { ok: false, code: "expired" };
  if (intent.publicCode !== params.publicCode || intent.operationId !== params.operationId) {
    return { ok: false, code: "mismatch" };
  }
  return { ok: true, intent };
}
