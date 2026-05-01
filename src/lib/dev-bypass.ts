/**
 * Development authentication bypass.
 *
 * NEVER use this in production. This helper is strictly for local development
 * when you need to test dashboard pages without a linked staff record.
 *
 * Required env:
 *   NODE_ENV !== "production"
 *   DEV_AUTH_BYPASS="true"        (preferred)
 *   DEV_ALLOW_ALL_MODULES="true"  (legacy, still supported)
 */

export function isDevAuthBypassEnabled(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    (process.env.DEV_AUTH_BYPASS === "true" ||
      process.env.DEV_ALLOW_ALL_MODULES === "true")
  );
}

/**
 * Mock staff profile used by the dashboard layout when dev bypass is active
 * but no real staff record exists.
 */
export function getDevBypassLayoutStaff(): {
  full_name: string;
  system_role: string;
  branch_id: string;
  branches: { name: string };
} {
  return {
    full_name: process.env.DEV_BYPASS_USER_NAME ?? "Dev User",
    system_role: "owner",
    branch_id: "00000000-0000-0000-0000-000000000000",
    branches: { name: process.env.DEV_BYPASS_BRANCH_NAME ?? "Dev Branch" },
  };
}

/**
 * Mock staff record used by staff-portal actions when dev bypass is active
 * but no real staff record exists.
 */
export function getDevBypassStaffRecord(): {
  id: string;
  full_name: string;
  tier: string;
  system_role: string;
  staff_type: string;
  branch_id: string;
} {
  return {
    id: "00000000-0000-0000-0000-000000000000",
    full_name: process.env.DEV_BYPASS_USER_NAME ?? "Dev User",
    tier: "senior",
    system_role: "staff",
    staff_type: "therapist",
    branch_id: "00000000-0000-0000-0000-000000000000",
  };
}

/**
 * Helpful error message for dev mode when auth fails.
 */
export function devBypassAuthMessage(fallback = "Unauthorized"): string {
  if (isDevAuthBypassEnabled()) {
    return (
      "Dev bypass is active, but no staff profile is linked to this user. " +
      "Create a staff record in Supabase or set DEV_AUTH_BYPASS=true to test with mock data."
    );
  }
  return fallback;
}
