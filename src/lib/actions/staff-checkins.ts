"use server";

import { createClient } from "@/lib/supabase/server";
import { isDevAuthBypassEnabled } from "@/lib/dev-bypass";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// ── Types ─────────────────────────────────────────────────────────────────────

export type CheckinActionResult =
  | { ok: true; id: string; status: "checked_in" | "checked_out"; alreadyCheckedIn?: boolean }
  | { ok: false; code: "UNAUTHORIZED" | "NOT_FOUND" | "CONFLICT" | "ALREADY_CHECKED_OUT" | "DB_ERROR"; message: string };

export type CheckinRecord = {
  id: string;
  staff_id: string;
  branch_id: string;
  shift_date: string;
  shift_type: string;
  checked_in_at: string;
  checked_out_at: string | null;
  status: string;
};

// ── Validation ────────────────────────────────────────────────────────────────

const checkinInputSchema = z.object({
  staffId:   z.string().uuid(),
  branchId:  z.string().uuid(),
  shiftDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "shiftDate must be YYYY-MM-DD"),
  shiftType: z.enum(["single", "opening", "closing"]).default("single"),
  notes:     z.string().max(500).optional(),
});

const checkoutInputSchema = z.object({
  staffId:   z.string().uuid(),
  shiftDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  shiftType: z.enum(["single", "opening", "closing"]).default("single"),
  notes:     z.string().max(500).optional(),
});

// ── Auth helper ───────────────────────────────────────────────────────────────

const CHECKIN_OPERATOR_ROLES = new Set([
  "owner", "manager", "assistant_manager", "store_manager", "crm", "csr_head", "csr_staff",
]);

async function getCheckinContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  if (isDevAuthBypassEnabled()) {
    return { supabase, me: { id: "dev", branch_id: "dev", system_role: "manager" } };
  }

  const { data: me } = await supabase
    .from("staff")
    .select("id, branch_id, system_role")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!me) return null;
  return { supabase, me };
}

// ── CRM / Manager: check any branch staff in ─────────────────────────────────

export async function checkInStaffForShiftAction(rawInput: unknown): Promise<CheckinActionResult> {
  const parsed = checkinInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, code: "UNAUTHORIZED", message: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const ctx = await getCheckinContext();
  if (!ctx) return { ok: false, code: "UNAUTHORIZED", message: "You must be signed in." };

  const { supabase, me } = ctx;
  const { staffId, branchId, shiftDate, shiftType, notes } = parsed.data;

  // Operator roles can check in staff within their branch.
  // Staff can also call this action to check themselves in (staffId must equal their own id).
  const isSelf = me.id === staffId;
  const isOperator = CHECKIN_OPERATOR_ROLES.has(me.system_role);

  if (!isSelf && !isOperator) {
    return { ok: false, code: "UNAUTHORIZED", message: "You do not have permission to check in other staff." };
  }

  // Branch scope: operator must be in the same branch, unless they are owner.
  if (isOperator && !isSelf && me.system_role !== "owner" && me.branch_id !== branchId) {
    return { ok: false, code: "UNAUTHORIZED", message: "You can only check in staff at your branch." };
  }

  // Check for existing record
  const { data: existing } = await supabase
    .from("staff_shift_checkins")
    .select("id, status, checked_out_at")
    .eq("staff_id", staffId)
    .eq("shift_date", shiftDate)
    .eq("shift_type", shiftType)
    .maybeSingle();

  if (existing) {
    if (existing.status === "checked_in") {
      // Already checked in — return success without duplicate insert
      return { ok: true, id: existing.id, status: "checked_in", alreadyCheckedIn: true };
    }
    if (existing.status === "checked_out") {
      return { ok: false, code: "ALREADY_CHECKED_OUT", message: "This staff member already checked out for this shift. Contact a manager to void and re-check in." };
    }
    // voided — allow a fresh check-in by falling through (insert will use a new record after voiding)
  }

  // Insert new check-in
  const { data: inserted, error } = await supabase
    .from("staff_shift_checkins")
    .insert({
      staff_id:      staffId,
      branch_id:     branchId,
      shift_date:    shiftDate,
      shift_type:    shiftType,
      status:        "checked_in",
      recorded_by:   isSelf ? null : (me.id === "dev" ? null : me.id),
      notes:         notes ?? null,
    })
    .select("id")
    .single();

  if (error) {
    // Unique constraint — treat as already checked in
    if (error.code === "23505") {
      const { data: rec } = await supabase
        .from("staff_shift_checkins")
        .select("id, status")
        .eq("staff_id", staffId)
        .eq("shift_date", shiftDate)
        .eq("shift_type", shiftType)
        .single();
      return { ok: true, id: rec?.id ?? "", status: "checked_in", alreadyCheckedIn: true };
    }
    return { ok: false, code: "DB_ERROR", message: error.message };
  }

  revalidatePath("/crm/availability");
  revalidatePath("/manager/staff-availability");
  return { ok: true, id: inserted.id, status: "checked_in" };
}

