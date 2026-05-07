"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/supabase";
import {
  createOnlineBookingSchema,
  type CreateOnlineBookingInput,
  createOnlineBookingMultiSchema,
  type CreateOnlineBookingMultiInput,
} from "@/lib/validations/booking";
import {
  assignTherapistBySeniority,
  assignTherapistBySeniorityMulti,
  assertSlotAvailable,
} from "@/lib/engine/availability";
import { computeEndTime } from "@/lib/engine/booking-time";
import { buildBookingSnapshot } from "@/lib/engine/snapshot";
import { validateBookingAgainstBranchRules, getBranchBookingRulesOrDefault } from "@/lib/queries/branch-booking-rules";
import { checkHomeServiceDispatchConflict } from "@/lib/bookings/dispatch-conflict";
import { geocodeAddress, buildGoogleMapsSearchUrl } from "@/lib/maps/google-maps";
import { SlotUnavailableError } from "@/types/errors";

export type CreateOnlineBookingResult =
  | { ok: true; bookingId: string }
  | { ok: false; code: string; message: string };

function logBookingError(context: Record<string, unknown>, error: unknown) {
  console.error("[ONLINE_BOOKING_CREATE_FAILED]", {
    ...context,
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
}

export async function createOnlineBookingAction(
  input: CreateOnlineBookingInput
): Promise<CreateOnlineBookingResult> {
  const parsed = createOnlineBookingSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      message: parsed.error.issues[0]?.message ?? "Please check your input and try again.",
    };
  }

  const d = parsed.data;
  const logContext = {
    branchId: d.branchId,
    serviceId: d.serviceId,
    staffId: d.staffId ?? "auto",
    bookingDate: d.date,
    startTime: d.startTime,
  };

  try {
    const rulesCheck = await validateBookingAgainstBranchRules({
      branchId: d.branchId,
      bookingType: d.type,
      date: d.date,
      startTime: d.startTime,
    });
    if (!rulesCheck.ok) {
      return {
        ok: false,
        code: "BOOKING_RULES_ERROR",
        message: rulesCheck.message,
      };
    }

    const supabase = createAdminClient();

    // Verify service eligibility for this booking type
    const { data: eligRow } = await supabase
      .from("branch_services")
      .select("available_in_spa, available_home_service")
      .eq("branch_id", d.branchId)
      .eq("service_id", d.serviceId)
      .eq("is_active", true)
      .maybeSingle();

    if (eligRow) {
      const eligible = d.type !== "home_service" ? eligRow.available_in_spa : eligRow.available_home_service;
      if (!eligible) {
        return {
          ok: false,
          code: "SERVICE_INELIGIBLE",
          message: "This service is not available for this booking type.",
        };
      }
    }

    let resolvedStaffId: string;
    if (!d.staffId) {
      resolvedStaffId = await assignTherapistBySeniority({
        branchId: d.branchId,
        serviceId: d.serviceId,
        date: d.date,
        startTime: d.startTime,
      });
    } else {
      await assertSlotAvailable({
        branchId: d.branchId,
        serviceId: d.serviceId,
        staffId: d.staffId,
        date: d.date,
        startTime: d.startTime,
      });
      resolvedStaffId = d.staffId;
    }

    const endTime = await computeEndTime(d.startTime, d.serviceId);
    const metadata = await buildBookingSnapshot(d.branchId, d.serviceId, d.notes);

    const { data: customerId, error: custErr } = await supabase.rpc(
      "upsert_customer",
      {
        p_phone: d.phone,
        p_full_name: d.fullName,
        p_email: d.email || undefined,
      }
    );
    if (custErr || !customerId) {
      logBookingError(logContext, custErr ?? new Error("upsert_customer returned no ID"));
      return {
        ok: false,
        code: "CUSTOMER_ERROR",
        message: "Failed to create or find customer record. Please check your details and try again.",
      };
    }
    const resolvedCustomerId = String(customerId);

    const { data: booking, error: bookErr } = await supabase
      .from("bookings")
      .insert({
        branch_id: d.branchId,
        service_id: d.serviceId,
        staff_id: resolvedStaffId,
        customer_id: resolvedCustomerId,
        booking_date: d.date,
        start_time: d.startTime,
        end_time: endTime,
        type: d.type,
        status: "pending",
        travel_buffer_mins:
          d.type === "home_service"
            ? (d.travelBufferMins ?? rulesCheck.rules.travelBufferMins)
            : null,
        metadata,
      })
      .select("id")
      .single();

    if (bookErr || !booking) {
      logBookingError(logContext, bookErr ?? new Error("insert returned no booking"));
      return {
        ok: false,
        code: "BOOKING_INSERT_FAILED",
        message: "Could not create booking. The slot may have been taken. Please select a different time.",
      };
    }

    return { ok: true, bookingId: booking.id };
  } catch (err) {
    if (err instanceof SlotUnavailableError) {
      return {
        ok: false,
        code: "SLOT_UNAVAILABLE",
        message: "This time slot is no longer available. Please select another.",
      };
    }
    logBookingError(logContext, err);
    return {
      ok: false,
      code: "UNKNOWN_ERROR",
      message: "Something went wrong. Please try again.",
    };
  }
}

