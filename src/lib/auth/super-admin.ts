/**
 * Super-admin privileged access.
 *
 * User IDs in SUPER_ADMIN_USER_IDS receive owner-level access across all
 * CradleHub workspaces — even if they have no staff record assigned. This
 * allows trusted developers and system administrators to test every flow
 * in any environment.
 *
 * Safety guarantees:
 *  - Branch IDs are always resolved from the real `branches` table.
 *  - No fake UUIDs, no FK-bypassing, no `any` casts.
 *  - Normal production RBAC is unaffected for all other users.
 */

import { createClient } from "@/lib/supabase/server";

// ── Constants ──────────────────────────────────────────────────────────────

export const SUPER_ADMIN_USER_IDS = [
  "6a185419-9a9f-45b5-967a-2f67db9b5d26",
] as const;

export const SUPER_ADMIN_EMAILS = [
  "techwithmpg@gmail.com",
] as const;

// ── Types ──────────────────────────────────────────────────────────────────

export type SuperAdminContext = {
  /** Staff record ID when a matching staff row exists; auth user ID otherwise (safe for logging only). */
  id: string;
  /** Always a real UUID from public.branches — never a placeholder. */
  branch_id: string;
  system_role: "owner";
  full_name: string;
  branches: { name: string } | null;
};

// ── Helpers ────────────────────────────────────────────────────────────────

export function isSuperAdmin(userId: string): boolean {
  return (SUPER_ADMIN_USER_IDS as readonly string[]).includes(userId);
}

/**
 * Resolves a privileged owner-level context for super-admin user IDs.
 *
 * Resolution order:
 *   1. Uses the user's own staff record (if one exists and has a branch).
 *   2. Falls back to the first active branch in the `branches` table.
 *
 * Returns null when:
 *   - The user ID is not in SUPER_ADMIN_USER_IDS, or
 *   - No active branches exist in the database.
 */
export async function resolveSuperAdminContext(
  userId: string
): Promise<SuperAdminContext | null> {
  if (!isSuperAdmin(userId)) return null;

  const supabase = await createClient();

  // Prefer the user's own staff record if it has a valid branch.
  const { data: staff } = await supabase
    .from("staff")
    .select("id, full_name, branch_id, branches(name)")
    .eq("auth_user_id", userId)
    .maybeSingle();

  if (staff?.branch_id) {
    return {
      id: staff.id,
      branch_id: staff.branch_id as string,
      system_role: "owner",
      full_name: staff.full_name,
      branches: (staff.branches as { name: string } | null),
    };
  }

  // No staff record — use the first real active branch.
  const { data: branches } = await supabase
    .from("branches")
    .select("id, name")
    .eq("is_active", true)
    .order("name")
    .limit(1);

  const firstBranch = branches?.[0];
  if (!firstBranch) return null;

  return {
    id: userId,
    branch_id: firstBranch.id,
    system_role: "owner",
    full_name: "Admin",
    branches: { name: firstBranch.name },
  };
}

/**
 * Resolves the first real active branch ID for dev-bypass contexts.
 * Prevents the dev bypass from using the fake "00000000-..." placeholder UUID.
 * Returns null if no active branches exist.
 */
export async function resolveDevBypassBranchId(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("branches")
    .select("id")
    .eq("is_active", true)
    .order("name")
    .limit(1);
  return data?.[0]?.id ?? null;
}
