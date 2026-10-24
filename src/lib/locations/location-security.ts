import "server-only";
import type { DesktopBearerAuthResult } from "@/lib/auth/desktop-bearer-auth";

type AuthedOperator = Extract<DesktopBearerAuthResult, { ok: true }>["operator"];

export const RATE_LIMIT_WINDOW_MS = 60_000;
export const MAX_REQUESTS_PER_WINDOW = 60;
export const GOOGLE_PLACES_TIMEOUT_MS = 5000;

/**
 * BLOCKER DOCUMENTATION:
 * Shared, distributed rate limiting across multi-instance production deployments
 * requires an external distributed key-value store (e.g. Upstash Redis / Cloudflare KV)
 * or a dedicated schema migration (e.g. a `location_rate_limits` table with an atomic sliding-window RPC).
 *
 * Under strict repository governance ("no schema/production-data mutation without explicit
 * target-aware authorization" and "do not silently add Redis, paid infrastructure, new database
 * tables or migrations without permission"), no unapproved infrastructure or migrations
 * have been created.
 *
 * Instead, this module establishes a formal DistributedRateLimiter contract.
 * In production environments, if a distributed provider is unconfigured or fails,
 * requests fail closed with a 503 RATE_LIMITER_UNAVAILABLE response to strictly prevent
 * unbounded or unmonitored charges against Google Places/Routes APIs.
 * In test/dev environments, a robust, concurrency-safe in-memory adapter is provided
 * to allow full local validation and deterministic testing.
 */

export interface DistributedRateLimiter {
  check(
    key: string,
    limit: number,
    windowMs: number
  ): Promise<{ allowed: boolean; code?: string; error?: string }>;
  reset?(): Promise<void> | void;
}

export type LocationRateLimitResult = {
  allowed: boolean;
  code?: "RATE_LIMIT_EXCEEDED" | "RATE_LIMITER_UNAVAILABLE";
  error?: string;
};

// In-memory sliding-window adapter for test/development execution
class InMemoryTestRateLimiter implements DistributedRateLimiter {
  private timestampsByKey = new Map<string, number[]>();

  async check(
    key: string,
    limit: number,
    windowMs: number
  ): Promise<{ allowed: boolean; code?: string; error?: string }> {
    const now = Date.now();
    const timestamps = this.timestampsByKey.get(key) || [];
    const validTimestamps = timestamps.filter((t) => now - t < windowMs);

    if (validTimestamps.length >= limit) {
      this.timestampsByKey.set(key, validTimestamps);
      return {
        allowed: false,
        code: "RATE_LIMIT_EXCEEDED",
        error: "Too many location requests. Please wait a moment and try again.",
      };
    }

    validTimestamps.push(now);
    this.timestampsByKey.set(key, validTimestamps);
    return { allowed: true };
  }

  reset(): void {
    this.timestampsByKey.clear();
  }
}

let activeDistributedLimiter: DistributedRateLimiter | null = null;
const defaultTestLimiter = new InMemoryTestRateLimiter();

export function setDistributedRateLimiter(limiter: DistributedRateLimiter | null): void {
  activeDistributedLimiter = limiter;
}

export function resetLocationRateLimits(): void {
  defaultTestLimiter.reset();
  if (activeDistributedLimiter?.reset) {
    activeDistributedLimiter.reset();
  }
}

export async function checkLocationRateLimit(
  key: string,
  limit = MAX_REQUESTS_PER_WINDOW,
  windowMs = RATE_LIMIT_WINDOW_MS
): Promise<LocationRateLimitResult> {
  const isProduction = process.env.NODE_ENV === "production";
  const allowDevFallback = process.env.ALLOW_IN_MEMORY_RATE_LIMIT_FOR_TESTS === "true" || !isProduction;

  const limiter = activeDistributedLimiter || (allowDevFallback ? defaultTestLimiter : null);

  if (!limiter) {
    return {
      allowed: false,
      code: "RATE_LIMITER_UNAVAILABLE",
      error:
        "Distributed rate limiting infrastructure is not configured. Requests are safely rejected to protect Google API quotas.",
    };
  }

  try {
    const result = await limiter.check(key, limit, windowMs);
    if (!result.allowed) {
      return {
        allowed: false,
        code: (result.code as "RATE_LIMIT_EXCEEDED" | "RATE_LIMITER_UNAVAILABLE") || "RATE_LIMIT_EXCEEDED",
        error: result.error || "Too many requests. Please wait a moment and try again.",
      };
    }
    return { allowed: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Rate limiter error";
    return {
      allowed: false,
      code: "RATE_LIMITER_UNAVAILABLE",
      error: `Distributed rate limiter failed: ${message}`,
    };
  }
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
