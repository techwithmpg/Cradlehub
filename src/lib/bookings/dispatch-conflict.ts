import { createAdminClient } from "@/lib/supabase/admin";
import { isGoogleMapsEnabled, estimateTravelTime } from "@/lib/maps/google-maps";
import { bookingBlocksAvailability } from "@/lib/bookings/hold-status";

// Maximum driving minutes between two zones before a single-driver overlap is
// considered a hard conflict. Keep centralized so it can be tuned later.
const TRAVEL_TIME_HARD_CONFLICT_MINS = 30;

export const DISPATCH_ZONES = [
  "central_bacolod",
  "north_bacolod_talisay",
  "south_bacolod_alijis",
  "east_bacolod",
  "outside_bacolod",
  "unknown",
] as const;

export type DispatchZone = (typeof DISPATCH_ZONES)[number];

export const ZONE_LABELS: Record<DispatchZone, string> = {
  central_bacolod:       "Central Bacolod",
  north_bacolod_talisay: "North Bacolod / Talisay",
  south_bacolod_alijis:  "South Bacolod / Alijis",
  east_bacolod:          "East Bacolod",
  outside_bacolod:       "Outside Bacolod",
  unknown:               "Not sure / Let CSR confirm",
};

// Zone pairs considered too far apart for a single driver with no buffer time.
// Checked symmetrically.
const FAR_ZONE_PAIRS: [string, string][] = [
  ["north_bacolod_talisay", "south_bacolod_alijis"],
  ["north_bacolod_talisay", "outside_bacolod"],
  ["south_bacolod_alijis",  "outside_bacolod"],
  ["east_bacolod",          "outside_bacolod"],
];

function isZonesFar(zoneA: string, zoneB: string): boolean {
  return FAR_ZONE_PAIRS.some(
    ([a, b]) =>
      (zoneA === a && zoneB === b) || (zoneA === b && zoneB === a)
  );
}

function timeToMins(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function timesOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string
): boolean {
  return (
    timeToMins(startA) < timeToMins(endB) &&
    timeToMins(endA) > timeToMins(startB)
  );
}

type HomeServiceAddress = {
  zone?: string | null;
  lat?: number | null;
  lng?: number | null;
};

type HomeServiceBookingRow = {
  id: string;
  start_time: string;
  end_time: string;
  metadata: Record<string, unknown> | null;
  status: string | null;
  hold_expires_at: string | null;
};

export type DispatchConflictResult =
  | { conflict: "hard"; message: string }
  | { conflict: "warning"; message: string; needs_location_review: boolean }
  | { conflict: "none" };

export async function checkHomeServiceDispatchConflict({
  branchId,
  bookingDate,
  startTime,
  endTime,
  selectedZone,
  selectedLat,
  selectedLng,
  driverCapacity,
  excludeBookingId,
}: {
  branchId: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  selectedZone?: string | null;
  selectedLat?: number | null;
  selectedLng?: number | null;
  driverCapacity: number;
  excludeBookingId?: string;
}): Promise<DispatchConflictResult> {
  // Driver capacity 0 means home service is disabled — treat as hard block.
  if (driverCapacity === 0) {
    return {
      conflict: "hard",
      message: "Home Service is not available at this time. Please contact us to arrange.",
    };
  }

  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("bookings")
    .select("id, start_time, end_time, metadata, status, hold_expires_at")
    .eq("branch_id", branchId)
    .eq("booking_date", bookingDate)
    .eq("delivery_type", "home_service");

  const now = new Date();
  const rows = ((existing ?? []) as HomeServiceBookingRow[]).filter(
    (r) => r.id !== excludeBookingId && bookingBlocksAvailability(r, now)
  );

  const overlapping = rows.filter((r) =>
    timesOverlap(startTime, endTime, r.start_time, r.end_time)
  );

  // Hard conflict: capacity fully consumed
  if (overlapping.length >= driverCapacity) {
    return {
      conflict: "hard",
      message:
        "Home Service is already fully scheduled for this time. Please choose another time or contact the front desk.",
    };
  }

  // Unknown zone — allow but flag for CSR review
  if (!selectedZone || selectedZone === "unknown") {
    return {
      conflict: "warning",
      message:
        "Location zone is not confirmed. A CSR will review this booking before dispatch.",
      needs_location_review: true,
    };
  }

  // Single-driver far-zone check
  if (driverCapacity === 1 && overlapping.length > 0) {
    for (const row of overlapping) {
      const meta = row.metadata as Record<string, unknown> | null;
      const hsAddr = (meta?.home_service_address ?? null) as HomeServiceAddress | null;
      const existingZone = hsAddr?.zone ?? "unknown";

      if (existingZone === "unknown") {
        // Existing booking has unknown zone — soft warning
        return {
          conflict: "warning",
          message:
            "An overlapping home service booking has an unconfirmed location. A CSR will review dispatch feasibility.",
          needs_location_review: true,
        };
      }

      if (isZonesFar(selectedZone, existingZone)) {
        // Try Google travel time if both coords are available
        if (
          isGoogleMapsEnabled() &&
          selectedLat != null &&
          selectedLng != null &&
          hsAddr?.lat != null &&
          hsAddr?.lng != null
        ) {
          const travelMins = await estimateTravelTime(
            Number(hsAddr.lat),
            Number(hsAddr.lng),
            selectedLat,
            selectedLng
          );

          if (travelMins !== null && travelMins > TRAVEL_TIME_HARD_CONFLICT_MINS) {
            return {
              conflict: "hard",
              message: `Home Service at this location conflicts with another booking. Estimated travel time between locations is ${travelMins} minutes, which exceeds the available window. Please choose another time.`,
            };
          }
          // Travel estimate available and within threshold — allow
        } else {
          // Zone-only fallback: far zones = hard conflict for single driver
          return {
            conflict: "hard",
            message:
              "Home Service locations for overlapping bookings are too far apart for a single driver. Please choose another time.",
          };
        }
      }
    }
  }

  return { conflict: "none" };
}
