// Client-safe (no DB, no server imports) zone-based dispatch slot filter.
// Mirrors the core logic from dispatch-conflict.ts but works on pre-fetched
// existing bookings, avoiding per-slot server round-trips in the wizard.

const FAR_ZONE_PAIRS: [string, string][] = [
  ["north_bacolod_talisay", "south_bacolod_alijis"],
  ["north_bacolod_talisay", "outside_bacolod"],
  ["south_bacolod_alijis",  "outside_bacolod"],
  ["east_bacolod",          "outside_bacolod"],
];

function isZonesFar(a: string, b: string): boolean {
  return FAR_ZONE_PAIRS.some(([x, y]) => (a === x && b === y) || (a === y && b === x));
}

function timeToMins(t: string): number {
  const [h = "0", m = "0"] = t.split(":");
  return parseInt(h, 10) * 60 + parseInt(m, 10);
}

function timesOverlap(sA: string, eA: string, sB: string, eB: string): boolean {
  return timeToMins(sA) < timeToMins(eB) && timeToMins(eA) > timeToMins(sB);
}

function addMinutes(time: string, mins: number): string {
  const total = timeToMins(time) + mins;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
}

export type ExistingHsBooking = {
  start_time: string;
  end_time: string;
  zone: string | null;
};

export type SlotDispatchStatus = "ok" | "warning" | "hard";

/**
 * Pure zone-only dispatch check for a single slot.
 * Returns "hard" when the slot would definitively violate driver capacity or
 * zone feasibility, "warning" when zone is unconfirmed, "ok" otherwise.
 */
export function getSlotDispatchStatus(
  slotStart: string,
  totalDurationMins: number,
  existing: ExistingHsBooking[],
  selectedZone: string,
  driverCapacity: number,
): SlotDispatchStatus {
  if (driverCapacity === 0) return "hard";

  const slotEnd = addMinutes(slotStart, totalDurationMins);

  const overlapping = existing.filter((b) =>
    timesOverlap(slotStart, slotEnd, b.start_time, b.end_time)
  );

  // Capacity fully consumed by already-booked trips
  if (overlapping.length >= driverCapacity) return "hard";

  // Unknown zone — allow but flag for CSR review
  if (!selectedZone || selectedZone === "unknown") return "warning";

  // Single-driver far-zone check
  if (driverCapacity === 1 && overlapping.length > 0) {
    for (const b of overlapping) {
      const z = b.zone ?? "unknown";
      if (z === "unknown") return "warning";
      if (isZonesFar(selectedZone, z)) return "hard";
    }
  }

  return "ok";
}
