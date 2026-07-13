"use server";

import { createClient } from "@/lib/supabase/server";
import { isDevAuthBypassEnabled } from "@/lib/dev-bypass";
import { revalidatePath } from "next/cache";
import { invalidateCrmWorkspace, invalidateManagerWorkspace } from "@/lib/cache/cache-tags";
import { z } from "zod";
import { canAccessCrmWorkspace } from "@/lib/auth/crm-permissions";

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
// branchId is intentionally NOT in the client input — the server resolves it
// from the authenticated operator's own staff record. This prevents branchId
// mismatch bugs (empty string, dev bypass UUID vs real UUID, etc.).

const checkinInputSchema = z.object({
  staffId:   z.string().uuid(),
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

type CheckinContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  me: { id: string; branch_id: string; system_role: string };
};

async function getCheckinContext(): Promise<CheckinContext | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Dev bypass: no real Supabase session, so DB operations won't work.
  // Return early so callers get a clear error rather than an RLS failure.
  if (isDevAuthBypassEnabled()) return null;

  const { data: me } = await supabase
    .from("staff")
    .select("id, branch_id, system_role")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!me?.branch_id) return null;
  return { supabase, me: { id: me.id, branch_id: me.branch_id, system_role: me.system_role } };
}

// ── Check-in ──────────────────────────────────────────────────────────────────

export async function checkInStaffForShiftAction(rawInput: unknown): Promise<CheckinActionResult> {
  const parsed = checkinInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, code: "UNAUTHORIZED", message: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const ctx = await getCheckinContext();
  if (!ctx) return { ok: false, code: "UNAUTHORIZED", message: "You must be signed in with an active staff account." };

  const { supabase, me } = ctx;
  const { staffId, shiftDate, shiftType, notes } = parsed.data;

  // branchId is always resolved from the operator's own staff record — never from the client.
  const effectiveBranchId = me.branch_id;

  const isSelf     = me.id === staffId;
  const isOperator = canAccessCrmWorkspace(me.system_role);

  if (!isSelf && !isOperator) {
    return { ok: false, code: "UNAUTHORIZED", message: "You do not have permission to check in other staff." };
  }

  // Check for existing record for this staff / date / shift
  const { data: existing } = await supabase
    .from("staff_shift_checkins")
    .select("id, status")
    .eq("staff_id", staffId)
    .eq("shift_date", shiftDate)
    .eq("shift_type", shiftType)
    .maybeSingle();

  if (existing) {
    if (existing.status === "checked_in") {
      return { ok: true, id: existing.id, status: "checked_in", alreadyCheckedIn: true };
    }
    if (existing.status === "checked_out") {
      return { ok: false, code: "ALREADY_CHECKED_OUT", message: "Already checked out for this shift. A manager must void the record before re-checking in." };
    }
    // voided — fall through to insert a fresh record
  }

  const { data: inserted, error } = await supabase
    .from("staff_shift_checkins")
    .insert({
      staff_id:    staffId,
      branch_id:   effectiveBranchId,
      shift_date:  shiftDate,
      shift_type:  shiftType,
      status:      "checked_in",
      recorded_by: isSelf ? null : me.id,
      notes:       notes ?? null,
    })
    .select("id")
    .single();

  if (error) {
    // Unique constraint violation — a record was created concurrently; read and return it.
    if (error.code === "23505") {
      const { data: rec } = await supabase
        .from("staff_shift_checkins")
        .select("id, status")
        .eq("staff_id", staffId)
        .eq("shift_date", shiftDate)
        .eq("shift_type", shiftType)
        .maybeSingle();
      return { ok: true, id: rec?.id ?? "", status: "checked_in", alreadyCheckedIn: true };
    }
    return { ok: false, code: "DB_ERROR", message: error.message };
  }

  revalidatePath("/crm/schedule");
  revalidatePath("/manager/staff-availability");
  invalidateCrmWorkspace(effectiveBranchId);
  invalidateManagerWorkspace(effectiveBranchId);
  return { ok: true, id: inserted.id, status: "checked_in" };
}

// ── Check-out ─────────────────────────────────────────────────────────────────

export async function checkOutStaffForShiftAction(rawInput: unknown): Promise<CheckinActionResult> {
  const parsed = checkoutInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, code: "UNAUTHORIZED", message: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const ctx = await getCheckinContext();
  if (!ctx) return { ok: false, code: "UNAUTHORIZED", message: "You must be signed in with an active staff account." };

  const { supabase, me } = ctx;
  const { staffId, shiftDate, shiftType } = parsed.data;

  const isSelf     = me.id === staffId;
  const isOperator = canAccessCrmWorkspace(me.system_role);

  if (!isSelf && !isOperator) {
    return { ok: false, code: "UNAUTHORIZED", message: "You do not have permission to check out other staff." };
  }

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

  const { error } = await supabase
    .from("staff_shift_checkins")
    .update({ status: "checked_out", checked_out_at: new Date().toISOString() })
    .eq("id", checkin.id);

  if (error) return { ok: false, code: "DB_ERROR", message: error.message };

  revalidatePath("/crm/schedule");
  revalidatePath("/manager/staff-availability");
  invalidateCrmWorkspace(checkin.branch_id);
  invalidateManagerWorkspace(checkin.branch_id);
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
