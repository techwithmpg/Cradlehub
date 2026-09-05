"use server";

import { createClient } from "@/lib/supabase/server";
import { canonicalizeSystemRole } from "@/constants/staff";
import {
  executeInhouseBookingCreation,
  type CreateInhouseBookingResult,
  type InhouseBookingOperator,
} from "@/lib/bookings/inhouse-booking-engine";

type StaffAuthContext = {
  id: string;
  branch_id: string | null;
  system_role: string;
};

/**
 * Hosted CRM Server Action entry point.
 * Preserves the exact cookie-authenticated workflow used by the hosted CRM UI.
 * Delegates domain execution to the shared server-only booking engine.
 *
 * Inhouse CRM booking requirements:
 * - MANUAL_ARRANGEMENT_REQUIRED: selected provider is only the coordinator
 */
export async function createInhouseBookingMultiAction(
  rawInput: unknown
): Promise<CreateInhouseBookingResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, code: "UNAUTHORIZED", message: "Please sign in and try again." };
  }

  const { data: me } = await supabase
    .from("staff")
    .select("id, branch_id, system_role")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  const staff = (me ?? null) as StaffAuthContext | null;
  const staffRole = staff ? canonicalizeSystemRole(staff.system_role) : null;

  const operator: InhouseBookingOperator = {
    authUserId: user.id,
    staff,
    staffRole,
  };

  return executeInhouseBookingCreation(rawInput, operator);
}
