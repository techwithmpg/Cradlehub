"use server";

import { createClient } from "@/lib/supabase/server";
import { parseLiveEta } from "@/lib/bookings/ops-warnings";
import { getStaffAdminName } from "@/lib/staff/display-name";
import type { LiveEtaData } from "@/lib/bookings/ops-warnings";
import { logError } from "@/lib/logger";

export type ActiveTripData = {
  id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: string;
  booking_progress_status: string | null;
  customer_name: string | null;
  service_name: string | null;
  therapist_name: string | null;
  driver_id: string | null;
  driver_name: string | null;
  hs_address: string | null;
  dest_lat: number | null;
  dest_lng: number | null;
  location: { lat: number; lng: number; recorded_at: string } | null;
  /** Phase 10: live ETA from Routes API stored in metadata */
  live_eta: LiveEtaData | null;
};

type OneOrMany<T> = T | T[] | null;

function first<T>(v: OneOrMany<T>): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

// Returns active home-service trips for the authenticated user's branch.
// Resolves branch from session — safe to call from client components.
// Returns [] on auth failure or any error (non-throwing).
export async function getActiveTripsForOpsMap(): Promise<ActiveTripData[]> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    const { data: me } = await supabase
      .from("staff")
      .select("id, branch_id")
      .eq("auth_user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (!me?.branch_id) return [];

    const today = new Date().toISOString().split("T")[0]!;
    const branchId = me.branch_id as string;

    // Fetch active HS bookings — include type = home_service OR delivery_type = home_service
    // Use relationship hints to disambiguate staff_id vs driver_id (both FK to staff table)
    const { data: rawBookings } = await supabase
      .from("bookings")
      .select(
        `id, booking_date, start_time, end_time, type, delivery_type,
         status, booking_progress_status, metadata, driver_id,
         services ( name ),
         therapist:staff!staff_id ( full_name, nickname ),
         customers ( full_name )`
      )
      .eq("branch_id", branchId)
      .eq("booking_date", today)
      .not("status", "in", '("cancelled","no_show","completed")')
      .or("type.eq.home_service,delivery_type.eq.home_service");

    if (!rawBookings || rawBookings.length === 0) return [];

    const bookingIds = rawBookings.map((b) => b.id);

    const driverIds = [
      ...new Set(
        rawBookings
          .map((b) => (b as { driver_id?: string | null }).driver_id)
          .filter((id): id is string => typeof id === "string")
      ),
    ];

    // Parallel: latest location snapshots + driver names
    const [snapshotsRes, driversRes] = await Promise.all([
      supabase
        .from("staff_location_snapshots")
        .select("booking_id, lat, lng, recorded_at")
        .in("booking_id", bookingIds)
        .order("recorded_at", { ascending: false }),
      driverIds.length > 0
        ? supabase.from("staff").select("id, full_name, nickname").in("id", driverIds)
        : Promise.resolve({ data: [] as { id: string; full_name: string; nickname: string | null }[] }),
    ]);

    // Latest snapshot per booking_id
    const locationMap: Record<string, { lat: number; lng: number; recorded_at: string }> = {};
    for (const snap of snapshotsRes.data ?? []) {
      if (snap.booking_id && !locationMap[snap.booking_id]) {
        locationMap[snap.booking_id] = {
          lat: Number(snap.lat),
          lng: Number(snap.lng),
          recorded_at: snap.recorded_at,
        };
      }
    }

    const driverNameMap: Record<string, string> = {};
    for (const d of driversRes.data ?? []) {
      driverNameMap[d.id] = getStaffAdminName(d);
    }

    return rawBookings.map((b) => {
      const meta = (b as { metadata?: unknown }).metadata as Record<string, unknown> | null;
      const hsAddr = meta?.home_service_address as Record<string, unknown> | null;

      const rawLat = hsAddr?.lat;
      const rawLng = hsAddr?.lng;
      const destLat =
        typeof rawLat === "number" ? rawLat : typeof rawLat === "string" ? parseFloat(rawLat) : null;
      const destLng =
        typeof rawLng === "number" ? rawLng : typeof rawLng === "string" ? parseFloat(rawLng) : null;

      const driverId = (b as { driver_id?: string | null }).driver_id ?? null;
      const dispatch = meta?.dispatch as Record<string, unknown> | null;
      const liveEta = parseLiveEta(dispatch?.live_eta);

      return {
        id: b.id,
        booking_date: b.booking_date,
        start_time: b.start_time,
        end_time: b.end_time,
        status: b.status,
        booking_progress_status:
          (b as { booking_progress_status?: string | null }).booking_progress_status ?? null,
        customer_name:
          first((b as { customers?: OneOrMany<{ full_name: string }> }).customers)?.full_name ?? null,
        service_name:
          first((b as { services?: OneOrMany<{ name: string }> }).services)?.name ?? null,
        therapist_name:
          first((b as { therapist?: OneOrMany<{ full_name: string; nickname?: string | null }> }).therapist)
            ? getStaffAdminName(
                first((b as { therapist?: OneOrMany<{ full_name: string; nickname?: string | null }> }).therapist)!
              )
            : null,
        driver_id: driverId,
        driver_name: driverId ? (driverNameMap[driverId] ?? null) : null,
        hs_address:
          typeof hsAddr?.full_address === "string" ? hsAddr.full_address : null,
        dest_lat: destLat !== null && !isNaN(destLat) ? destLat : null,
        dest_lng: destLng !== null && !isNaN(destLng) ? destLng : null,
        location: locationMap[b.id] ?? null,
        live_eta: liveEta,
      };
    });
  } catch (error) {
    logError("Failed to fetch active trips for ops map", { error, action: "ops.activeTrips" });
    return [];
  }
}
