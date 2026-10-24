import "server-only";
import type { DesktopBearerAuthResult } from "@/lib/auth/desktop-bearer-auth";

type AuthedOperator = Extract<DesktopBearerAuthResult, { ok: true }>["operator"];

const RATE_LIMIT_WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 60;

const requestTimestampsByKey = new Map<string, number[]>();

export function checkLocationRateLimit(
  key: string,
  limit = MAX_REQUESTS_PER_WINDOW,
  windowMs = RATE_LIMIT_WINDOW_MS
): boolean {
  const now = Date.now();
  const timestamps = requestTimestampsByKey.get(key) || [];
  const validTimestamps = timestamps.filter((t) => now - t < windowMs);

  if (validTimestamps.length >= limit) {
    return false;
  }

  validTimestamps.push(now);
  requestTimestampsByKey.set(key, validTimestamps);
  return true;
}

export function resetLocationRateLimits(): void {
  requestTimestampsByKey.clear();
}

export function verifyLocationBranchAccess(
  operator: AuthedOperator,
  targetBranchId?: string | null
): boolean {
  if (!targetBranchId) return true;
  if (operator.staffRole === "owner") return true;
  return operator.staff?.branch_id === targetBranchId;
}

export function sanitizeLocationQuery(query: string): string {
  return query.replace(/[\x00-\x1F\x7F]/g, "").trim();
}

export const GOOGLE_PLACES_TIMEOUT_MS = 5000;
