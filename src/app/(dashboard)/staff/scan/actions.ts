"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { resolveStaffScanTarget } from "@/lib/scanner/resolve-scan-target";
import {
  createStaffScanGrant,
  readStaffScanGrant,
  STAFF_SCAN_GRANT_COOKIE,
  STAFF_SCAN_GRANT_TTL_SECONDS,
} from "@/lib/scanner/staff-scan-grant";

/** Normalize scanner input and issue a short-lived navigation intent. Attendance remains server-authorized. */
export async function resolveStaffScanTargetAction(raw: string) {
  const result = resolveStaffScanTarget(raw);
  if (result.ok && result.target === "public_scan") {
    const {
      data: { user },
    } = await (await createClient()).auth.getUser();
    if (!user) return { ok: false as const, target: "invalid" as const, reason: "unauthorized" };
    (await cookies()).set(
      STAFF_SCAN_GRANT_COOKIE,
      createStaffScanGrant(result.publicCode, user.id),
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
  // The same explicit path is required to expire a path-scoped cookie.
  cookieStore.set(STAFF_SCAN_GRANT_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/staff/scan/process",
    maxAge: 0,
  });
  const {
    data: { user },
  } = await (await createClient()).auth.getUser();
  if (!user) return null;
  return readStaffScanGrant(token, publicCode, user.id);
}
