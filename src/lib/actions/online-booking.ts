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
  assignTherapistsForOrder,
} from "@/lib/engine/availability";
import { computeEndTime } from "@/lib/engine/booking-time";
import { buildBookingSnapshot } from "@/lib/engine/snapshot";
import {
  validateBookingAgainstBranchRules,
  getBranchBookingRulesOrDefault,
} from "@/lib/queries/branch-booking-rules";
import { checkHomeServiceDispatchConflict } from "@/lib/bookings/dispatch-conflict";
import { buildGoogleMapsSearchUrl } from "@/lib/maps/google-maps";
import { SlotUnavailableError } from "@/types/errors";
import { createNotification } from "@/lib/notifications/create";
import { logError, logBusinessEvent } from "@/lib/logger";
import { revalidateOperationalBookingSurfaces } from "@/lib/bookings/revalidate-booking-surfaces";
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
import { validateBranchServiceEligibility } from "@/lib/services/service-catalog";
import {
  buildAtomicBookingOrderPayload,
  mapAtomicBookingRpcError,
  type CreateBookingOrderAtomicResult,
} from "@/lib/bookings/bkg3-atomic-contract";
import {
  buildBookingOrderMetadata,
  generateOrderNumber,
  type BookingOrderSummary,
  type BookingOrderAttendee,
} from "@/lib/bookings/booking-order-contract";
import {
  calculateHomeServiceTravelFee,
  haversineDistanceKm,
} from "@/lib/home-service/distance-fee";

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
      orderId?: string;
      orderNumber?: string;
      serviceLineIds?: string[];
      attendeeIds?: string[];
      idempotencyStatus?: "created" | "replayed";
      serviceCount?: number;
      attendeeCount?: number;
      totalAmount?: number;
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
    .in(
      "customer_id",
      customers.map((customer) => customer.id)
    )
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
    return {
      ok: false,
      code: "PAYLOAD_TOO_LARGE",
      message: "Please shorten your request and try again.",
    };
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
        message:
          "Home Service bookings require additional address details. Please use the booking wizard.",
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

    if (
      await hasRecentDuplicateBooking({
        supabase,
        branchId: d.branchId,
        serviceIds: [d.serviceId],
        phone: d.phone,
        email: d.email || undefined,
      })
    ) {
      return {
        ok: false,
        code: "DUPLICATE_REQUEST",
        message:
          "We already received this booking request. Please wait a few minutes before trying again.",
      };
    }

    const serviceEligibility = await validateBranchServiceEligibility({
      branchId: d.branchId,
      serviceIds: [d.serviceId],
      audience: "public",
      deliveryMode: deliveryType,
      useAdminClient: true,
    });
    if (!serviceEligibility.ok) {
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
        requireStaffServiceAssignment: true,
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

    const { data: notificationService } = await supabase
      .from("services")
      .select("name, price, duration_minutes")
      .eq("id", d.serviceId)
      .maybeSingle();
    const serviceName = notificationService?.name ?? "Service";
    const servicePrice = notificationService?.price ?? 0;
    const serviceDuration = notificationService?.duration_minutes ?? 60;

    const baseMetadata = await buildBookingSnapshot(d.branchId, d.serviceId, d.notes);
    const orderId = crypto.randomUUID();
    const orderNumber = generateOrderNumber(d.date);

    const attendee: BookingOrderAttendee = {
      id: "att-1",
      index: 0,
      name: d.fullName,
      isOrganizer: true,
      serviceIds: [d.serviceId],
      serviceNames: [serviceName],
      notes: d.notes ?? null,
    };

    const orderSummary: BookingOrderSummary = {
      orderId,
      orderNumber,
      branchId: d.branchId,
      bookingDate: d.date,
      startTime: d.startTime,
      deliveryType: deliveryType === "home_service" ? "home_service" : "in_spa",
      bookingFor: "me",
      organizer: {
        fullName: d.fullName,
        phone: d.phone,
        email: d.email || null,
        notes: d.notes || null,
      },
      attendees: [attendee],
      totalAttendees: 1,
      totalServices: 1,
      totalDurationMinutes: serviceDuration,
      subtotalAmount: servicePrice,
      homeServiceFee: 0,
      totalAmount: servicePrice,
      paymentChoice: "pay_later",
      paymentStatus: "unpaid",
      bookingIds: [],
      createdAt: new Date().toISOString(),
    };

    const orderMetadata = buildBookingOrderMetadata({
      orderSummary,
      attendee,
      serviceLine: {
        serviceId: d.serviceId,
        serviceName,
        price: servicePrice,
        durationMinutes: serviceDuration,
        attendeeIndex: 0,
        attendeeId: attendee.id,
        attendeeName: attendee.name,
        serviceLineIndex: 0,
        totalServicesForAttendee: 1,
      },
      groupBookingIds: [],
    });

    const combinedMetadata = { ...baseMetadata, ...orderMetadata };

    const metadata = selectedStaffException
      ? createOpenStaffScheduleException(combinedMetadata, {
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
      : combinedMetadata;

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
        message:
          "Failed to create or find customer record. Please check your details and try again.",
      };
    }
    const resolvedCustomerId = String(customerId);

    // This legacy single-service action is not used by the current wizard, but
    // remains callable. Public requests must never bypass CRM review.
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
        status: "pending_crm_confirmation",
        payment_method: "pay_on_site",
        payment_status: "unpaid",
        amount_paid: 0,
        hold_expires_at: null,
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
        message:
          "Could not create booking. The slot may have been taken. Please select a different time.",
      };
    }

    // Update metadata with booking ID
    const updatedMetadata = {
      ...metadata,
      group_booking_ids: [booking.id],
      booking_order: {
        ...(((metadata as Record<string, unknown>).booking_order as Record<string, unknown>) || {}),
        booking_ids: [booking.id],
      },
    };
    await supabase
      .from("bookings")
      .update({ metadata: updatedMetadata as Json })
      .eq("id", booking.id);

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

    // Notify CRM of the review task; assignment remains provisional until review.
    try {
      await Promise.all([
        createNotification({
          branchId: d.branchId,
          targetWorkspace: "crm",
          type: "booking_created",
          title: `New online booking — ${d.fullName} (${orderNumber})`,
          body: `${serviceName} · ${d.date} at ${d.startTime}. Booking request awaits CRM confirmation. Payment is separate.`,
          entityType: "booking",
          entityId: booking.id,
          actionHref: `/crm/bookings?bookingId=${booking.id}`,
          priority: "high",
          requiresAction: true,
          dedupeKey: `booking:${booking.id}:created`,
          metadata: {
            order_id: orderId,
            order_number: orderNumber,
            customer_name: d.fullName,
            service_name: serviceName,
            booking_date: d.date,
            start_time: d.startTime,
            delivery_type: deliveryType,
          },
        }),
        createNotification({
          branchId: d.branchId,
          targetWorkspace: "staff",
          recipientStaffId: resolvedStaffId,
          type: "booking_assigned",
          title: `Booking request — ${d.fullName}`,
          body: `Provisional ${serviceName} assignment for ${d.date} at ${d.startTime}; awaiting CRM confirmation.`,
          entityType: "booking",
          entityId: booking.id,
          actionHref: "/staff-portal/schedule",
          priority: "normal",
          dedupeKey: `booking:${booking.id}:staff_assignment`,
        }),
      ]);
    } catch (notifyErr) {
      logBookingError(
        logContext,
        notifyErr instanceof Error ? notifyErr : new Error(String(notifyErr))
      );
    }

    logBusinessEvent("booking.online.submitted", {
      branchId: d.branchId,
      bookingId: booking.id,
      orderId,
      orderNumber,
      customerId: resolvedCustomerId,
      staffId: resolvedStaffId,
      serviceId: d.serviceId,
      bookingType: d.type,
    });
    revalidateOperationalBookingSurfaces(d.branchId);
    return {
      ok: true,
      bookingId: booking.id,
      orderId,
      orderNumber,
      serviceCount: 1,
      attendeeCount: 1,
      totalAmount: servicePrice,
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
    return {
      ok: false,
      code: "PAYLOAD_TOO_LARGE",
      message: "Please shorten your request and try again.",
    };
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
  if (d.paymentChoice === "pay_now") {
    return {
      ok: false,
      code: "ONLINE_PAYMENT_UNAVAILABLE",
      message: "Online payment is not available. Choose pay later to send your booking request.",
    };
  }
  const deliveryType = d.deliveryType ?? (d.type === "home_service" ? "home_service" : "in_spa");
  const logContext = {
    branchId: d.branchId,
    serviceIds: d.serviceIds,
    staffId: d.staffId ?? "auto",
    bookingDate: d.date,
    startTime: d.startTime,
  };

  // Local development safety guard: allows verifying UI completion in dev without mutating database
  if (process.env.NODE_ENV === "development" && d.dryRun === true) {
    return {
      ok: true,
      bookingId: "dev-dry-run-booking-id",
      orderId: "dev-dry-run-order-id",
      orderNumber: "CRD-DEV-DRYRUN",
      staffPreferenceNeedsConfirmation: false,
    };
  }

  try {
    const supabase = createAdminClient();
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
        message: "That time is no longer available. Please choose a later time.",
      };
    }

    const bookingFor = d.bookingFor ?? "me";
    const paymentChoice = d.paymentChoice ?? "pay_later";

    let attendees: BookingOrderAttendee[];
    if (d.attendees && d.attendees.length > 0) {
      attendees = d.attendees.map((a, idx) => ({
        id: a.id || `att-${idx + 1}`,
        index: idx,
        name:
          a.name?.trim() ||
          (idx === 0 && bookingFor !== "someone_else" ? d.fullName : `Guest ${idx + 1}`),
        isOrganizer: idx === 0 && bookingFor !== "someone_else",
        serviceIds: a.serviceIds,
        notes: a.notes ?? null,
      }));
    } else {
      attendees = [
        {
          id: "att-1",
          index: 0,
          name:
            bookingFor === "someone_else" && d.recipientName?.trim()
              ? d.recipientName.trim()
              : d.fullName,
          isOrganizer: bookingFor !== "someone_else",
          serviceIds: d.serviceIds,
          notes: d.notes ?? null,
        },
      ];
    }

    const allServiceIds = Array.from(new Set(attendees.flatMap((a) => a.serviceIds)));

    if (await containsConsultationOnlyService(supabase, allServiceIds)) {
      return {
        ok: false,
        code: "CONSULTATION_REQUIRED",
        message: CONSULTATION_ONLY_CUSTOMER_MESSAGE,
      };
    }

    if (
      await hasRecentDuplicateBooking({
        supabase,
        branchId: d.branchId,
        serviceIds: allServiceIds,
        phone: d.phone,
        email: d.email || undefined,
      })
    ) {
      return {
        ok: false,
        code: "DUPLICATE_REQUEST",
        message:
          "We already received this booking request. Please wait a few minutes before trying again.",
      };
    }

    const serviceEligibility = await validateBranchServiceEligibility({
      branchId: d.branchId,
      serviceIds: allServiceIds,
      audience: "public",
      deliveryMode: deliveryType,
      useAdminClient: true,
    });
    if (!serviceEligibility.ok) {
      return {
        ok: false,
        code: "SERVICE_INELIGIBLE",
        message: "One or more selected services are not available for this booking type.",
      };
    }

    type DbServiceRow = {
      id: string;
      name: string;
      price: number;
      duration_minutes: number;
      buffer_before: number;
      buffer_after: number;
    };

    const { data: dbServices, error: dbSvcErr } = await supabase
      .from("services")
      .select("id, name, price, duration_minutes, buffer_before, buffer_after")
      .in("id", allServiceIds);
    if (dbSvcErr || !dbServices) {
      logBookingError(logContext, dbSvcErr ?? new Error("services query failed"));
      return {
        ok: false,
        code: "SERVICES_NOT_FOUND",
        message: "Failed to load service details. Please try again.",
      };
    }
    const servicesMap = new Map<string, DbServiceRow>(
      (dbServices as unknown as DbServiceRow[]).map((s) => [s.id, s])
    );

    // Staff assignment: single attendee vs multiple concurrent attendees
    let attendeeStaffAssignments: Array<{ attendeeId?: string; staffId: string }>;
    let selectedStaffException: {
      reason: StaffScheduleExceptionReasonCode;
      staffName: string;
    } | null = null;

    if (attendees.length === 1) {
      const attendeeServiceIds = attendees[0]!.serviceIds;
      let selectedRangeEnd = d.startTime;
      for (const serviceId of attendeeServiceIds) {
        selectedRangeEnd = await computeEndTime(selectedRangeEnd, serviceId);
      }

      let resolvedStaffId: string;
      if (!d.staffId) {
        resolvedStaffId = await assignTherapistBySeniorityMulti({
          branchId: d.branchId,
          serviceIds: attendeeServiceIds,
          date: d.date,
          startTime: d.startTime,
          deliveryMode: deliveryType,
          requireStaffServiceAssignment: true,
        });
      } else {
        const selectedStaff = await evaluateOnlineSelectedStaff({
          branchId: d.branchId,
          serviceIds: attendeeServiceIds,
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
      attendeeStaffAssignments = [{ attendeeId: attendees[0]!.id, staffId: resolvedStaffId }];
    } else {
      attendeeStaffAssignments = await assignTherapistsForOrder({
        branchId: d.branchId,
        attendees: attendees.map((a) => ({ id: a.id, serviceIds: a.serviceIds })),
        date: d.date,
        startTime: d.startTime,
        deliveryMode: deliveryType,
        preferredStaffId: d.staffId,
        requireStaffServiceAssignment: true,
      });
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
        message:
          "Failed to create or find customer record. Please check your details and try again.",
      };
    }
    const resolvedCustomerId = String(customerId);

    // Public home service location & dispatch validation
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

    let hsAddressData: { [key: string]: Json | undefined } | null = null;
    let dispatchData: { [key: string]: Json | undefined } = {
      needs_location_review: false,
      travel_minutes_estimate: null,
      driver_capacity_checked: false,
      dispatch_warning: null,
    };
    let homeServiceFee = 0;

    const { data: branchRow } = await supabase
      .from("branches")
      .select("id, name, latitude, longitude, home_service_free_km, home_service_extra_km_fee")
      .eq("id", d.branchId)
      .maybeSingle();

    if (deliveryType === "home_service") {
      const homeServiceLat = d.homeServiceLat as number;
      const homeServiceLng = d.homeServiceLng as number;
      const formattedAddress = d.homeServiceFormattedAddress?.trim() ?? "";
      const mapUrl =
        d.homeServiceMapUrl?.trim() || buildGoogleMapsSearchUrl(homeServiceLat, homeServiceLng);

      hsAddressData = {
        address: formattedAddress,
        full_address: d.homeServiceAddress?.trim() || formattedAddress,
        address_details: d.homeServiceAddressDetails ?? null,
        barangay: d.homeServiceBarangay ?? null,
        city: d.homeServiceCity ?? null,
        landmark: d.homeServiceLandmark ?? null,
        parking_notes: d.homeServiceParkingNotes ?? null,
        delivery_notes: d.homeServiceCustomerNotes ?? d.homeServiceParkingNotes ?? null,
        notes: d.homeServiceCustomerNotes ?? d.homeServiceParkingNotes ?? null,
        customer_notes: d.homeServiceCustomerNotes ?? d.homeServiceParkingNotes ?? null,
        zone: d.homeServiceZone ?? "unknown",
        formatted_address: formattedAddress,
        place_id: d.homeServicePlaceId?.trim() ?? null,
        lat: homeServiceLat,
        lng: homeServiceLng,
        address_components: toAddressComponentsJson(d.homeServiceAddressComponents),
        map_url: mapUrl,
        source: "google_places",
      } satisfies { [key: string]: Json | undefined };

      // Compute canonical Home Service travel fee if coordinates exist
      if (typeof branchRow?.latitude === "number" && typeof branchRow?.longitude === "number") {
        try {
          const distanceKm = haversineDistanceKm(
            { lat: branchRow.latitude, lng: branchRow.longitude },
            { lat: homeServiceLat, lng: homeServiceLng }
          );
          const freeKm = branchRow.home_service_free_km ?? 5;
          const feePerExtraKm = branchRow.home_service_extra_km_fee ?? 50;
          homeServiceFee = calculateHomeServiceTravelFee(distanceKm, freeKm, feePerExtraKm);
        } catch {
          homeServiceFee = 0;
        }
      }

      // Compute total order elapsed duration for dispatch check
      const maxAttendeeMinutes = Math.max(
        ...attendees.map((att) =>
          att.serviceIds.reduce((sum, sId) => {
            const svc = servicesMap.get(sId);
            return sum + (svc ? svc.duration_minutes + svc.buffer_before + svc.buffer_after : 60);
          }, 0)
        ),
        0
      );
      const dispatchEndH = Math.floor(
        (parseInt(d.startTime.split(":")[0] ?? "0") * 60 +
          parseInt(d.startTime.split(":")[1] ?? "0") +
          maxAttendeeMinutes) /
          60
      );
      const dispatchEndM =
        (parseInt(d.startTime.split(":")[0] ?? "0") * 60 +
          parseInt(d.startTime.split(":")[1] ?? "0") +
          maxAttendeeMinutes) %
        60;
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
        needs_location_review:
          dispatchResult.conflict === "warning" ? dispatchResult.needs_location_review : false,
        travel_minutes_estimate: null,
        driver_capacity_checked: true,
        dispatch_warning: dispatchResult.conflict === "warning" ? dispatchResult.message : null,
      } satisfies { [key: string]: Json | undefined };
    }

    // Build aggregate metrics and canonical atomic payload
    const subtotalAmount = attendees.reduce((total, att) => {
      return (
        total + att.serviceIds.reduce((sum, sId) => sum + (servicesMap.get(sId)?.price ?? 0), 0)
      );
    }, 0);
    const totalAmount = subtotalAmount + homeServiceFee;

    const attendeeDurations = attendees.map((att) =>
      att.serviceIds.reduce((sum, sId) => sum + (servicesMap.get(sId)?.duration_minutes ?? 60), 0)
    );
    const totalDurationMinutes = Math.max(...attendeeDurations, 0);

    const staffAssignmentMap = new Map(
      attendeeStaffAssignments.map((a) => [a.attendeeId, a.staffId])
    );

    const atomicAttendees = attendees.map((a, idx) => ({
      sequence: idx + 1,
      displayName: a.name,
      customerId: a.isOrganizer ? resolvedCustomerId : null,
      notes: a.notes ?? null,
      metadata: {
        is_organizer: a.isOrganizer,
        service_ids: a.serviceIds,
      },
    }));

    const atomicServiceLines: Array<{
      attendeeSequence: number;
      lineSequence: number;
      serviceId: string;
      staffId: string;
      startTime: string;
      endTime: string;
      travelBufferMins?: number | null;
      metadata?: Record<string, unknown>;
    }> = [];
    const insertedScheduleExceptions: Array<{
      exception: NonNullable<ReturnType<typeof readStaffScheduleException>>;
    }> = [];

    for (let aIdx = 0; aIdx < attendees.length; aIdx++) {
      const attendee = attendees[aIdx]!;
      const attendeeStaffId =
        staffAssignmentMap.get(attendee.id) ?? attendeeStaffAssignments[0]?.staffId ?? "auto";
      let currentStartTime = d.startTime;

      for (let sIdx = 0; sIdx < attendee.serviceIds.length; sIdx++) {
        const serviceId = attendee.serviceIds[sIdx]!;
        const serviceInfo = servicesMap.get(serviceId);
        const serviceName = serviceInfo?.name ?? "Service";
        const servicePrice = serviceInfo?.price ?? 0;
        const serviceDuration = serviceInfo?.duration_minutes ?? 60;
        const endTime = await computeEndTime(currentStartTime, serviceId);

        const baseSnapshot = await buildBookingSnapshot(d.branchId, serviceId, d.notes);
        const deliveryMetadata = hsAddressData
          ? { ...baseSnapshot, home_service_address: hsAddressData, dispatch: dispatchData }
          : baseSnapshot;

        const lineMeta: Record<string, unknown> = {
          ...deliveryMetadata,
          service_name: serviceName,
          price: servicePrice,
          duration_minutes: serviceDuration,
          delivery_type: deliveryType,
        };

        const finalLineMeta =
          selectedStaffException && attendee.index === 0
            ? createOpenStaffScheduleException(lineMeta, {
                reasonCode: selectedStaffException.reason,
                selectedStaffId: attendeeStaffId,
                selectedStaffName: selectedStaffException.staffName,
                customerName: d.fullName,
                branchId: d.branchId,
                bookingDate: d.date,
                startTime: currentStartTime,
                endTime,
                createdAt: new Date().toISOString(),
              })
            : lineMeta;

        const scheduleException = readStaffScheduleException(finalLineMeta);
        if (scheduleException) {
          insertedScheduleExceptions.push({ exception: scheduleException });
        }

        atomicServiceLines.push({
          attendeeSequence: aIdx + 1,
          lineSequence: sIdx + 1,
          serviceId,
          staffId: attendeeStaffId,
          startTime: currentStartTime,
          endTime,
          travelBufferMins:
            deliveryType === "home_service"
              ? (d.travelBufferMins ?? rulesCheck.rules.travelBufferMins)
              : null,
          metadata: finalLineMeta,
        });

        currentStartTime = endTime;
      }
    }

    const orderMetadata: Record<string, unknown> = {
      booking_for: bookingFor,
      payment_choice: paymentChoice,
      recipient_name: d.recipientName || null,
      subtotal_amount: subtotalAmount,
      home_service_fee: homeServiceFee,
      total_amount: totalAmount,
      total_attendees: attendees.length,
      total_services: atomicServiceLines.length,
      total_duration_minutes: totalDurationMinutes,
      organizer: {
        full_name: d.fullName,
        phone: d.phone,
        email: d.email || null,
        notes: d.notes || null,
      },
      ...(hsAddressData ? { home_service_address: hsAddressData, dispatch: dispatchData } : {}),
    };

    const idempotencyKey = d.idempotencyKey || crypto.randomUUID();

    const atomicPayload = buildAtomicBookingOrderPayload({
      idempotencyKey,
      branchId: d.branchId,
      organizerCustomerId: resolvedCustomerId,
      deliveryType: deliveryType === "home_service" ? "home_service" : "in_spa",
      bookingDate: d.date,
      currency: "PHP",
      paymentPreference: "pay_at_spa",
      orderMetadata,
      attendees: atomicAttendees,
      serviceLines: atomicServiceLines,
    });

    // Execute atomic aggregate persistence boundary (SECURITY INVOKER via service_role)
    const { data: rawRpcData, error: rpcError } = await supabase.rpc(
      "create_booking_order_atomic",
      {
        p_idempotency_key: atomicPayload.idempotency_key,
        p_order: atomicPayload.order as unknown as Json,
        p_attendees: atomicPayload.attendees as unknown as Json,
        p_service_lines: atomicPayload.service_lines as unknown as Json,
      }
    );

    if (rpcError || !rawRpcData) {
      logBookingError(
        logContext,
        rpcError ?? new Error("create_booking_order_atomic returned no data")
      );
      const mapped = mapAtomicBookingRpcError(rpcError);
      return {
        ok: false,
        code: mapped.code,
        message: mapped.message,
      };
    }

    const rpcResult = rawRpcData as unknown as CreateBookingOrderAtomicResult;
    if (!rpcResult.ok) {
      logBookingError(logContext, rpcResult);
      const mapped = mapAtomicBookingRpcError(rpcResult);
      return {
        ok: false,
        code: mapped.code,
        message: mapped.message,
      };
    }

    const primaryBookingId = rpcResult.service_line_ids[0] ?? "";
    const orderId = rpcResult.order_id;
    const orderNumber = rpcResult.order_number;
    const isHSMulti = deliveryType === "home_service";
    const uniqueStaffIds = Array.from(new Set(attendeeStaffAssignments.map((a) => a.staffId)));

    // Post-commit side effects: strictly execute ONLY on fresh order creation (suppressed on replay)
    if (rpcResult.idempotency_status === "created") {
      const notificationJobs: Promise<void>[] = [
        createNotification({
          branchId: d.branchId,
          targetWorkspace: "crm",
          type: "booking_created",
          title: `New online booking — ${d.fullName} (${orderNumber})`,
          body: `${atomicServiceLines.length} service(s) for ${attendees.length} guest(s)${isHSMulti ? " · Home Service" : ""} · ${d.date} at ${d.startTime}. Booking request awaits CRM confirmation. Payment is separate.`,
          entityType: "booking",
          entityId: primaryBookingId,
          actionHref: `/crm/bookings?bookingId=${primaryBookingId}`,
          priority: "high",
          requiresAction: true,
          dedupeKey: `booking:${orderId}:created`,
          metadata: {
            order_id: orderId,
            order_number: orderNumber,
            customer_name: d.fullName,
            booking_date: d.date,
            start_time: d.startTime,
            delivery_type: deliveryType,
            group_booking_ids: rpcResult.service_line_ids,
          },
        }),
      ];

      for (const scheduleException of insertedScheduleExceptions) {
        notificationJobs.push(
          createStaffScheduleExceptionSignals({
            bookingId: primaryBookingId,
            exception: scheduleException.exception,
          })
        );
      }

      for (const staffId of uniqueStaffIds) {
        if (staffId && staffId !== "auto") {
          notificationJobs.push(
            createNotification({
              branchId: d.branchId,
              targetWorkspace: "staff",
              recipientStaffId: staffId,
              type: isHSMulti ? "home_service_assigned" : "booking_assigned",
              title: isHSMulti
                ? `Home Service request — ${d.fullName}`
                : `Booking request — ${d.fullName}`,
              body: `Provisional assignment for ${d.date} at ${d.startTime}; awaiting CRM confirmation.`,
              entityType: "booking",
              entityId: primaryBookingId,
              actionHref: "/staff-portal/schedule",
              priority: "normal",
              dedupeKey: `booking:${primaryBookingId}:${staffId}:assigned`,
            })
          );
        }
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
            entityId: primaryBookingId,
            actionHref: "/crm/today",
            priority: "high",
            requiresAction: true,
            dedupeKey: `booking:${primaryBookingId}:location_review`,
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
            entityId: primaryBookingId,
            actionHref: "/crm/today",
            priority: "high",
            requiresAction: true,
            dedupeKey: `booking:${primaryBookingId}:dispatch_conflict`,
          })
        );
      }

      // Notifications are best-effort; do not fail the booking if they error
      try {
        await Promise.all(notificationJobs);
      } catch (notifyErr) {
        logBookingError(
          logContext,
          notifyErr instanceof Error ? notifyErr : new Error(String(notifyErr))
        );
      }
    }

    logBusinessEvent("booking.online.submitted", {
      branchId: d.branchId,
      bookingIds: rpcResult.service_line_ids,
      bookingId: primaryBookingId,
      orderId,
      orderNumber,
      idempotencyStatus: rpcResult.idempotency_status,
      customerId: resolvedCustomerId,
      staffIds: uniqueStaffIds,
      bookingType: d.type,
      deliveryType,
      serviceCount: rpcResult.service_line_ids.length,
      attendeeCount: attendees.length,
    });
    revalidateOperationalBookingSurfaces(d.branchId);

    return {
      ok: true,
      bookingId: primaryBookingId,
      orderId,
      orderNumber,
      serviceLineIds: rpcResult.service_line_ids,
      attendeeIds: rpcResult.attendee_ids,
      idempotencyStatus: rpcResult.idempotency_status,
      serviceCount: rpcResult.service_line_ids.length,
      attendeeCount: attendees.length,
      totalAmount,
      ...(insertedScheduleExceptions.length > 0 ? { staffPreferenceNeedsConfirmation: true } : {}),
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
