import "server-only";

/**
 * Server-owned scan routing seam — PWA-C6 / PWA-GOV-009
 *
 * Receives an untrusted decoded QR payload and returns only the transport
 * category. No mutation, no authorization grant, no DB lookup.
 *
 * Routing categories (per Section 2 of the C6 owner instruction):
 *   public_scan  — existing /scan/{publicCode} contract
 *   activation   — existing /scan/activate/{token} contract
 *   invalid      — unsupported or malformed payload
 *
 * Business-intent labels (attendance / room / resource / driver / provider /
 * utility) are never returned; downstream server owners resolve those.
 */

/** Public-code prefixes emitted by the repository's QR producers. */
const PUBLIC_CODE_PREFIXES = ["att_", "room_", "res_"] as const;

/** Activation token prefix emitted by createActivationToken() in tokens.ts. */
const ACTIVATION_PREFIX = "act_";

/** Dangerous URI schemes that are never permitted. */
const BLOCKED_SCHEMES = /^(javascript|data|file|vbscript):/i;

/** Allowed hostname pattern for full-URL QR payloads (approved app origin). */
function buildAllowedOrigins(): string[] {
  const origins: string[] = [];

  const candidates = [
    process.env.APP_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
  ];

  for (const value of candidates) {
    if (!value) continue;
    try {
      const normalized = /^https?:\/\//i.test(value.trim())
        ? value.trim()
        : `https://${value.trim()}`;
      const url = new URL(normalized);
      origins.push(url.origin);
    } catch {
      // skip malformed env values
    }
  }

  // Always allow localhost origins in non-production environments
  if (process.env.NODE_ENV !== "production") {
    origins.push("http://localhost:3000");
    origins.push("http://localhost");
  }

  return origins;
}

export type ScanTargetResult =
  | { ok: true; target: "public_scan"; publicCode: string }
  | { ok: true; target: "activation"; token: string }
  | { ok: false; target: "invalid"; reason: string };

/**
 * Normalizes a raw (untrusted) decoded QR string to a safe routing result.
 *
 * Only the transport identifier is extracted. The caller must delegate to
 * the existing subsystem handler; this function performs no DB lookups,
 * no auth checks, and no state mutations.
 *
 * @param raw - The decoded QR payload string (untrusted input)
 * @returns ScanTargetResult
 */
export function resolveStaffScanTarget(raw: string): ScanTargetResult {
  if (!raw || typeof raw !== "string") {
    return { ok: false, target: "invalid", reason: "empty_payload" };
  }

  const trimmed = raw.trim();

  // Reject dangerous URI schemes immediately
  if (BLOCKED_SCHEMES.test(trimmed)) {
    return { ok: false, target: "invalid", reason: "blocked_scheme" };
  }

  // --- Attempt full-URL parsing ---
  if (/^https?:\/\//i.test(trimmed)) {
    let url: URL;
    try {
      url = new URL(trimmed);
    } catch {
      return { ok: false, target: "invalid", reason: "malformed_url" };
    }

    // Reject any query-driven external destinations or nested redirects
    if (url.searchParams.has("redirect") || url.searchParams.has("next")) {
      return { ok: false, target: "invalid", reason: "redirect_param" };
    }

    const allowedOrigins = buildAllowedOrigins();
    const isSameOrigin = allowedOrigins.some(
      (origin) => url.origin.toLowerCase() === origin.toLowerCase()
    );

    if (!isSameOrigin) {
      return { ok: false, target: "invalid", reason: "foreign_origin" };
    }

    const pathname = url.pathname;

    // Match /scan/activate/{token}
    const activationMatch = pathname.match(/^\/scan\/activate\/([^/?#]+)$/);
    if (activationMatch) {
      const rawToken = activationMatch[1] ?? "";
      const token = decodeURIComponentSafe(rawToken);
      if (!token) return { ok: false, target: "invalid", reason: "malformed_token" };
      return { ok: true, target: "activation", token };
    }

    // Match /scan/{publicCode} — note: NOT /scan/activate/
    const scanMatch = pathname.match(/^\/scan\/([^/?#]+)$/);
    if (scanMatch) {
      const rawCode = scanMatch[1] ?? "";
      const publicCode = decodeURIComponentSafe(rawCode);
      if (!publicCode) return { ok: false, target: "invalid", reason: "malformed_code" };
      // Accept only known public-code prefixes from URL paths as well
      if (!isKnownPublicCode(publicCode)) {
        return { ok: false, target: "invalid", reason: "unknown_code_prefix" };
      }
      return { ok: true, target: "public_scan", publicCode };
    }

    // Unknown path on a valid origin — still invalid
    return { ok: false, target: "invalid", reason: "unknown_path" };
  }

  // --- Attempt raw identifier parsing ---
  // Only accept raw identifiers with proven prefixes from repository producers

  // Known public-code prefixes: att_, room_, res_
  if (isKnownPublicCode(trimmed)) {
    return { ok: true, target: "public_scan", publicCode: trimmed };
  }

  // Activation token raw form: act_
  // Proven by createActivationToken() in src/lib/attendance/tokens.ts
  if (trimmed.startsWith(ACTIVATION_PREFIX)) {
    return { ok: true, target: "activation", token: trimmed };
  }

  // Arbitrary raw recovery tokens (random 32-byte hex without a prefix) are
  // not accepted raw. They are only valid when embedded in a full activation URL.
  return { ok: false, target: "invalid", reason: "unrecognized_payload" };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isKnownPublicCode(value: string): boolean {
  return PUBLIC_CODE_PREFIXES.some((prefix) => value.startsWith(prefix));
}

function decodeURIComponentSafe(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}