// ── CRM / Manager: check any branch staff out ────────────────────────────────

export async function checkOutStaffForShiftAction(rawInput: unknown): Promise<CheckinActionResult> {
  const parsed = checkoutInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, code: "UNAUTHORIZED", message: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const ctx = await getCheckinContext();
  if (!ctx) return { ok: false, code: "UNAUTHORIZED", message: "You must be signed in." };

  const { supabase, me } = ctx;
  const { staffId, shiftDate, shiftType } = parsed.data;

  const isSelf = me.id === staffId;
  const isOperator = CHECKIN_OPERATOR_ROLES.has(me.system_role);

  if (!isSelf && !isOperator) {
    return { ok: false, code: "UNAUTHORIZED", message: "You do not have permission to check out other staff." };
  }

  // Find the active check-in
  const { data: checkin } = await supabase
    .from("staff_shift_checkins")
    .select("id, status, branch_id")
    .eq("staff_id", staffId)
    .eq("shift_date", shiftDate)
    .eq("shift_type", shiftType)
    .maybeSingle();

  if (!checkin) {
    return { ok: false, code: "NOT_FOUND", message: "No check-in record found for this staff member and shift." };
  }

  if (checkin.status === "checked_out") {
    return { ok: true, id: checkin.id, status: "checked_out", alreadyCheckedIn: false };
  }

  // Branch scope check for operators
  if (isOperator && !isSelf && me.system_role !== "owner" && me.branch_id !== checkin.branch_id) {
    return { ok: false, code: "UNAUTHORIZED", message: "You can only check out staff at your branch." };
  }

  const { error } = await supabase
    .from("staff_shift_checkins")
    .update({ status: "checked_out", checked_out_at: new Date().toISOString() })
    .eq("id", checkin.id);

  if (error) return { ok: false, code: "DB_ERROR", message: error.message };

  revalidatePath("/crm/availability");
  revalidatePath("/manager/staff-availability");
  return { ok: true, id: checkin.id, status: "checked_out" };
}

// ── Query: get today's check-in for a single staff member ────────────────────
// Used by the staff portal page (server component) to show self check-in state.

export async function getStaffCheckinForDate(
  staffId: string,
  branchId: string,
  date: string
): Promise<CheckinRecord | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("staff_shift_checkins")
    .select("id, staff_id, branch_id, shift_date, shift_type, checked_in_at, checked_out_at, status")
    .eq("staff_id", staffId)
    .eq("branch_id", branchId)
    .eq("shift_date", date)
    .neq("status", "voided")
    .order("checked_in_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ?? null;
}

// ── Query: get all check-ins for a branch on a given date ────────────────────
// Used by getCrmAvailabilitySnapshot.

export async function getBranchCheckinsForDate(
  branchId: string,
  date: string
): Promise<CheckinRecord[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("staff_shift_checkins")
    .select("id, staff_id, branch_id, shift_date, shift_type, checked_in_at, checked_out_at, status")
    .eq("branch_id", branchId)
    .eq("shift_date", date)
    .neq("status", "voided");

  return data ?? [];
}
