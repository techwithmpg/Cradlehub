"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashSecret } from "@/lib/attendance/tokens";
import { resolveStaffScanTarget } from "@/lib/scanner/resolve-scan-target";
import {
  createStaffScanGrant,
  readStaffScanGrant,
  STAFF_SCAN_GRANT_COOKIE,
  STAFF_SCAN_GRANT_TTL_SECONDS,
} from "@/lib/scanner/staff-scan-grant";

async function expireStaffScanGrantCookie() {
  // The same explicit path is required to expire a path-scoped cookie.
  (await cookies()).set(STAFF_SCAN_GRANT_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/staff/scan/process",
    maxAge: 0,
  });
}

/** Normalize scanner input and issue a short-lived navigation intent. Attendance remains server-authorized. */
export async function resolveStaffScanTargetAction(raw: string) {
  const result = resolveStaffScanTarget(raw);
  if (result.ok && result.target === "public_scan" && result.publicCode.startsWith("att_")) {
    const {
      data: { user },
    } = await (await createClient()).auth.getUser();
    if (!user) return { ok: false as const, target: "invalid" as const, reason: "unauthorized" };
    const now = Date.now();
    const token = createStaffScanGrant(result.publicCode, user.id, now);
    const grant = readStaffScanGrant(token, result.publicCode, user.id, now);
    if (!grant) return { ok: false as const, target: "invalid" as const, reason: "grant_invalid" };
    let issued = false;
    try {
      const { error } = await createAdminClient().from("staff_scan_grants").insert({
        token_hash: hashSecret(token),
        user_id: user.id,
        public_code: result.publicCode,
        operation_id: grant.operationId,
        expires_at: new Date(now + STAFF_SCAN_GRANT_TTL_SECONDS * 1000).toISOString(),
      });
      issued = !error;
    } catch {
      // Storage failure leaves navigation manual-only after clearing any older grant.
    }
    if (!issued) {
      // Clear any older unclaimed grant before allowing a manual-only fallback.
      await expireStaffScanGrantCookie();
      return result;
    }
    (await cookies()).set(
      STAFF_SCAN_GRANT_COOKIE,
      token,
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/staff/scan/process",
        maxAge: STAFF_SCAN_GRANT_TTL_SECONDS,
      }
    );
  }
  return result;
}

/** Consume the browser's scanner navigation intent before any GPS or attendance work. */
export async function claimStaffScanGrantAction(publicCode: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get(STAFF_SCAN_GRANT_COOKIE)?.value;
  if (!token) return null;
  await expireStaffScanGrantCookie();
  const {
    data: { user },
  } = await (await createClient()).auth.getUser();
  if (!user) return null;
  const grant = readStaffScanGrant(token, publicCode, user.id);
  if (!grant) return null;
  const { data, error } = await createAdminClient().rpc("claim_staff_scan_grant", {
    p_token_hash: hashSecret(token),
    p_user_id: user.id,
    p_public_code: publicCode,
    p_operation_id: grant.operationId,
  });
  if (error || data !== grant.operationId) return null;
  return grant;
}