export async function createOnlineBookingMultiAction(
  input: CreateOnlineBookingMultiInput
): Promise<CreateOnlineBookingResult> {
  const parsed = createOnlineBookingMultiSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      message: parsed.error.issues[0]?.message ?? "Please check your input and try again.",
    };
  }

  const d = parsed.data;
  const logContext = {
    branchId: d.branchId,
    serviceIds: d.serviceIds,
    staffId: d.staffId ?? "auto",
    bookingDate: d.date,
    startTime: d.startTime,
  };

  try {
    const rulesCheck = await validateBookingAgainstBranchRules({
      branchId: d.branchId,
      bookingType: d.type,
      date: d.date,
      startTime: d.startTime,
    });
    if (!rulesCheck.ok) {
      return {
        ok: false,
        code: "BOOKING_RULES_ERROR",
        message: rulesCheck.message,
      };
    }

    const supabase = createAdminClient();

    // Verify each service is eligible for this booking type
    const { data: eligibilityRows } = await supabase
      .from("branch_services")
      .select("service_id, available_in_spa, available_home_service")
      .eq("branch_id", d.branchId)
      .in("service_id", d.serviceIds)
      .eq("is_active", true);

    if (eligibilityRows) {
      const needsInSpa = d.type !== "home_service";
      for (const row of eligibilityRows) {
        const eligible = needsInSpa ? row.available_in_spa : row.available_home_service;
        if (!eligible) {
          return {
            ok: false,
            code: "SERVICE_INELIGIBLE",
            message: "One or more selected services are not available for this booking type.",
          };
        }
      }
    }

    let resolvedStaffId: string;
    if (!d.staffId) {
      resolvedStaffId = await assignTherapistBySeniorityMulti({
        branchId: d.branchId,
        serviceIds: d.serviceIds,
        date: d.date,
        startTime: d.startTime,
      });
    } else {
      await assertSlotAvailable({
        branchId: d.branchId,
        serviceId: d.serviceIds[0]!,
        staffId: d.staffId,
        date: d.date,
        startTime: d.startTime,
      });
      resolvedStaffId = d.staffId;
    }

    const { data: customerId, error: custErr } = await supabase.rpc("upsert_customer", {
      p_phone: d.phone,
      p_full_name: d.fullName,
      p_email: d.email || undefined,
    });
    if (custErr || !customerId) {
      logBookingError(logContext, custErr ?? new Error("upsert_customer returned no ID"));
      return {
        ok: false,
        code: "CUSTOMER_ERROR",
        message: "Failed to create or find customer record. Please check your details and try again.",
      };
    }
    const resolvedCustomerId = String(customerId);

    // Home service requires address details
    if (d.type === "home_service") {
      if (!d.homeServiceAddress?.trim()) {
        return { ok: false, code: "HS_ADDRESS_MISSING", message: "Full address is required for home service bookings." };
      }
      if (!d.homeServiceBarangay?.trim() && !d.homeServiceCity?.trim()) {
        return { ok: false, code: "HS_LOCATION_MISSING", message: "Barangay or city is required for home service bookings." };
      }
    }

    // Build home service address data with zone + optional geocode
    let hsAddressData: { [key: string]: Json | undefined } | null = null;
    let dispatchData: { [key: string]: Json | undefined } = {
      needs_location_review: false,
      travel_minutes_estimate: null,
      driver_capacity_checked: false,
      dispatch_warning: null,
    };

    if (d.type === "home_service" && d.homeServiceAddress) {
      const geocoded = await geocodeAddress(
        [d.homeServiceAddress, d.homeServiceBarangay, d.homeServiceCity]
          .filter(Boolean)
          .join(", ")
      );

      hsAddressData = {
        full_address:      d.homeServiceAddress,
        barangay:          d.homeServiceBarangay ?? null,
        city:              d.homeServiceCity ?? null,
        landmark:          d.homeServiceLandmark ?? null,
        parking_notes:     d.homeServiceParkingNotes ?? null,
        zone:              d.homeServiceZone ?? "unknown",
        formatted_address: geocoded?.formattedAddress ?? null,
        place_id:          geocoded?.placeId ?? null,
        lat:               geocoded?.lat ?? null,
        lng:               geocoded?.lng ?? null,
        map_url:           geocoded
          ? buildGoogleMapsSearchUrl(geocoded.lat, geocoded.lng)
          : null,
      } satisfies { [key: string]: Json | undefined };

      // Compute total end time for dispatch check
      const { data: svcsForDispatch } = await supabase
        .from("services")
        .select("duration_minutes, buffer_before, buffer_after")
        .in("id", d.serviceIds);
      const totalMins = (svcsForDispatch ?? []).reduce(
        (s, sv) => s + sv.duration_minutes + sv.buffer_before + sv.buffer_after,
        0
      );
      const dispatchEndH = Math.floor((
        (parseInt(d.startTime.split(":")[0] ?? "0") * 60 +
          parseInt(d.startTime.split(":")[1] ?? "0")) + totalMins
      ) / 60);
      const dispatchEndM = (
        parseInt(d.startTime.split(":")[0] ?? "0") * 60 +
          parseInt(d.startTime.split(":")[1] ?? "0") + totalMins
      ) % 60;
      const estimatedEndTime = `${String(dispatchEndH).padStart(2, "0")}:${String(dispatchEndM).padStart(2, "0")}:00`;

      const branchRules = await getBranchBookingRulesOrDefault(d.branchId);
      const dispatchResult = await checkHomeServiceDispatchConflict({
        branchId: d.branchId,
        bookingDate: d.date,
        startTime: d.startTime,
        endTime: estimatedEndTime,
        selectedZone: d.homeServiceZone ?? "unknown",
        selectedLat: geocoded?.lat ?? null,
        selectedLng: geocoded?.lng ?? null,
        driverCapacity: branchRules.homeServiceDriverCapacity,
      });

      if (dispatchResult.conflict === "hard") {
        return { ok: false, code: "DISPATCH_CONFLICT", message: dispatchResult.message };
      }

      dispatchData = {
        needs_location_review: dispatchResult.conflict === "warning"
          ? (dispatchResult as { needs_location_review: boolean }).needs_location_review
          : false,
        travel_minutes_estimate: null,
        driver_capacity_checked: true,
        dispatch_warning: dispatchResult.conflict === "warning" ? dispatchResult.message : null,
      } satisfies { [key: string]: Json | undefined };
    }

    let currentStart = d.startTime;
    const insertedIds: string[] = [];

    for (const serviceId of d.serviceIds) {
      const endTime = await computeEndTime(currentStart, serviceId);
      const baseSnapshot = await buildBookingSnapshot(d.branchId, serviceId, d.notes);
      const metadata = hsAddressData
        ? { ...baseSnapshot, home_service_address: hsAddressData, dispatch: dispatchData }
        : baseSnapshot;

      const { data: booking, error: bookErr } = await supabase
        .from("bookings")
        .insert({
          branch_id: d.branchId,
          service_id: serviceId,
          staff_id: resolvedStaffId,
          customer_id: resolvedCustomerId,
          booking_date: d.date,
          start_time: currentStart,
          end_time: endTime,
          type: d.type,
          status: "pending",
          travel_buffer_mins:
            d.type === "home_service"
              ? (d.travelBufferMins ?? rulesCheck.rules.travelBufferMins)
              : null,
          metadata,
        })
        .select("id")
        .single();

      if (bookErr || !booking) {
        if (insertedIds.length > 0) {
          await supabase
            .from("bookings")
            .update({ status: "cancelled" })
            .in("id", insertedIds);
        }
        logBookingError(
          { ...logContext, serviceId, currentStart, endTime },
          bookErr ?? new Error("insert returned no booking")
        );
        return {
          ok: false,
          code: "BOOKING_INSERT_FAILED",
          message: "Could not create booking. The slot may have been taken. Please select a different time.",
        };
      }

      insertedIds.push(booking.id);
      currentStart = endTime;
    }

    return { ok: true, bookingId: insertedIds[0]! };
  } catch (err) {
    if (err instanceof SlotUnavailableError) {
      return {
        ok: false,
        code: "SLOT_UNAVAILABLE",
        message: "This time slot is no longer available. Please select another.",
      };
    }
    logBookingError(logContext, err);
    return {
      ok: false,
      code: "UNKNOWN_ERROR",
      message: "Something went wrong. Please try again.",
    };
  }
}
