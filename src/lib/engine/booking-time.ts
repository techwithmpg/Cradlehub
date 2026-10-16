import { createClient } from "@/lib/supabase/server";

/**
 * Returns the booking end_time as a HH:MM:SS string.
 * Formula: start_time + buffer_before + duration_minutes + buffer_after
 *
 * We store end_time on the bookings row (denormalized) so the availability
 * RPC can compare times without joins on every query.
 */
export async function computeEndTime(
  startTime: string, // "HH:MM" or "HH:MM:SS"
  serviceId: string,
  client?: Awaited<ReturnType<typeof createClient>>
): Promise<string> {
  const supabase = client ?? (await createClient());

  const { data, error } = await supabase.rpc("compute_booking_end_time", {
    p_start_time: startTime,
    p_service_id: serviceId,
  });

  if (error || !data) throw new Error("Could not compute booking end time");
  return data as string;
}

/** Adds a resolved treatment duration and the catalog's existing booking buffers. */
export function computeEndTimeForResolvedDuration(input: {
  startTime: string;
  selectedDurationMinutes: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
}): string {
  const match = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(input.startTime);
  const hour = match ? Number(match[1]) : NaN;
  const minute = match ? Number(match[2]) : NaN;
  if (!Number.isSafeInteger(hour) || hour > 23 || !Number.isSafeInteger(minute) || minute > 59 ||
      !Number.isSafeInteger(input.selectedDurationMinutes) || input.selectedDurationMinutes <= 0 ||
      !Number.isSafeInteger(input.bufferBeforeMinutes) || input.bufferBeforeMinutes < 0 ||
      !Number.isSafeInteger(input.bufferAfterMinutes) || input.bufferAfterMinutes < 0) {
    throw new Error("INVALID_BOOKING_END_TIME");
  }
  const start = hour * 60 + minute;
  const block = input.selectedDurationMinutes + input.bufferBeforeMinutes + input.bufferAfterMinutes;
  const end = start + block;
  if (!Number.isSafeInteger(end) || start < 0 || end >= 24 * 60 || block <= 0) {
    throw new Error("INVALID_BOOKING_END_TIME");
  }
  return `${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}:00`;
}
