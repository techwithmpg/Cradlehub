"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { isPastSlot, BRANCH_TIMEZONE } from "@/lib/engine/slot-time";
import type { Json } from "@/types/supabase";
import {
  createOnlineBookingSchema,
  type CreateOnlineBookingInput,
  createOnlineBookingMultiSchema,
  PRECISE_HOME_SERVICE_LOCATION_MESSAGE,
  type CreateOnlineBookingMultiInput,
} from "@/lib/validations/booking";
import {
  assignTherapistBySeniority,
  assignTherapistBySeniorityMulti,
} from "@/lib/engine/availability";
import { computeEndTime } from "@/lib/engine/booking-time";
import { buildBookingSnapshot } from "@/lib/engine/snapshot";
import { validateBookingAgainstBranchRules, getBranchBookingRulesOrDefault } from "@/lib/queries/branch-booking-rules";
import { checkHomeServiceDispatchConflict } from "@/lib/bookings/dispatch-conflict";
import { buildGoogleMapsSearchUrl } from "@/lib/maps/google-maps";
import { SlotUnavailableError } from "@/types/errors";
import { createNotification } from "@/lib/notifications/create";
import { logError, logBusinessEvent } from "@/lib/logger";
import { revalidateOperationalBookingSurfaces } from "@/lib/bookings/revalidate-booking-surfaces";
import { getPublicBookingHoldExpiresAt } from "@/lib/bookings/hold-status";
import { evaluateOnlineSelectedStaff } from "@/lib/bookings/online-selected-staff";
import {
  createOpenStaffScheduleException,
  readStaffScheduleException,
  type StaffScheduleExceptionReasonCode,
} from "@/lib/bookings/staff-schedule-exception";
import { createStaffScheduleExceptionSignals } from "@/lib/bookings/staff-schedule-exception-signals";
import {
  CONSULTATION_ONLY_CUSTOMER_MESSAGE,
  isConsultationOnlyService,
} from "@/lib/bookings/consultation-only-service";

async function containsConsultationOnlyService(
  supabase: ReturnType<typeof createAdminClient>,
  serviceIds: string[]
): Promise<boolean> {
  const { data, error } = await supabase
    .from("services")
    .select("name, metadata, service_categories(name)")
    .in("id", serviceIds);
  if (error || !data || data.length !== new Set(serviceIds).size) return true;

  return data.some((service) => {
    const categoryValue = service.service_categories;
    const category = Array.isArray(categoryValue) ? categoryValue[0] : categoryValue;
    return isConsultationOnlyService({
      name: service.name,
      categoryName: category?.name ?? null,
      metadata: service.metadata,
    });
  });
}

export type CreateOnlineBookingResult =
  | {
      ok: true;
      bookingId: string;
      staffPreferenceNeedsConfirmation?: boolean;
    }
  | { ok: false; code: string; message: string };

const PUBLIC_BOOKING_COOLDOWN_MS = 5 * 60 * 1000;
const MAX_PUBLIC_BOOKING_PAYLOAD_BYTES = 12_000;

function normalizePhone(value: string): string {
  return value.replace(/\D/g, "");
}

function payloadIsOversized(input: unknown): boolean {
  return new TextEncoder().encode(JSON.stringify(input)).length > MAX_PUBLIC_BOOKING_PAYLOAD_BYTES;
}

async function hasRecentDuplicateBooking(params: {
  supabase: ReturnType<typeof createAdminClient>;
  branchId: string;
  serviceIds: string[];
  phone: string;
  email?: string;
}): Promise<boolean> {
  const normalizedPhone = normalizePhone(params.phone);
  let customerQuery = params.supabase
    .from("customers")
    .select("id")
    .in("phone", [params.phone, normalizedPhone]);
  if (params.email) customerQuery = customerQuery.or(`email.eq.${params.email.toLowerCase()}`);
  const { data: customers, error: customerError } = await customerQuery;
  if (customerError || !customers?.length) return false;

  const { data, error } = await params.supabase
    .from("bookings")
    .select("id")
    .eq("branch_id", params.branchId)
    .in("service_id", params.serviceIds)
    .in("customer_id", customers.map((customer) => customer.id))
    .gte("created_at", new Date(Date.now() - PUBLIC_BOOKING_COOLDOWN_MS).toISOString())
    .limit(1);
  if (error) throw error;
  return Boolean(data?.length);
}

