"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isDevAuthBypassEnabled } from "@/lib/dev-bypass";
import { logError } from "@/lib/logger";
import { revalidatePath } from "next/cache";
import { invalidateCrmWorkspace } from "@/lib/cache/cache-tags";
import { z } from "zod";

const uuid = z.guid("Invalid ID");

const assignDriverSchema = z.object({
  bookingId: uuid,
  driverId: uuid.nullable(),
});

async function requireManagerOrCrm() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not logged in" } as const;

  if (isDevAuthBypassEnabled()) {
    return {
      supabase,
      me: { id: "dev", branch_id: "dev", system_role: "manager" as const },
    };
  }

  const { data: me } = await supabase
    .from("staff")
    .select("id, branch_id, system_role")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!me) return { error: "No active staff record" } as const;

  const allowed = [
    "owner",
    "manager",
    "assistant_manager",
    "store_manager",
    "crm",
    "csr_head",
    "csr_staff",
    "csr",
  ];
  if (!allowed.includes(me.system_role))
    return { error: "Insufficient permissions" } as const;

  return { supabase, me };
}

// ── Assign (or unassign) a driver to a home-service booking ──────────────────
export async function assignBookingDriverAction(rawInput: unknown): Promise<{
  success: boolean;
  error?: string;
}> {
  const parsed = assignDriverSchema.safeParse(rawInput);
  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0]?.message };

  const ctx = await requireManagerOrCrm();
  if ("error" in ctx) return { success: false, error: ctx.error };

  const { bookingId, driverId } = parsed.data;

  // Fetch booking to validate delivery type and branch
  const { data: booking, error: bookingErr } = await ctx.supabase
    .from("bookings")
    .select("id, branch_id, delivery_type, type")
    .eq("id", bookingId)
    .single();

  if (bookingErr || !booking)
    return { success: false, error: "Booking not found" };

  const isHomeService =
    booking.delivery_type === "home_service" ||
    booking.type === "home_service";
  if (!isHomeService)
    return {
      success: false,
      error: "Driver assignment is only available for home-service bookings",
    };

  // Branch scope — owners can cross-branch; managers/CRM must match
  const isOwner = ctx.me.system_role === "owner";
  if (!isOwner && ctx.me.branch_id !== booking.branch_id)
    return { success: false, error: "Booking is not in your branch" };

  // Validate driver exists in same branch with driver role/type
  if (driverId !== null) {
    const { data: driver, error: driverErr } = await ctx.supabase
      .from("staff")
      .select("id, branch_id, system_role, staff_type, is_active")
      .eq("id", driverId)
      .single();

    if (driverErr || !driver)
      return { success: false, error: "Driver staff record not found" };

    if (!driver.is_active)
      return { success: false, error: "Selected driver is not active" };

    if (!isOwner && driver.branch_id !== booking.branch_id)
      return {
        success: false,
        error: "Driver must belong to the same branch as the booking",
      };

    const isDriverRole =
      driver.system_role === "driver" || driver.staff_type === "driver";
    if (!isDriverRole)
      return {
        success: false,
        error:
          "Selected staff is not a driver (system_role or staff_type must be 'driver')",
      };
  }

  // Use admin client to bypass RLS on bookings.driver_id
  const admin = createAdminClient();
  const { error: updateErr } = await admin
    .from("bookings")
    .update({ driver_id: driverId })
    .eq("id", bookingId);

  if (updateErr) return { success: false, error: updateErr.message };

  revalidatePath("/manager/control");
  revalidatePath("/crm/control");
  revalidatePath("/crm/today");
  revalidatePath("/driver");
  invalidateCrmWorkspace(booking.branch_id);

  return { success: true };
}

// ── Fetch driver name map for a set of driver IDs ────────────────────────────
// Used by control console pages to resolve driver_id → full_name.
export async function getDriverNamesByIds(
  ids: string[]
): Promise<Record<string, string>> {
  if (ids.length === 0) return {};
  const supabase = await createClient();
  const { data } = await supabase
    .from("staff")
    .select("id, full_name")
    .in("id", ids);
  const map: Record<string, string> = {};
  for (const s of data ?? []) {
    map[s.id] = s.full_name;
  }
  return map;
}

// ── Fetch driver_id for today's bookings in a branch ─────────────────────────
// Gracefully returns empty map if driver_id column doesn't exist yet.
export async function getBranchBookingDriverIds(
  branchId: string,
  date: string
): Promise<Record<string, string | null>> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("bookings")
      .select("id, driver_id")
      .eq("branch_id", branchId)
      .eq("booking_date", date)
      .not("status", "in", '("cancelled","no_show")');

    if (error) return {};

    const map: Record<string, string | null> = {};
    for (const row of data ?? []) {
      map[row.id] = (row as { id: string; driver_id?: string | null }).driver_id ?? null;
    }
    return map;
  } catch (error) {
    logError("Failed to fetch booking driver IDs", { error, action: "booking.getDriverIds", branchId, date });
    return {};
  }
}

// ── List active branch drivers for assignment dropdown ───────────────────────
// Returns staff members in the branch with system_role='driver' or staff_type='driver'.
export async function getAvailableBranchDrivers(
  branchId: string
): Promise<{ id: string; full_name: string }[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("staff")
      .select("id, full_name, system_role, staff_type")
      .eq("branch_id", branchId)
      .eq("is_active", true)
      .or("system_role.eq.driver,staff_type.eq.driver")
      .order("full_name");
    return (data ?? []).map((s) => ({ id: s.id, full_name: s.full_name }));
  } catch (error) {
    logError("Failed to fetch available drivers", { error, action: "driver.getAvailable", branchId });
    return [];
  }
}

// ── Fetch today's trips assigned to a specific driver ────────────────────────
// Uses regular client — RLS policy "bookings_driver_read_own" (Phase 5.1) covers this.
export async function getDriverTodayTrips(
  driverId: string,
  date: string
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .select(
      `
      id, booking_date, start_time, end_time,
      type, delivery_type, status,
      booking_progress_status,
      travel_buffer_mins, metadata,
      travel_started_at, arrived_at, session_started_at, session_completed_at,
      services ( id, name, duration_minutes ),
      customers ( id, full_name ),
      staff:staff_id ( id, full_name )
    `
    )
    .eq("driver_id", driverId)
    .eq("booking_date", date)
    .not("status", "in", '("cancelled","no_show")')
    .order("start_time");

  if (error) throw new Error(error.message);
  return data ?? [];
}
