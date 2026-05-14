"use server";

import { createClient } from "@/lib/supabase/server";
import { isDevAuthBypassEnabled } from "@/lib/dev-bypass";
import { logError } from "@/lib/logger";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const recordLocationSchema = z.object({
  bookingId: z.guid("Invalid booking ID"),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracyMeters: z.number().positive().optional(),
  source: z.enum(["gps", "manual", "system"]).default("gps"),
});

// ── Record a location snapshot for an active home-service booking ─────────────
// Rules:
//   - Staff can only record for themselves (not arbitrary staff_id input).
//   - The booking must be assigned to them as therapist (staff_id) or driver (driver_id).
//   - Booking must be a home-service booking (type or delivery_type).
//   - Booking must be active (not completed / cancelled / no_show).
export async function recordStaffLocationSnapshotAction(rawInput: unknown): Promise<{
  ok: boolean;
  message: string;
}> {
  const parsed = recordLocationSchema.safeParse(rawInput);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, message: issue?.message ?? "Invalid input" };
  }

  const { bookingId, lat, lng, accuracyMeters, source } = parsed.data;

  const supabase = await createClient();

  // Resolve current staff
  const { data: { user } } = await supabase.auth.getUser();
  if (!user && !isDevAuthBypassEnabled()) {
    return { ok: false, message: "Not authenticated" };
  }

  let staffId: string;
  let branchId: string;

  if (isDevAuthBypassEnabled() && !user) {
    staffId = "00000000-0000-0000-0000-000000000000";
    branchId = "00000000-0000-0000-0000-000000000000";
  } else {
    const { data: me } = await supabase
      .from("staff")
      .select("id, branch_id, system_role")
      .eq("auth_user_id", user!.id)
      .eq("is_active", true)
      .maybeSingle();

    if (!me) return { ok: false, message: "No active staff record" };
    staffId = me.id;
    branchId = me.branch_id ?? "";
  }

  // Validate the booking
  const { data: booking, error: bookingErr } = await supabase
    .from("bookings")
    .select("id, branch_id, type, delivery_type, status, staff_id, driver_id")
    .eq("id", bookingId)
    .maybeSingle();

  if (bookingErr || !booking) {
    return { ok: false, message: "Booking not found" };
  }

  // Must be home-service
  const isHomeService =
    booking.type === "home_service" ||
    (booking as { delivery_type?: string }).delivery_type === "home_service";

  if (!isHomeService) {
    return { ok: false, message: "Location sharing is only available for home-service bookings" };
  }

  // Must be assigned to this staff as therapist or driver
  const isTherapist = booking.staff_id === staffId;
  const isDriver = (booking as { driver_id?: string | null }).driver_id === staffId;

  if (!isTherapist && !isDriver) {
    return { ok: false, message: "You are not assigned to this booking" };
  }

  // Must be active
  const terminalStatuses = ["completed", "cancelled", "no_show"];
  if (terminalStatuses.includes(booking.status)) {
    return { ok: false, message: "Cannot record location for a completed or cancelled booking" };
  }

  // Insert snapshot — RLS policy sls_staff_insert_own enforces staff_id = current user
  const { error: insertErr } = await supabase
    .from("staff_location_snapshots")
    .insert({
      staff_id: staffId,
      booking_id: bookingId,
      branch_id: booking.branch_id ?? branchId,
      lat,
      lng,
      accuracy_meters: accuracyMeters ?? null,
      source,
    });

  if (insertErr) {
    return { ok: false, message: insertErr.message };
  }

  revalidatePath("/driver");
  revalidatePath("/manager/control");
  revalidatePath("/crm/control");

  return { ok: true, message: "Location updated" };
}

// ── Latest location snapshot for a specific booking ───────────────────────────
// Used by: customer tracking (Phase 7), internal map (Phase 9)
export async function getLatestStaffLocationForBooking(
  bookingId: string
): Promise<{ lat: number; lng: number; recorded_at: string } | null> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("staff_location_snapshots")
      .select("lat, lng, recorded_at")
      .eq("booking_id", bookingId)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) return null;
    return { lat: Number(data.lat), lng: Number(data.lng), recorded_at: data.recorded_at };
  } catch (error) {
    logError("Failed to get latest staff location", { error, action: "location.latest", bookingId });
    return null;
  }
}

// ── Latest location per active home-service booking for a branch ──────────────
// Returns Record<bookingId, { lat, lng, recorded_at }> for the control console.
// Used by: control console (Phase 6), internal map (Phase 9)
export async function getLatestLocationsForActiveHomeServiceTrips(
  branchId: string,
  date: string
): Promise<Record<string, { lat: number; lng: number; recorded_at: string }>> {
  try {
    const supabase = await createClient();

    // Get all active home-service booking IDs for the branch today
    const { data: activeBookings } = await supabase
      .from("bookings")
      .select("id")
      .eq("branch_id", branchId)
      .eq("booking_date", date)
      .eq("type", "home_service")
      .not("status", "in", '("cancelled","no_show","completed")');

    if (!activeBookings || activeBookings.length === 0) return {};

    const bookingIds = activeBookings.map((b) => b.id);

    // Fetch the latest snapshot for each booking in one query using
    // a distinct-on style by ordering and deduplicating in application code.
    const { data: snapshots } = await supabase
      .from("staff_location_snapshots")
      .select("booking_id, lat, lng, recorded_at")
      .in("booking_id", bookingIds)
      .order("recorded_at", { ascending: false });

    if (!snapshots) return {};

    // Keep only the latest entry per booking_id
    const result: Record<string, { lat: number; lng: number; recorded_at: string }> = {};
    for (const snap of snapshots) {
      if (snap.booking_id && !result[snap.booking_id]) {
        result[snap.booking_id] = {
          lat: Number(snap.lat),
          lng: Number(snap.lng),
          recorded_at: snap.recorded_at,
        };
      }
    }
    return result;
  } catch (error) {
    logError("Failed to get locations for active trips", { error, action: "location.activeTrips", branchId, date });
    return {};
  }
}
