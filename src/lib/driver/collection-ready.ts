import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { logError } from "@/lib/logger";
export async function confirmDriverCollectionReady(
  db: SupabaseClient<Database>,
  bookingId: string
): Promise<string | undefined> {
  if (process.env.CRADLEHUB_DRIVER_JOURNEYS_ENABLED !== "true") return;
  try {
    const { data, error } = await db.rpc(
      "driver_unified_collection_ready" as never,
      { p_booking_id: bookingId } as never
    );
    if (!error && data === true) return;
  } catch {
    /* Service completion is already authoritative; readiness remains visibly unconfirmed. */
  }
  logError("driver.collection_readiness_unconfirmed", { bookingId });
  return "Service completion was recorded. Ask CRM to confirm therapist collection readiness.";
}
