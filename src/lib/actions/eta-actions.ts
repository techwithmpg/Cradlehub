"use server";

import { createClient } from "@/lib/supabase/server";
import { estimateTravelTime, isGoogleMapsEnabled } from "@/lib/maps/google-maps";
import { parseLiveEta } from "@/lib/bookings/ops-warnings";
import type { LiveEtaData } from "@/lib/bookings/ops-warnings";
import { revalidatePath } from "next/cache";

const ALLOWED_ROLES = [
  "owner",
  "manager",
  "assistant_manager",
  "store_manager",
  "crm",
  "csr",
  "csr_head",
  "csr_staff",
];

export type EtaRefreshResult =
  | { ok: true; eta: LiveEtaData }
  | {
      ok: false;
      error: string;
      source?: "no_maps_key" | "no_location" | "no_destination" | "api_error";
    };

// Refresh the live ETA for an active home-service booking.
// Calls the Google Routes API once per invocation (manual-trigger only).
// Stores result in metadata.dispatch.live_eta.
export async function refreshHomeServiceEtaAction(
  bookingId: string
): Promise<EtaRefreshResult> {
  if (!bookingId || typeof bookingId !== "string") {
    return { ok: false, error: "Invalid booking ID" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const { data: me } = await supabase
    .from("staff")
    .select("id, branch_id, system_role")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!me || !ALLOWED_ROLES.includes(me.system_role)) {
    return { ok: false, error: "Not authorized" };
  }

  const { data: booking } = await supabase
    .from("bookings")
    .select(
      "id, branch_id, type, delivery_type, status, staff_id, driver_id, metadata, travel_buffer_mins"
    )
    .eq("id", bookingId)
    .maybeSingle();

  if (!booking) return { ok: false, error: "Booking not found" };
  if (booking.branch_id !== me.branch_id) return { ok: false, error: "Booking not found" };

  const isHomeService =
    booking.type === "home_service" ||
    (booking as { delivery_type?: string }).delivery_type === "home_service";
  if (!isHomeService) return { ok: false, error: "Not a home-service booking" };

  const terminalStatuses = ["completed", "cancelled", "no_show"];
  if (terminalStatuses.includes(booking.status)) {
    return { ok: false, error: "Booking is already completed or cancelled" };
  }

  if (!isGoogleMapsEnabled()) {
    return { ok: false, error: "Google Maps API not configured", source: "no_maps_key" };
  }

  // Extract destination coords from metadata
  const meta = (booking.metadata ?? {}) as Record<string, unknown>;
  const hsAddr = meta.home_service_address as Record<string, unknown> | null;
  const rawLat = hsAddr?.lat;
  const rawLng = hsAddr?.lng;
  const destLat =
    typeof rawLat === "number"
      ? rawLat
      : typeof rawLat === "string"
      ? parseFloat(rawLat)
      : null;
  const destLng =
    typeof rawLng === "number"
      ? rawLng
      : typeof rawLng === "string"
      ? parseFloat(rawLng)
      : null;

  if (!destLat || !destLng || isNaN(destLat) || isNaN(destLng)) {
    return {
      ok: false,
      error: "Destination coordinates not available",
      source: "no_destination",
    };
  }

  // Get most recent location snapshot for this booking (driver or therapist)
  const { data: snap } = await supabase
    .from("staff_location_snapshots")
    .select("lat, lng, staff_id")
    .eq("booking_id", bookingId)
    .order("recorded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!snap) {
    return {
      ok: false,
      error: "No current location available for this trip",
      source: "no_location",
    };
  }

  const originLat = Number(snap.lat);
  const originLng = Number(snap.lng);

  const driverId = (booking as { driver_id?: string | null }).driver_id ?? null;
  const origin: LiveEtaData["origin"] =
    driverId && snap.staff_id === driverId
      ? "driver_location"
      : booking.staff_id && snap.staff_id === booking.staff_id
      ? "therapist_location"
      : "unknown";

  const etaMins = await estimateTravelTime(originLat, originLng, destLat, destLng);
  if (etaMins === null) {
    return { ok: false, error: "Routes API unavailable", source: "api_error" };
  }

  const liveEta: LiveEtaData = {
    eta_minutes: etaMins,
    calculated_at: new Date().toISOString(),
    source: "routes_api",
    origin,
  };

  const dispatch = (meta.dispatch as Record<string, unknown>) ?? {};
  const { error: updateErr } = await supabase
    .from("bookings")
    .update({
      metadata: {
        ...meta,
        dispatch: { ...dispatch, live_eta: liveEta },
      },
    })
    .eq("id", bookingId);

  if (updateErr) return { ok: false, error: updateErr.message };

  revalidatePath("/manager/control");
  revalidatePath("/crm/control");

  return { ok: true, eta: liveEta };
}

// Find the next booking assigned to a staff member after a given time on a date.
// Used for next-booking conflict warning computation.
export async function getNextBookingForStaff(
  staffId: string,
  bookingDate: string,
  afterTime: string
): Promise<{ id: string; start_time: string } | null> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("bookings")
      .select("id, start_time")
      .eq("staff_id", staffId)
      .eq("booking_date", bookingDate)
      .gt("start_time", afterTime)
      .not("status", "in", '("cancelled","no_show")')
      .order("start_time")
      .limit(1)
      .maybeSingle();
    return data ?? null;
  } catch {
    return null;
  }
}

// Re-export parseLiveEta for convenience (used in page.tsx data mapping)
export { parseLiveEta };