function logBookingError(context: Record<string, unknown>, error: unknown) {
  logError("booking.online.failed", { action: "booking.online.create", ...context, error });
}

function toAddressComponentsJson(
  components: CreateOnlineBookingMultiInput["homeServiceAddressComponents"]
): Json | null {
  if (!components || components.length === 0) return null;

  return components.map(
    (component) =>
      ({
        long_name: component.long_name,
        short_name: component.short_name,
        types: component.types,
      }) satisfies { [key: string]: Json | undefined }
  );
}

export async function createOnlineBookingAction(
  input: CreateOnlineBookingInput
): Promise<CreateOnlineBookingResult> {
  if (payloadIsOversized(input)) {
    return { ok: false, code: "PAYLOAD_TOO_LARGE", message: "Please shorten your request and try again." };
  }
  const parsed = createOnlineBookingSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      message: parsed.error.issues[0]?.message ?? "Please check your input and try again.",
    };
  }

  const d = parsed.data;
  const deliveryType = d.deliveryType ?? (d.type === "home_service" ? "home_service" : "in_spa");
  const logContext = {
    branchId: d.branchId,
    serviceId: d.serviceId,
    staffId: d.staffId ?? "auto",
    bookingDate: d.date,
    startTime: d.startTime,
  };

  try {
    // Home service requires address+zone for dispatch validation — must use the
    // multi-service action which carries those fields.
    if (d.type === "home_service") {
      return {
        ok: false,
        code: "USE_MULTI_ACTION",
        message: "Home Service bookings require additional address details. Please use the booking wizard.",
      };
    }

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

    if (await containsConsultationOnlyService(supabase, [d.serviceId])) {
      return {
        ok: false,
        code: "CONSULTATION_REQUIRED",
        message: CONSULTATION_ONLY_CUSTOMER_MESSAGE,
      };
    }

    if (await hasRecentDuplicateBooking({
      supabase,
      branchId: d.branchId,
      serviceIds: [d.serviceId],
      phone: d.phone,
      email: d.email || undefined,
    })) {
      return {
        ok: false,
        code: "DUPLICATE_REQUEST",
        message: "We already received this booking request. Please wait a few minutes before trying again.",
      };
    }

    // Verify service eligibility for this booking type
    const { data: eligRow } = await supabase
      .from("branch_services")
      .select("available_in_spa, available_home_service, visibility")
      .eq("branch_id", d.branchId)
      .eq("service_id", d.serviceId)
      .eq("is_active", true)
      .maybeSingle();

    if (!eligRow || eligRow.visibility !== "public" || !eligRow.available_in_spa) {
      return {
        ok: false,
        code: "SERVICE_INELIGIBLE",
        message: "This service is not available for this booking type.",
      };
    }

    const endTime = await computeEndTime(d.startTime, d.serviceId);
    let resolvedStaffId: string;
    let selectedStaffException: {
      reason: StaffScheduleExceptionReasonCode;
      staffName: string;
    } | null = null;
    if (!d.staffId) {
      resolvedStaffId = await assignTherapistBySeniority({
        branchId: d.branchId,
        serviceId: d.serviceId,
        date: d.date,
        startTime: d.startTime,
      });
    } else {
      const selectedStaff = await evaluateOnlineSelectedStaff({
        branchId: d.branchId,
        serviceIds: [d.serviceId],
        staffId: d.staffId,
        date: d.date,
        startTime: d.startTime,
        endTime,
      });
      if (!selectedStaff.ok) return selectedStaff;
      resolvedStaffId = d.staffId;
      selectedStaffException = selectedStaff.exceptionReason
        ? {
            reason: selectedStaff.exceptionReason,
            staffName: selectedStaff.staffName,
          }
        : null;
    }

    const baseMetadata = await buildBookingSnapshot(d.branchId, d.serviceId, d.notes);
    const metadata = selectedStaffException
      ? createOpenStaffScheduleException(baseMetadata, {
          reasonCode: selectedStaffException.reason,
          selectedStaffId: resolvedStaffId,
          selectedStaffName: selectedStaffException.staffName,
          customerName: d.fullName,
          branchId: d.branchId,
          bookingDate: d.date,
          startTime: d.startTime,
          endTime,
          createdAt: new Date().toISOString(),
        })
      : baseMetadata;
    const holdExpiresAt = getPublicBookingHoldExpiresAt();

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
        delivery_type: deliveryType,
        status: "pending_payment",
        payment_method: "pay_on_site",
        payment_status: "pending",
        amount_paid: 0,
        hold_expires_at: holdExpiresAt,
        travel_buffer_mins: null,
        metadata: metadata as Json,
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

    const scheduleException = readStaffScheduleException(metadata);
    if (scheduleException) {
      try {
        await createStaffScheduleExceptionSignals({
          bookingId: booking.id,
          exception: scheduleException,
        });
      } catch (notifyErr) {
        logBookingError(
          { ...logContext, notificationType: "staff_schedule_exception" },
          notifyErr instanceof Error ? notifyErr : new Error(String(notifyErr))
        );
      }
    }

    // Notifications are best-effort; do not fail the booking if they error.
    // Online booking is pending — notify CRM only; staff gets notified after payment is confirmed.
    try {
      const { data: notificationService } = await supabase
        .from("services")
        .select("name")
        .eq("id", d.serviceId)
        .maybeSingle();
      const serviceName = notificationService?.name ?? "Service";
      await createNotification({
        branchId: d.branchId,
        targetWorkspace: "crm",
        type: "payment_pending",
        title: `New online booking — ${d.fullName}`,
        body: `${serviceName} · ${d.date} at ${d.startTime}. Payment confirmation is required before the assigned therapist is notified.`,
        entityType: "booking",
        entityId: booking.id,
        actionHref: `/crm/bookings?bookingId=${booking.id}`,
        priority: "high",
        requiresAction: true,
        dedupeKey: `booking:${booking.id}:payment_pending`,
        metadata: {
          customer_name: d.fullName,
          service_name: serviceName,
          booking_date: d.date,
          start_time: d.startTime,
          delivery_type: deliveryType,
        },
      });
    } catch (notifyErr) {
      logBookingError(logContext, notifyErr instanceof Error ? notifyErr : new Error(String(notifyErr)));
    }

    logBusinessEvent("booking.online.submitted", {
      branchId: d.branchId,
      bookingId: booking.id,
      customerId: resolvedCustomerId,
      staffId: resolvedStaffId,
      serviceId: d.serviceId,
      bookingType: d.type,
    });
    revalidateOperationalBookingSurfaces(d.branchId);
    return {
      ok: true,
      bookingId: booking.id,
      ...(scheduleException ? { staffPreferenceNeedsConfirmation: true } : {}),
    };
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
  if (payloadIsOversized(input)) {
    return { ok: false, code: "PAYLOAD_TOO_LARGE", message: "Please shorten your request and try again." };
  }
  const parsed = createOnlineBookingMultiSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      message: parsed.error.issues[0]?.message ?? "Please check your input and try again.",
    };
  }

  const d = parsed.data;
  const deliveryType = d.deliveryType ?? (d.type === "home_service" ? "home_service" : "in_spa");
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

    // Guard: reject if the customer is submitting a time that has already passed
    // in the branch's local timezone (Asia/Manila). This catches stale-slot
    // submissions where the UI was loaded earlier and the slot expired while the
    // customer was filling in the form.
    if (
      isPastSlot({
        selectedDate: d.date,
        slotStartTime: d.startTime,
        timezone: BRANCH_TIMEZONE,
      })
    ) {
      return {
        ok: false,
        code: "SLOT_IN_PAST",
        message:
          "That time is no longer available. Please choose a later time.",
      };
    }

    const supabase = createAdminClient();

    if (await containsConsultationOnlyService(supabase, d.serviceIds)) {
      return {
        ok: false,
        code: "CONSULTATION_REQUIRED",
        message: CONSULTATION_ONLY_CUSTOMER_MESSAGE,
      };
    }

    if (await hasRecentDuplicateBooking({
      supabase,
      branchId: d.branchId,
      serviceIds: d.serviceIds,
      phone: d.phone,
      email: d.email || undefined,
    })) {
      return {
        ok: false,
        code: "DUPLICATE_REQUEST",
        message: "We already received this booking request. Please wait a few minutes before trying again.",
      };
    }

    // Verify each service is eligible for this booking type
    const { data: eligibilityRows } = await supabase
      .from("branch_services")
      .select("service_id, available_in_spa, available_home_service, visibility")
      .eq("branch_id", d.branchId)
      .in("service_id", d.serviceIds)
      .eq("is_active", true);

    const uniqueServiceIds = new Set(d.serviceIds);
    if (!eligibilityRows || eligibilityRows.length !== uniqueServiceIds.size) {
      return {
        ok: false,
        code: "SERVICE_INELIGIBLE",
        message: "One or more selected services are not available for public booking.",
      };
    }

    const needsInSpa = deliveryType !== "home_service";
    for (const row of eligibilityRows) {
      const eligible =
        row.visibility === "public" &&
        (needsInSpa ? row.available_in_spa : row.available_home_service);
      if (!eligible) {
        return {
          ok: false,
          code: "SERVICE_INELIGIBLE",
          message: "One or more selected services are not available for this booking type.",
        };
      }
    }

    const serviceTimes: Array<{
      serviceId: string;
      startTime: string;
      endTime: string;
    }> = [];
    let selectedRangeEnd = d.startTime;
    for (const serviceId of d.serviceIds) {
      const endTime = await computeEndTime(selectedRangeEnd, serviceId);
      serviceTimes.push({
        serviceId,
        startTime: selectedRangeEnd,
        endTime,
      });
      selectedRangeEnd = endTime;
    }

    let resolvedStaffId: string;
    let selectedStaffException: {
      reason: StaffScheduleExceptionReasonCode;
      staffName: string;
    } | null = null;
    if (!d.staffId) {
      resolvedStaffId = await assignTherapistBySeniorityMulti({
        branchId: d.branchId,
        serviceIds: d.serviceIds,
        date: d.date,
        startTime: d.startTime,
      });
    } else {
      const selectedStaff = await evaluateOnlineSelectedStaff({
        branchId: d.branchId,
        serviceIds: d.serviceIds,
        staffId: d.staffId,
        date: d.date,
        startTime: d.startTime,
        endTime: selectedRangeEnd,
      });
      if (!selectedStaff.ok) return selectedStaff;
      resolvedStaffId = d.staffId;
      selectedStaffException = selectedStaff.exceptionReason
        ? {
            reason: selectedStaff.exceptionReason,
            staffName: selectedStaff.staffName,
          }
        : null;
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

    // Public home service requires a selected Google place, not typed text alone.
    if (deliveryType === "home_service") {
      if (
        !d.homeServicePlaceId?.trim() ||
        !d.homeServiceFormattedAddress?.trim() ||
        typeof d.homeServiceLat !== "number" ||
        !Number.isFinite(d.homeServiceLat) ||
        typeof d.homeServiceLng !== "number" ||
        !Number.isFinite(d.homeServiceLng)
      ) {
        return {
          ok: false,
          code: "HS_PRECISE_LOCATION_REQUIRED",
          message: PRECISE_HOME_SERVICE_LOCATION_MESSAGE,
        };
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

    if (deliveryType === "home_service") {
      const homeServiceLat = d.homeServiceLat as number;
      const homeServiceLng = d.homeServiceLng as number;
      const formattedAddress = d.homeServiceFormattedAddress?.trim() ?? "";
      const mapUrl =
        d.homeServiceMapUrl?.trim() ||
        buildGoogleMapsSearchUrl(homeServiceLat, homeServiceLng);

      hsAddressData = {
        address:           formattedAddress,
        full_address:      d.homeServiceAddress?.trim() || formattedAddress,
        address_details:   d.homeServiceAddressDetails ?? null,
        barangay:          d.homeServiceBarangay ?? null,
        city:              d.homeServiceCity ?? null,
        landmark:          d.homeServiceLandmark ?? null,
        parking_notes:     d.homeServiceParkingNotes ?? null,
        delivery_notes:    d.homeServiceCustomerNotes ?? d.homeServiceParkingNotes ?? null,
        notes:             d.homeServiceCustomerNotes ?? d.homeServiceParkingNotes ?? null,
        customer_notes:    d.homeServiceCustomerNotes ?? d.homeServiceParkingNotes ?? null,
        zone:              d.homeServiceZone ?? "unknown",
        formatted_address: formattedAddress,
        place_id:          d.homeServicePlaceId?.trim() ?? null,
        lat:               homeServiceLat,
        lng:               homeServiceLng,
        address_components: toAddressComponentsJson(d.homeServiceAddressComponents),
        map_url:           mapUrl,
        source:            "google_places",
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
        selectedLat: homeServiceLat,
        selectedLng: homeServiceLng,
        driverCapacity: branchRules.homeServiceDriverCapacity,
      });

      if (dispatchResult.conflict === "hard") {
        return { ok: false, code: "DISPATCH_CONFLICT", message: dispatchResult.message };
      }

      dispatchData = {
        needs_location_review: dispatchResult.conflict === "warning"
          ? dispatchResult.needs_location_review
          : false,
        travel_minutes_estimate: null,
        driver_capacity_checked: true,
        dispatch_warning: dispatchResult.conflict === "warning" ? dispatchResult.message : null,
      } satisfies { [key: string]: Json | undefined };
    }

    const insertedIds: string[] = [];
    const insertedScheduleExceptions: Array<{
      bookingId: string;
      exception: NonNullable<ReturnType<typeof readStaffScheduleException>>;
    }> = [];
    const holdExpiresAt = getPublicBookingHoldExpiresAt();

    for (const serviceTime of serviceTimes) {
      const { serviceId, startTime, endTime } = serviceTime;
      const baseSnapshot = await buildBookingSnapshot(d.branchId, serviceId, d.notes);
      const deliveryMetadata = hsAddressData
        ? { ...baseSnapshot, home_service_address: hsAddressData, dispatch: dispatchData }
        : baseSnapshot;
      const metadata = selectedStaffException
        ? createOpenStaffScheduleException(deliveryMetadata, {
            reasonCode: selectedStaffException.reason,
            selectedStaffId: resolvedStaffId,
            selectedStaffName: selectedStaffException.staffName,
            customerName: d.fullName,
            branchId: d.branchId,
            bookingDate: d.date,
            startTime,
            endTime,
            createdAt: new Date().toISOString(),
          })
        : deliveryMetadata;

      const { data: booking, error: bookErr } = await supabase
        .from("bookings")
        .insert({
          branch_id: d.branchId,
          service_id: serviceId,
          staff_id: resolvedStaffId,
          customer_id: resolvedCustomerId,
          booking_date: d.date,
          start_time: startTime,
          end_time: endTime,
          type: d.type,
          delivery_type: deliveryType,
          status: "pending_payment",
          payment_method: "pay_on_site",
          payment_status: "pending",
          amount_paid: 0,
          hold_expires_at: holdExpiresAt,
          travel_buffer_mins:
            deliveryType === "home_service"
              ? (d.travelBufferMins ?? rulesCheck.rules.travelBufferMins)
              : null,
          metadata: metadata as Json,
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
          { ...logContext, serviceId, currentStart: startTime, endTime },
          bookErr ?? new Error("insert returned no booking")
        );
        return {
          ok: false,
          code: "BOOKING_INSERT_FAILED",
          message: "Could not create booking. The slot may have been taken. Please select a different time.",
        };
      }

      insertedIds.push(booking.id);
      const scheduleException = readStaffScheduleException(metadata);
      if (scheduleException) {
        insertedScheduleExceptions.push({
          bookingId: booking.id,
          exception: scheduleException,
        });
      }
    }

    const isHSMulti = deliveryType === "home_service";
    const { data: notificationServices } = await supabase
      .from("services")
      .select("id, name")
      .in("id", d.serviceIds);
    const serviceNames = (notificationServices ?? [])
      .map((service) => service.name)
      .filter(Boolean)
      .join(", ") || (d.serviceIds.length > 1 ? "Multiple services" : "Service");
    // Online booking is pending — notify CRM only; staff gets notified after payment is confirmed.
    const notificationJobs: Promise<void>[] = [
      createNotification({
        branchId: d.branchId,
        targetWorkspace: "crm",
        type: "payment_pending",
        title: `New online booking — ${d.fullName}`,
        body: `${serviceNames}${isHSMulti ? " · Home Service" : ""} · ${d.date} at ${d.startTime}. Payment confirmation is required before the assigned therapist is notified.`,
        entityType: "booking",
        entityId: insertedIds[0],
        actionHref: `/crm/bookings?bookingId=${insertedIds[0]}`,
        priority: "high",
        requiresAction: true,
        dedupeKey: `booking:${insertedIds[0]}:payment_pending`,
        metadata: {
          customer_name: d.fullName,
          service_name: serviceNames,
          booking_date: d.date,
          start_time: d.startTime,
          delivery_type: deliveryType,
          group_booking_ids: insertedIds,
        },
      }),
    ];

    for (const scheduleException of insertedScheduleExceptions) {
      notificationJobs.push(
        createStaffScheduleExceptionSignals(scheduleException)
      );
    }

    if (isHSMulti && dispatchData.needs_location_review === true) {
      notificationJobs.push(
        createNotification({
          branchId: d.branchId,
          targetWorkspace: "crm",
          type: "home_service_location_review",
          title: `Home Service location review needed — ${d.fullName}`,
          body: `${d.fullName}'s Home Service booking on ${d.date} at ${d.startTime} needs location or driver review.`,
          entityType: "booking",
          entityId: insertedIds[0],
          actionHref: "/crm/today",
          priority: "high",
          requiresAction: true,
          dedupeKey: `booking:${insertedIds[0]}:location_review`,
        })
      );
    }

    if (isHSMulti && typeof dispatchData.dispatch_warning === "string") {
      notificationJobs.push(
        createNotification({
          branchId: d.branchId,
          targetWorkspace: "crm",
          type: "home_service_dispatch_conflict",
          title: `Home Service dispatch conflict — ${d.fullName}`,
          body: `${d.fullName}'s Home Service booking on ${d.date} at ${d.startTime} may clash with another location or driver capacity.`,
          entityType: "booking",
          entityId: insertedIds[0],
          actionHref: "/crm/today",
          priority: "high",
          requiresAction: true,
          dedupeKey: `booking:${insertedIds[0]}:dispatch_conflict`,
        })
      );
    }

    // Notifications are best-effort; do not fail the booking if they error
    try {
      await Promise.all(notificationJobs);
    } catch (notifyErr) {
      logBookingError(logContext, notifyErr instanceof Error ? notifyErr : new Error(String(notifyErr)));
    }

    logBusinessEvent("booking.online.submitted", {
      branchId: d.branchId,
      bookingIds: insertedIds,
      bookingId: insertedIds[0],
      customerId: resolvedCustomerId,
      staffId: resolvedStaffId,
      serviceIds: d.serviceIds,
      bookingType: d.type,
      deliveryType,
      serviceCount: insertedIds.length,
    });
    revalidateOperationalBookingSurfaces(d.branchId);
    return {
      ok: true,
      bookingId: insertedIds[0]!,
      ...(insertedScheduleExceptions.length > 0
        ? { staffPreferenceNeedsConfirmation: true }
        : {}),
    };
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
