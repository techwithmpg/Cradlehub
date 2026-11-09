"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getMyDriverJobByIdAction } from "@/app/(dashboard)/staff-portal/actions";
import { recordStaffLocationSnapshotAction } from "@/lib/actions/location-actions";

const driverPointSchema = z.object({
  bookingId: z.guid(),
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
  accuracyMeters: z.number().finite().gt(0).max(150),
});

export type DriverGpsResult =
  | { ok: true; recorded: boolean }
  | { ok: false; message: string };

/**
 * Writes only active, currently assigned, in-route driver GPS samples.
 * The existing authenticated insertion action and RLS remain authoritative.
 * Avoid accepting browser-supplied branch, staff identity or progress state.
 */
export async function recordAssignedDriverLiveLocationAction(
  rawInput: unknown
): Promise<DriverGpsResult> {
  const parsed = driverPointSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, message: "GPS accuracy or position is insufficient." };
  }
  const { bookingId, lat, lng, accuracyMeters } = parsed.data;
  const assigned = await getMyDriverJobByIdAction(bookingId);
  if ("error" in assigned) {
    return { ok: false, message: "Trip is no longer assigned to this driver." };
  }
  const { job, staff } = assigned;
  if (
    !staff.branch_id ||
    job.driverId !== staff.id ||
    !["confirmed", "in_progress"].includes(job.bookingStatus) ||
    job.bookingProgressStatus !== "travel_started"
  ) {
    return { ok: false, message: "Live tracking is available only while travelling." };
  }

  const client = await createClient();
  const { data: last, error } = await client
    .from("staff_location_snapshots")
    .select("recorded_at")
    .eq("staff_id", staff.id)
    .eq("branch_id", staff.branch_id)
    .eq("booking_id", bookingId)
    .order("recorded_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return { ok: false, message: "Live tracking is temporarily unavailable." };

  const previousTime = last ? Date.parse(last.recorded_at) : NaN;
  if (Number.isFinite(previousTime) && Date.now() - previousTime < 20000) {
    return { ok: true, recorded: false };
  }

  const result = await recordStaffLocationSnapshotAction({
    bookingId, lat, lng, accuracyMeters, source: "gps",
  });
  return result.ok
    ? { ok: true, recorded: true }
    : { ok: false, message: "Could not share location with CRM." };
}
