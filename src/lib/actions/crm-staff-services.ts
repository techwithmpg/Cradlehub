"use server";

/**
 * CRM Staff Service Assignment Actions
 *
 * Allows CRM/CSR operational roles to update staff service capabilities
 * directly from the CRM Staff workspace, scoped to their branch.
 *
 * Uses the same staff_services junction table as the owner/manager flow.
 * No new schema. No duplicate assignment system.
 */

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isDevAuthBypassEnabled, getDevBypassLayoutStaff } from "@/lib/dev-bypass";

// ── Constants ──────────────────────────────────────────────────────────────────

const CRM_STAFF_SERVICE_ROLES = new Set([
  "owner",
  "manager",
  "assistant_manager",
  "store_manager",
  "crm",
  "csr_head",
  "csr_staff",
  "csr",
]);

const HIGH_PRIVILEGE_ROLES = new Set([
  "owner",
  "manager",
  "assistant_manager",
  "store_manager",
]);

// ── Auth helper ────────────────────────────────────────────────────────────────

type StaffServiceCtx = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  me: { id: string; branch_id: string | null; system_role: string };
  isHighPrivilege: boolean;
};

async function requireCrmStaffServiceAccess(): Promise<StaffServiceCtx | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: me } = await supabase
    .from("staff")
    .select("id, branch_id, system_role")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (me && CRM_STAFF_SERVICE_ROLES.has(me.system_role as string)) {
    return {
      supabase,
      me: me as { id: string; branch_id: string | null; system_role: string },
      isHighPrivilege: HIGH_PRIVILEGE_ROLES.has(me.system_role as string),
    };
  }

  if (isDevAuthBypassEnabled()) {
    const mock = getDevBypassLayoutStaff();
    return {
      supabase,
      me: { id: "dev", branch_id: mock.branch_id, system_role: mock.system_role },
      isHighPrivilege: true,
    };
  }

  return null;
}

// ── Schema ─────────────────────────────────────────────────────────────────────
// Use z.guid() — the Zod v4-native UUID validator — consistent with the rest of
// the codebase (branch.ts, booking.ts). z.string().uuid("msg") had a Zod v4
// compatibility issue where the raw string error argument was misinterpreted,
// causing valid PostgreSQL UUID strings to fail validation.

const updateStaffServicesSchema = z.object({
  staffId: z.guid("Invalid staff ID"),
  serviceIds: z.array(z.guid("Invalid service ID")),
});

// ── Action ─────────────────────────────────────────────────────────────────────

export type CrmStaffServicesResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

/**
 * Replace all service capabilities for a staff member.
 *
 * Validates:
 * - CRM operational role
 * - Branch scope: target staff must belong to the caller's branch (non-owners)
 * - Clears then re-inserts staff_services rows
 */
export async function updateStaffServicesFromCrmAction(
  rawInput: unknown
): Promise<CrmStaffServicesResult> {
  const parsed = updateStaffServicesSchema.safeParse(rawInput);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    // Provide the path so future debugging is instant (e.g. "serviceIds[2]: Invalid service ID")
    const path = first?.path.length ? `${first.path.join(".")}: ` : "";
    return { ok: false, message: `${path}${first?.message ?? "Invalid input"}` };
  }
  const { staffId, serviceIds } = parsed.data;

  const ctx = await requireCrmStaffServiceAccess();
  if (!ctx) return { ok: false, message: "Unauthorized. CRM access is required." };

  // Branch scope check for non-owner roles
  if (!ctx.isHighPrivilege) {
    const { data: targetStaff } = await ctx.supabase
      .from("staff")
      .select("branch_id, system_role")
      .eq("id", staffId)
      .maybeSingle();

    if (!targetStaff || targetStaff.branch_id !== ctx.me.branch_id) {
      return { ok: false, message: "You can only manage staff in your own branch." };
    }
  }

  // Delete current assignments
  const { error: delErr } = await ctx.supabase
    .from("staff_services")
    .delete()
    .eq("staff_id", staffId);

  if (delErr) {
    return { ok: false, message: `Failed to update assignments: ${delErr.message}` };
  }

  // Insert new assignments (deduplicated)
  if (serviceIds.length > 0) {
    const unique = Array.from(new Set(serviceIds));
    const rows = unique.map((serviceId) => ({ staff_id: staffId, service_id: serviceId }));
    const { error: insErr } = await ctx.supabase.from("staff_services").insert(rows);
    if (insErr) {
      return { ok: false, message: `Failed to save service assignments: ${insErr.message}` };
    }
  }

  revalidatePath("/crm/staff");
  revalidatePath("/crm/services");
  revalidatePath("/crm/setup");
  revalidatePath("/owner/staff");
  revalidatePath("/manager/staff");

  return { ok: true, message: `Service capabilities updated (${serviceIds.length} assigned).` };
}
