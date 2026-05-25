"use server";

/**
 * CRM Service Provider Assignment Actions
 *
 * MVP Note: CRM setup roles (owner, manager, crm, csr_head) are permitted to
 * manage service-provider assignments so daily operations can start immediately.
 * Once the system is stable, this permission can be tightened to manager/owner only.
 *
 * Architecture: updates the existing staff_services junction table.
 * Does NOT create a duplicate assignment system.
 * Does NOT change online booking, in-house booking, or home-service logic.
 */

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isDevAuthBypassEnabled, getDevBypassLayoutStaff } from "@/lib/dev-bypass";
import { SERVICE_STAFF_TYPES } from "@/constants/staff-roles";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ActionResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

// ── Constants ─────────────────────────────────────────────────────────────────

/** Roles allowed to manage provider assignments from the CRM workspace (MVP). */
const CRM_SETUP_ROLES = new Set([
  "owner",
  "manager",
  "assistant_manager",
  "store_manager",
  "crm",
  "csr_head",
]);

/** System roles that can never be service providers, regardless of staff_services entries. */
const HARD_EXCLUDED_SYSTEM_ROLES = new Set(["driver", "utility"]);

/** Staff types that are valid service providers. */
const SERVICE_STAFF_TYPE_SET = new Set<string>(SERVICE_STAFF_TYPES);

// ── Auth context helper ───────────────────────────────────────────────────────

type CrmSetupContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  branchId: string;
  systemRole: string;
};

async function requireCrmSetupAccess(): Promise<CrmSetupContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  if (isDevAuthBypassEnabled()) {
    const mock = getDevBypassLayoutStaff();
    return {
      supabase,
      branchId: mock.branch_id,
      systemRole: mock.system_role,
    };
  }

  const { data: me } = await supabase
    .from("staff")
    .select("branch_id, system_role")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!me || !me.branch_id || !CRM_SETUP_ROLES.has(me.system_role)) return null;

  return {
    supabase,
    branchId: me.branch_id as string,
    systemRole: me.system_role as string,
  };
}

// ── Zod schemas ───────────────────────────────────────────────────────────────

const assignSchema = z.object({
  branchId: z.string().uuid("Invalid branch ID"),
  serviceId: z.string().uuid("Invalid service ID"),
  staffId: z.string().uuid("Invalid staff ID"),
});

const removeSchema = z.object({
  branchId: z.string().uuid("Invalid branch ID"),
  serviceId: z.string().uuid("Invalid service ID"),
  staffId: z.string().uuid("Invalid staff ID"),
});

// ── Helper: is a staff row a valid service provider? ──────────────────────────

type StaffEligibility = {
  is_active: boolean;
  staff_type: string;
  system_role: string;
  branch_id: string;
};

function isValidServiceProvider(s: StaffEligibility): boolean {
  if (!s.is_active) return false;
  if (HARD_EXCLUDED_SYSTEM_ROLES.has(s.system_role)) return false;
  return SERVICE_STAFF_TYPE_SET.has(s.staff_type);
}

// ── Actions ───────────────────────────────────────────────────────────────────

/**
 * Assign a staff member as a service provider for a given service.
 *
 * Validates:
 * - CRM setup role
 * - Branch scope (user's branch === input branchId)
 * - Service is active for the branch
 * - Staff belongs to the branch, is active, has valid staff_type, not hard-excluded
 * - No duplicate assignment (idempotent — returns ok if already assigned)
 */
