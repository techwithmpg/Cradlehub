"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { createClient } from "@/lib/supabase/server";
import { getDevBypassLayoutStaff, isDevAuthBypassEnabled } from "@/lib/dev-bypass";
import { canAccessCrmWorkspace } from "@/lib/auth/crm-permissions";
import { logError } from "@/lib/logger";
import { assignHomeServiceDriver } from "@/lib/home-service/dispatch-operations";

async function requireManagerOrCrm() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not logged in" } as const;

  if (isDevAuthBypassEnabled()) {
    const mock = getDevBypassLayoutStaff();
    return {
      supabase,
      me: {
        id: "00000000-0000-0000-0000-000000000000",
        branch_id: mock.branch_id,
        system_role: mock.system_role,
      },
    };
  }

  const { data: me } = await supabase
    .from("staff")
    .select("id, branch_id, system_role")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!me) return { error: "No active staff record" } as const;

  if (!canAccessCrmWorkspace(me.system_role)) return { error: "Insufficient permissions" } as const;

  return { supabase, me };
}

// ── Assign (or unassign) a driver to a home-service booking ──────────────────
export async function assignBookingDriverAction(rawInput: unknown): Promise<{
  success: boolean;
  error?: string;
}> {
  const ctx = await requireManagerOrCrm();

  if ("error" in ctx) {
    return { success: false, error: ctx.error };
  }

  const result = await assignHomeServiceDriver(
    ctx.supabase,
    {
      staffId: ctx.me.id,
      branchId: ctx.me.branch_id,
      role: ctx.me.system_role,
      // Preserve current hosted behavior: owners may operate cross-branch.
      allowOwnerCrossBranch: true,
    },
    rawInput
  );

  if (!result.ok) {
    return {
      success: false,
      error: result.message,
    };
  }

  return { success: true };
}
// ── Fetch driver name map for a set of driver IDs ────────────────────────────
// Used by control console pages to resolve driver_id → full_name.
export async function getDriverNamesByIds(
  ids: string[],
  client?: SupabaseClient<Database>
): Promise<Record<string, string>> {
  if (ids.length === 0) return {};
  const supabase = client ?? (await createClient());
  const { data } = await supabase.from("staff").select("id, full_name").in("id", ids);
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
  date: string,
  client?: SupabaseClient<Database>
): Promise<Record<string, string | null>> {
  try {
    const supabase = client ?? (await createClient());
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
    logError("Failed to fetch booking driver IDs", {
      error,
      action: "booking.getDriverIds",
      branchId,
      date,
    });
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
    logError("Failed to fetch available drivers", {
      error,
      action: "driver.getAvailable",
      branchId,
    });
    return [];
  }
}

// ── Fetch today's trips assigned to a specific driver ────────────────────────
// Uses regular client — RLS policy "bookings_driver_read_own" (Phase 5.1) covers this.
export async function getDriverTodayTrips(driverId: string, date: string) {
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
