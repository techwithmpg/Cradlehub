import { createClient } from "@/lib/supabase/server";

export type BookingSnapshot = {
  price_paid:       number;
  service_name:     string;
  duration_minutes: number;
  customer_notes:   string | null;
};

/**
 * Resolves price (branch override → default) and fetches service display info.
 * Always called before INSERT — stores financial snapshot that is immune to
 * future price or service name changes.
 */
export async function buildBookingSnapshot(
  branchId:     string,
  serviceId:    string,
  customerNotes?: string
): Promise<BookingSnapshot> {
  const supabase = await createClient();

  // Fetch service details + effective price in one query
  const { data: svc, error: svcErr } = await supabase
    .from("services")
    .select("name, duration_minutes, price")
    .eq("id", serviceId)
    .single();

  if (svcErr || !svc) throw new Error(`Service ${serviceId} not found`);

  // Check for branch-level price override
  const { data: bs } = await supabase
    .from("branch_services")
    .select("custom_price")
    .eq("branch_id", branchId)
    .eq("service_id", serviceId)
    .single();

  const effectivePrice =
    bs?.custom_price !== null && bs?.custom_price !== undefined
      ? Number(bs.custom_price)
      : Number(svc.price);

  return {
    price_paid:       effectivePrice,
    service_name:     svc.name,
    duration_minutes: svc.duration_minutes,
    customer_notes:   customerNotes ?? null,
  };
}
