import { createClient } from "@/lib/supabase/server";
import type { AvailabilitySlot } from "@/types";
import { SlotUnavailableError } from "@/types/errors";

/** Calls the get_available_slots RPC and returns all slots. */
export async function getAvailableSlots(params: {
  branchId:  string;
  serviceId: string;
  staffId?:  string;
  date:      string;
}): Promise<AvailabilitySlot[]> {
  const supabase = await createClient();

  const rpcArgs = {
    p_branch_id:  params.branchId,
    p_service_id: params.serviceId,
    p_staff_id:   (params.staffId ?? null) as unknown as string,
    p_date:       params.date,
  };

  const { data, error } = await supabase.rpc("get_available_slots", rpcArgs);

  if (error) throw new Error(`Availability query failed: ${error.message}`);
  return (data ?? []) as AvailabilitySlot[];
}

/**
 * When customer selects "any therapist", we call get_available_slots
 * with no staffId (returns all staff), then pick by seniority rule:
 *   Senior → Mid → Junior
 *   Tie-break: alphabetical by staff_name
 *
 * Returns the assigned staff_id, or throws SlotUnavailableError if none available.
 */
export async function assignTherapistBySeniority(params: {
  branchId:  string;
  serviceId: string;
  date:      string;
  startTime: string;
}): Promise<string> {
  const slots = await getAvailableSlots({
    branchId:  params.branchId,
    serviceId: params.serviceId,
    date:      params.date,
    // No staffId — returns all staff
  });

  // Filter to the requested time that is still available
  const candidates = slots.filter(
    (s) =>
      s.available &&
      s.slot_time.startsWith(params.startTime.substring(0, 5)) // compare HH:MM
  );

  if (candidates.length === 0) throw new SlotUnavailableError();

  // Sort by seniority then name
  const TIER_ORDER: Record<string, number> = { senior: 0, mid: 1, junior: 2 };
  candidates.sort((a, b) => {
    const tierDiff =
      (TIER_ORDER[a.staff_tier] ?? 9) - (TIER_ORDER[b.staff_tier] ?? 9);
    if (tierDiff !== 0) return tierDiff;
    return a.staff_name.localeCompare(b.staff_name);
  });

  return candidates[0]!.staff_id;
}

/**
 * Verifies a specific slot is still available.
 * Throws SlotUnavailableError if taken (race condition protection).
 */
export async function assertSlotAvailable(params: {
  branchId:  string;
  serviceId: string;
  staffId:   string;
  date:      string;
  startTime: string;
}): Promise<void> {
  const slots = await getAvailableSlots({
    branchId:  params.branchId,
    serviceId: params.serviceId,
    staffId:   params.staffId,
    date:      params.date,
  });

  const slot = slots.find(
    (s) =>
      s.staff_id === params.staffId &&
      s.slot_time.startsWith(params.startTime.substring(0, 5))
  );

  if (!slot?.available) throw new SlotUnavailableError();
}
