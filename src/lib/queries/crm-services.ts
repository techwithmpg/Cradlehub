/**
 * Queries for the CRM Services & Therapist Setup page.
 *
 * Separate from lib/queries/branches.ts (which owns branch_services management)
 * to keep service-provider concerns isolated.
 */

import { createClient } from "@/lib/supabase/server";

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * Staff shape used by service-panel components (assignment chips, eligible
 * provider lists) AND by the CrmEditStaffProfileModal when opened from the
 * Provider Assignments tab.
 *
 * The extra fields (nickname … branches) are fetched by
 * getBranchStaffAndServiceAssignments so the edit-profile modal can open
 * without a second round-trip.  Existing callers that only used id / full_name
 * / staff_type / system_role continue to work unchanged.
 */
export type StaffForServicePanel = {
  id: string;
  full_name: string;
  staff_type: string | null;
  system_role: string;
  // Additional fields required by CrmEditStaffProfileModal
  nickname: string | null;
  phone: string | null;
  branch_id: string | null;
  tier: string;
  is_head: boolean;
  is_active: boolean;
  avatar_url: string | null;
  /** Branch relation — used by the identity card in the edit-profile modal. */
  branches: { id: string; name: string } | null;
};

export type ServiceAssignmentRow = {
  staff_id: string;
  service_id: string;
};

export type BranchStaffAndAssignments = {
  staff: StaffForServicePanel[];
  assignments: ServiceAssignmentRow[];
};

// ── Queries ───────────────────────────────────────────────────────────────────

/**
 * Returns all active branch staff and the staff_services rows for the given
 * set of global service IDs.
 *
 * Used by CrmServiceTherapistPanel to show which staff are assigned to each
 * branch service and flag services with no eligible providers.
 */
export async function getBranchStaffAndServiceAssignments(
  branchId: string,
  serviceIds: string[]
): Promise<BranchStaffAndAssignments> {
  if (serviceIds.length === 0) return { staff: [], assignments: [] };

  const supabase = await createClient();

  const [staffRes, assignRes] = await Promise.all([
    supabase
      .from("staff")
      .select(
        "id, full_name, staff_type, system_role, " +
        "nickname, phone, branch_id, tier, is_head, is_active, avatar_url, " +
        "branches(id, name)"
      )
      .eq("branch_id", branchId)
      .eq("is_active", true)
      .order("full_name"),
    supabase
      .from("staff_services")
      .select("staff_id, service_id")
      .in("service_id", serviceIds),
  ]);

  if (staffRes.error) throw new Error(staffRes.error.message);

  return {
    // Two-step cast: the Supabase inferred type for the extended select string
    // does not overlap directly with StaffForServicePanel, but the runtime
    // shape is correct (every selected column matches the type definition).
    staff: (staffRes.data ?? []) as unknown as StaffForServicePanel[],
    // Don't throw if assignment query fails — treat as empty (no assignments)
    assignments: assignRes.error
      ? []
      : ((assignRes.data ?? []) as ServiceAssignmentRow[]),
  };
}
