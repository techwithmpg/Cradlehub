import "server-only";

import { randomUUID, timingSafeEqual } from "node:crypto";
import { hashSecret } from "@/lib/attendance/tokens";

export const STAFF_SCAN_GRANT_COOKIE = "cradle_staff_scan_operation";
export const STAFF_SCAN_GRANT_TTL_SECONDS = 120;

type ScanGrant = {
  version: 1;
  publicCode: string;
  userId: string;
  operationId: string;
  expiresAt: number;
};

export function createStaffScanGrant(publicCode: string, userId: string, now = Date.now()): string {
  const payload: ScanGrant = {
    version: 1,
    publicCode,
    userId,
    operationId: randomUUID(),
    expiresAt: now + STAFF_SCAN_GRANT_TTL_SECONDS * 1000,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${hashSecret(`staff-scan-grant:${encoded}`)}`;
}

export function readStaffScanGrant(
  token: string | undefined,
  publicCode: string,
  userId: string,
  now = Date.now()
): { operationId: string } | null {
  if (!token || token.length > 2048) return null;
  const [encoded, signature, extra] = token.split(".");
  if (!encoded || !signature || extra || !/^[a-f0-9]{64}$/.test(signature)) return null;
  const expected = Buffer.from(hashSecret(`staff-scan-grant:${encoded}`), "hex");
  const actual = Buffer.from(signature, "hex");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const value = JSON.parse(Buffer.from(encoded, "base64url").toString()) as ScanGrant;
    if (
      value.version !== 1 ||
      value.publicCode !== publicCode ||
      value.userId !== userId ||
      typeof value.operationId !== "string" ||
      !/^[0-9a-f-]{36}$/.test(value.operationId) ||
      !Number.isSafeInteger(value.expiresAt) ||
      value.expiresAt <= now ||
      value.expiresAt > now + STAFF_SCAN_GRANT_TTL_SECONDS * 1000
    )
      return null;
    return { operationId: value.operationId };
  } catch {
    return null;
  }
}
