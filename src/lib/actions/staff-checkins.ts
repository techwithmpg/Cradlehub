"use server";

import { createClient } from "@/lib/supabase/server";

export type CheckinActionResult =
  | { ok: true; id: string; status: "checked_in" | "checked_out"; alreadyCheckedIn?: boolean }
  | {
      ok: false;
      code: "UNAUTHORIZED" | "NOT_FOUND" | "CONFLICT" | "ALREADY_CHECKED_OUT" | "DB_ERROR";
      message: string;
    };

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

// Legacy one-click writes have no QR, device, schedule, or geofence proof.
// Retain their server-action names for existing callers, but fail closed.
// Staff use the physical branch QR; authorized operators use audited Attendance Review.
export async function checkInStaffForShiftAction(rawInput: unknown): Promise<CheckinActionResult> {
  void rawInput;
  return {
    ok: false,
    code: "UNAUTHORIZED",
    message: "Scan the branch Attendance QR. For a correction, use CRM Attendance Review.",
  };
}

export async function checkOutStaffForShiftAction(rawInput: unknown): Promise<CheckinActionResult> {
  void rawInput;
  return {
    ok: false,
    code: "UNAUTHORIZED",
    message:
      "Scan the branch Attendance QR or use the approved Home Service clock-out. For a correction, use CRM Attendance Review.",
  };
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
    .select(
      "id, staff_id, branch_id, shift_date, shift_type, checked_in_at, checked_out_at, status"
    )
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
    .select(
      "id, staff_id, branch_id, shift_date, shift_type, checked_in_at, checked_out_at, status"
    )
    .eq("branch_id", branchId)
    .eq("shift_date", date)
    .neq("status", "voided");

  return data ?? [];
}