export async function assignProviderToServiceAction(
  rawInput: unknown
): Promise<ActionResult> {
  const parsed = assignSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  const { branchId, serviceId, staffId } = parsed.data;

  const ctx = await requireCrmSetupAccess();
  if (!ctx) {
    return {
      ok: false,
      message: "Unauthorized. CRM setup access is required to manage provider assignments.",
    };
  }

  // Branch scope: the action must target the caller's own branch
  if (ctx.branchId !== branchId) {
    return {
      ok: false,
      message: "You can only manage assignments for your own branch.",
    };
  }

  // Verify the service is active for this branch
  const { data: branchService, error: bsErr } = await ctx.supabase
    .from("branch_services")
    .select("id")
    .eq("branch_id", branchId)
    .eq("service_id", serviceId)
    .eq("is_active", true)
    .maybeSingle();

  if (bsErr || !branchService) {
    return {
      ok: false,
      message: "This service is not active for your branch. Only active branch services can have providers assigned.",
    };
  }

  // Verify the staff member's eligibility
  const { data: staff, error: sErr } = await ctx.supabase
    .from("staff")
    .select("id, is_active, staff_type, system_role, branch_id")
    .eq("id", staffId)
    .maybeSingle();

  if (sErr || !staff) {
    return { ok: false, message: "Staff member not found." };
  }
  if (staff.branch_id !== branchId) {
    return {
      ok: false,
      message: "This staff member does not belong to your branch.",
    };
  }
  if (!isValidServiceProvider(staff as StaffEligibility)) {
    if (!staff.is_active) {
      return {
        ok: false,
        message: "Inactive staff cannot be assigned as service providers.",
      };
    }
    if (HARD_EXCLUDED_SYSTEM_ROLES.has(staff.system_role as string)) {
      return {
        ok: false,
        message: "Drivers and utility staff cannot be assigned as service providers.",
      };
    }
    return {
      ok: false,
      message:
        "This staff member is not eligible to provide services. Only therapists, nail technicians, aestheticians, and salon heads can be assigned.",
    };
  }

  // Idempotency check — avoid duplicate assignment
  const { data: existing } = await ctx.supabase
    .from("staff_services")
    .select("id")
    .eq("staff_id", staffId)
    .eq("service_id", serviceId)
    .maybeSingle();

  if (existing) {
    return { ok: true, message: "This provider is already assigned to the service." };
  }

  // Insert the assignment
  const { error: insertErr } = await ctx.supabase
    .from("staff_services")
    .insert({ staff_id: staffId, service_id: serviceId });

  if (insertErr) {
    console.error("[crm/services] assign provider failed", {
      staffId,
      serviceId,
      branchId,
      error: insertErr.message,
    });
    return {
      ok: false,
      message: "Failed to assign provider. Please try again.",
    };
  }

  revalidatePath("/crm/services");
  revalidatePath("/crm/setup");
  revalidatePath("/crm/today");

  return { ok: true, message: "Provider assigned successfully." };
}

/**
 * Remove a staff member as a service provider for a given service.
 *
 * Validates:
 * - CRM setup role + branch scope
 * - Last-provider protection: blocks removal if this is the last valid provider
 *   for a public active service (prevents breaking the online booking wizard)
 */
export async function removeProviderFromServiceAction(
  rawInput: unknown
): Promise<ActionResult> {
  const parsed = removeSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  const { branchId, serviceId, staffId } = parsed.data;

  const ctx = await requireCrmSetupAccess();
  if (!ctx) {
    return {
      ok: false,
      message: "Unauthorized. CRM setup access is required to manage provider assignments.",
    };
  }

  if (ctx.branchId !== branchId) {
    return {
      ok: false,
      message: "You can only manage assignments for your own branch.",
    };
  }

  // ── Last-provider protection for public active services ──
  const { data: branchService } = await ctx.supabase
    .from("branch_services")
    .select("is_active, visibility, booking_visibility")
    .eq("branch_id", branchId)
    .eq("service_id", serviceId)
    .maybeSingle();

  if (branchService?.is_active) {
    const visibility =
      (branchService.visibility as string) ||
      (branchService.booking_visibility as string) ||
      "public";

    if (visibility === "public") {
      // Fetch all current assignments for this service
      const { data: allAssigned } = await ctx.supabase
        .from("staff_services")
        .select("staff_id")
        .eq("service_id", serviceId);

      const otherAssignedIds = (allAssigned ?? [])
        .map((r) => r.staff_id as string)
        .filter((id) => id !== staffId);

      if (otherAssignedIds.length === 0) {
        // staffId is the only one assigned — would leave service with zero providers
        return {
          ok: false,
          message:
            "Cannot remove this provider — this is the last provider assigned to a public active service. " +
            "Customers would not be able to select a therapist for this service in online booking. " +
            "Assign another provider first, or change the service visibility to CSR Only before removing.",
        };
      }

      // Check if any remaining providers are actually valid
      const { data: remainingStaff } = await ctx.supabase
        .from("staff")
        .select("id, is_active, staff_type, system_role, branch_id")
        .in("id", otherAssignedIds);

      const validRemaining = (remainingStaff ?? []).filter((s) =>
        isValidServiceProvider(s as StaffEligibility)
      );

      if (validRemaining.length === 0) {
        return {
          ok: false,
          message:
            "Cannot remove this provider — no other valid providers would remain for this public active service. " +
            "The remaining assigned staff do not have eligible service provider types. " +
            "Assign a qualified provider first before removing this one.",
        };
      }
    }
  }
  // ── End last-provider protection ──

  // Delete the assignment
  const { error: deleteErr } = await ctx.supabase
    .from("staff_services")
    .delete()
    .eq("staff_id", staffId)
    .eq("service_id", serviceId);

  if (deleteErr) {
    console.error("[crm/services] remove provider failed", {
      staffId,
      serviceId,
      branchId,
      error: deleteErr.message,
    });
    return { ok: false, message: "Failed to remove provider. Please try again." };
  }

  revalidatePath("/crm/services");
  revalidatePath("/crm/setup");
  revalidatePath("/crm/today");

  return { ok: true, message: "Provider removed." };
}
