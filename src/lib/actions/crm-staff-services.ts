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
import {
  CRM_STAFF_SERVICE_ROLES,
  canManageStaffServices,
  canManageStaffServicesAcrossBranches,
} from "@/lib/auth/crm-permissions";

// ── Constants ──────────────────────────────────────────────────────────────────

const CRM_STAFF_SERVICE_ROLE_SET = new Set<string>(CRM_STAFF_SERVICE_ROLES);

// ── Auth helper ────────────────────────────────────────────────────────────────

type StaffServiceCtx = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  me: { id: string; branch_id: string | null; system_role: string };
  canManageAcrossBranches: boolean;
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

  if (me && canManageStaffServices(me.system_role as string)) {
    return {
      supabase,
      me: me as { id: string; branch_id: string | null; system_role: string },
      canManageAcrossBranches: canManageStaffServicesAcrossBranches(
        me.system_role as string
      ),
    };
  }

  if (isDevAuthBypassEnabled()) {
    const mock = getDevBypassLayoutStaff();
    return {
      supabase,
      me: { id: "dev", branch_id: mock.branch_id, system_role: mock.system_role },
      canManageAcrossBranches: canManageStaffServicesAcrossBranches(
        mock.system_role
      ),
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
  | { ok: true; message: string; serviceIds: string[] }
  | {
      ok: false;
      message: string;
      code:
        | "INVALID_INPUT"
        | "UNAUTHORIZED"
        | "BRANCH_MISMATCH"
        | "INVALID_SERVICE"
        | "SAVE_FAILED";
    };

type StaffServiceRpcError = {
  code?: string;
  message?: string;
  details?: string | null;
};

type StaffServiceRpcRow = {
  service_id: string;
};

const SAFE_SAVE_FAILED_MESSAGE =
  "We could not save the selected services. Your previous assignments were not changed.";

function mapStaffServiceRpcError(error: StaffServiceRpcError): {
  code: Extract<CrmStaffServicesResult, { ok: false }>["code"];
  message: string;
} {
  const message = error.message ?? "";
  if (
    message.includes("crm_staff_services_branch_mismatch") ||
    message.includes("crm_staff_services_privileged_target")
  ) {
    return {
      code: "BRANCH_MISMATCH",
      message: "You do not have permission to update service assignments for this branch.",
    };
  }

  if (message.includes("crm_staff_services_invalid_service")) {
    return {
      code: "INVALID_SERVICE",
      message:
        "One or more selected services are not active for this staff member's branch.",
    };
  }

  if (
    message.includes("crm_staff_services_not_authenticated") ||
    message.includes("crm_staff_services_not_authorized")
  ) {
    return {
      code: "UNAUTHORIZED",
      message: "Unauthorized. CRM access is required.",
    };
  }

  return { code: "SAVE_FAILED", message: SAFE_SAVE_FAILED_MESSAGE };
}

/**
 * Replace all service capabilities for a staff member.
 *
 * Validates:
 * - CRM operational role
 * - Branch scope: target staff must belong to the caller's branch (non-owners)
 * - Delegates replacement to the transactional staff_services RPC
 */
export async function updateStaffServicesFromCrmAction(
  rawInput: unknown
): Promise<CrmStaffServicesResult> {
  const parsed = updateStaffServicesSchema.safeParse(rawInput);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    // Provide the path so future debugging is instant (e.g. "serviceIds[2]: Invalid service ID")
    const path = first?.path.length ? `${first.path.join(".")}: ` : "";
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: `${path}${first?.message ?? "Invalid input"}`,
    };
  }
  const { staffId } = parsed.data;
  const serviceIds = Array.from(new Set(parsed.data.serviceIds));

  const ctx = await requireCrmStaffServiceAccess();
  if (!ctx) {
    return {
      ok: false,
      code: "UNAUTHORIZED",
      message: "Unauthorized. CRM access is required.",
    };
  }

  if (!CRM_STAFF_SERVICE_ROLE_SET.has(ctx.me.system_role)) {
    return {
      ok: false,
      code: "UNAUTHORIZED",
      message: "Unauthorized. CRM access is required.",
    };
  }

  const { data: targetStaff, error: targetStaffError } = await ctx.supabase
    .from("staff")
    .select("branch_id, system_role")
    .eq("id", staffId)
    .maybeSingle();

  if (targetStaffError) {
    console.error("[crm/staff-services] target staff lookup failed", {
      operation: "select",
      table: "staff",
      errorCode: targetStaffError.code,
      safeMessage: "target staff lookup failed",
      staffId,
      actorRole: ctx.me.system_role,
      branchId: ctx.me.branch_id,
    });
    return { ok: false, code: "SAVE_FAILED", message: SAFE_SAVE_FAILED_MESSAGE };
  }

  if (!targetStaff) {
    return {
      ok: false,
      code: "BRANCH_MISMATCH",
      message: "You do not have permission to update service assignments for this branch.",
    };
  }

  if (
    !ctx.canManageAcrossBranches &&
    (!ctx.me.branch_id || targetStaff.branch_id !== ctx.me.branch_id)
  ) {
    return {
      ok: false,
      code: "BRANCH_MISMATCH",
      message: "You do not have permission to update service assignments for this branch.",
    };
  }

  if (
    !ctx.canManageAcrossBranches &&
    ["owner", "manager", "assistant_manager", "store_manager"].includes(
      targetStaff.system_role as string
    )
  ) {
    return {
      ok: false,
      code: "BRANCH_MISMATCH",
      message: "You do not have permission to update service assignments for this staff member.",
    };
  }

  const { data, error } = await ctx.supabase.rpc(
    "replace_staff_service_capabilities",
    {
      p_target_staff_id: staffId,
      p_service_ids: serviceIds,
    }
  );

  if (error) {
    console.error("[crm/staff-services] atomic replace failed", {
      operation: "rpc",
      table: "staff_services",
      rpc: "replace_staff_service_capabilities",
      errorCode: error.code,
      safeMessage: "staff service capability replacement failed",
      branchId: targetStaff.branch_id,
      staffId,
      actorRole: ctx.me.system_role,
    });
    const mapped = mapStaffServiceRpcError(error);
    return { ok: false, ...mapped };
  }

  const savedServiceIds = ((data ?? []) as StaffServiceRpcRow[]).map(
    (row) => row.service_id
  );

  revalidatePath("/crm/staff");
  revalidatePath("/crm/services");
  revalidatePath("/crm/setup");
  revalidatePath("/crm/today");
  revalidatePath("/book");
  revalidatePath("/services");
  revalidatePath("/owner/staff");
  revalidatePath("/manager/staff");

  return {
    ok: true,
    message: `Service capabilities updated (${savedServiceIds.length} assigned).`,
    serviceIds: savedServiceIds,
  };
}
