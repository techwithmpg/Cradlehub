import "server-only";

import { createHash, randomBytes } from "crypto";

export const DEVICE_COOKIE_NAME = "cradle_device";
const HASH_PEPPER = process.env.ATTENDANCE_DEVICE_SECRET ?? "cradlehub-attendance-v1";

export function createPublicCode(prefix: "att" | "room" | "res" = "att"): string {
  return `${prefix}_${randomBytes(18).toString("base64url")}`;
}

export function createActivationToken(): string {
  return `act_${randomBytes(32).toString("base64url")}`;
}

export function createDeviceCredential(): string {
  return `dev_${randomBytes(32).toString("base64url")}`;
}

export function hashSecret(raw: string): string {
  return createHash("sha256")
    .update(raw)
    .update(":")
    .update(HASH_PEPPER)
    .digest("hex");
}

export function maskId(value: string | null | undefined): string {
  if (!value) return "unknown";
  return value.length <= 8 ? value : `${value.slice(0, 4)}-${value.slice(-4)}`;
}
