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
  serviceId: string
): Promise<string> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("compute_booking_end_time", {
    p_start_time: startTime,
    p_service_id: serviceId,
  });

  if (error || !data) throw new Error("Could not compute booking end time");
  return data as string;
}
