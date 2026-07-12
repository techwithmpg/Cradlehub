import "server-only";

import { createHash, randomBytes } from "crypto";

export const DEVICE_COOKIE_NAME = "cradle_attendance_device";
export const LEGACY_DEVICE_COOKIE_NAME = "cradle_device";
const LOCAL_DEVICE_SECRET_FALLBACK = "cradlehub-attendance-v1-local-dev-only";

export function createPublicCode(prefix: "att" | "room" | "res" = "att"): string {
  return `${prefix}_${randomBytes(18).toString("base64url")}`;
}

export function createActivationToken(): string {
  return `act_${randomBytes(32).toString("base64url")}`;
}

export function createRecoveryToken(): string {
  return randomBytes(32).toString("base64url");
}

export function createDeviceCredential(): string {
  return `dev_${randomBytes(32).toString("base64url")}`;
}

export function hashSecret(raw: string): string {
  const hashPepper = process.env.ATTENDANCE_DEVICE_SECRET?.trim();
  if (!hashPepper && process.env.NODE_ENV === "production") {
    throw new Error("ATTENDANCE_DEVICE_SECRET is required in production.");
  }

  return createHash("sha256")
    .update(raw)
    .update(":")
    .update(hashPepper || LOCAL_DEVICE_SECRET_FALLBACK)
    .digest("hex");
}

export function hashRecoveryToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function maskId(value: string | null | undefined): string {
  if (!value) return "unknown";
  return value.length <= 8 ? value : `${value.slice(0, 4)}-${value.slice(-4)}`;
}
