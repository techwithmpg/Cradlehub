"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  createOnlineBookingSchema,
  type CreateOnlineBookingInput,
} from "@/lib/validations/booking";
import { assignTherapistBySeniority, assertSlotAvailable } from "@/lib/engine/availability";
import { computeEndTime } from "@/lib/engine/booking-time";
import { buildBookingSnapshot } from "@/lib/engine/snapshot";
import { SlotUnavailableError } from "@/types/errors";

export type CreateOnlineBookingResult =
  | { success: true;  bookingId: string }
  | { success: false; error: string };

export async function createOnlineBookingAction(
  input: CreateOnlineBookingInput
): Promise<CreateOnlineBookingResult> {
  // 1. Validate input
  const parsed = createOnlineBookingSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const d = parsed.data;

  try {
    // 2. Resolve therapist (any-therapist assignment or validate specific one)
    let resolvedStaffId: string;
    if (!d.staffId) {
      // "Any therapist" — assign by seniority
      resolvedStaffId = await assignTherapistBySeniority({
        branchId:  d.branchId,
        serviceId: d.serviceId,
        date:      d.date,
        startTime: d.startTime,
      });
    } else {
      // Specific therapist — verify slot is still available
      await assertSlotAvailable({
        branchId:  d.branchId,
        serviceId: d.serviceId,
        staffId:   d.staffId,
        date:      d.date,
        startTime: d.startTime,
      });
      resolvedStaffId = d.staffId;
    }

    // 3. Compute end_time from service buffers
    const endTime = await computeEndTime(d.startTime, d.serviceId);

    // 4. Build metadata snapshot (price, service name, duration)
    const metadata = await buildBookingSnapshot(d.branchId, d.serviceId, d.notes);

    // 5. Use admin client to bypass RLS for public booking
    const supabase = createAdminClient();

    // 6. Upsert customer by phone
    const { data: customerId, error: custErr } = await supabase.rpc(
      "upsert_customer",
      {
        p_phone:     d.phone,
        p_full_name: d.fullName,
        p_email:     d.email || undefined,
      }
    );
    if (custErr || !customerId) throw new Error("Failed to resolve customer");
    const resolvedCustomerId = String(customerId);

    // 7. Insert booking — status = 'confirmed' (Rule 1: auto-confirm)
    const { data: booking, error: bookErr } = await supabase
      .from("bookings")
      .insert({
        branch_id:          d.branchId,
        service_id:         d.serviceId,
        staff_id:           resolvedStaffId,
        customer_id:        resolvedCustomerId,
        booking_date:       d.date,
        start_time:         d.startTime,
        end_time:           endTime,
        type:               d.type,
        status:             "confirmed",            // Rule 1: auto-confirm
        travel_buffer_mins: d.type === "home_service"
                              ? (d.travelBufferMins ?? 30) // Rule 9: default 30
                              : null,
        metadata,
      })
      .select("id")
      .single();

    if (bookErr || !booking) throw new Error("Failed to create booking");

    return { success: true, bookingId: booking.id };
  } catch (err) {
    if (err instanceof SlotUnavailableError) {
      return { success: false, error: err.message };
    }
    console.error("[createOnlineBooking] Error:", err);
    return { success: false, error: "Something went wrong. Please try again." };
  }
}
