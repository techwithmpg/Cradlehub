/**
 * Queries for the CRM Services & Therapist Setup page.
 *
 * Separate from lib/queries/branches.ts (which owns branch_services management)
 * to keep service-provider concerns isolated.
 */

import { createClient } from "@/lib/supabase/server";

// ── Types ─────────────────────────────────────────────────────────────────────

export type StaffForServicePanel = {
  id: string;
  full_name: string;
  staff_type: string | null;
  system_role: string;
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
      .select("id, full_name, staff_type, system_role")
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
    staff: (staffRes.data ?? []) as StaffForServicePanel[],
    // Don't throw if assignment query fails — treat as empty (no assignments)
    assignments: assignRes.error
      ? []
      : ((assignRes.data ?? []) as ServiceAssignmentRow[]),
  };
}
