"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isDevAuthBypassEnabled } from "@/lib/dev-bypass";
import type { Json } from "@/types/supabase";
import {
  CRM_PRECISE_HOME_SERVICE_LOCATION_MESSAGE,
  createInhouseBookingMultiSchema,
  type CreateInhouseBookingMultiInput,
} from "@/lib/validations/booking";
import {
  assignTherapistBySeniorityMultiDetailed,
  getAvailableSlotsMulti,
  getScheduledAvailabilityFallbackWarning,
} from "@/lib/engine/availability";
import { getBranchBusinessDate } from "@/lib/engine/slot-time";
import { validateBookingAgainstBranchRules, getBranchBookingRulesOrDefault } from "@/lib/queries/branch-booking-rules";
import { checkHomeServiceDispatchConflict } from "@/lib/bookings/dispatch-conflict";
import {
  buildHomeServicePricingBreakdown,
  calculateHomeServiceDistanceQuote,
  type HomeServiceDistanceQuote,
} from "@/lib/home-service/distance-service";
import { buildGoogleMapsSearchUrl } from "@/lib/maps/google-maps";
import { isResourceAvailable, autoAssignBookingResource } from "@/lib/engine/resource-availability";
import { AppError, SlotUnavailableError } from "@/types/errors";
import { createNotification } from "@/lib/notifications/create";
import { logError, logBusinessEvent } from "@/lib/logger";
import { revalidateOperationalBookingSurfaces } from "@/lib/bookings/revalidate-booking-surfaces";
import { canonicalizeSystemRole } from "@/constants/staff";
import { canAccessCrmWorkspace } from "@/lib/auth/crm-permissions";

type CreateInhouseBookingResult =
  | { ok: true; bookingId: string; warning?: string }
  | { ok: false; code: string; message: string };

type StaffAuthContext = {
  id: string;
  branch_id: string | null;
  system_role: string;
};

type ServiceRow = {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
  buffer_before: number;
  buffer_after: number;
};

function timeToMinutes(t: string): number {
  const parts = t.split(":");
  const h = Number(parts[0] ?? "0");
  const m = Number(parts[1] ?? "0");
  return h * 60 + m;
}

function minutesToTime(mins: number): string {
  const hh = Math.floor(mins / 60);
  const mm = mins % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00`;
}

function normalizeTimeForInsert(time: string): string {
  return time.length === 5 ? `${time}:00` : time;
}

function computeEndTimeLocal(startTime: string, totalMinutes: number): string | null {
  const start = timeToMinutes(startTime);
  const end = start + totalMinutes;
  if (end >= 24 * 60) return null;
  return minutesToTime(end);
}

function logBookingError(context: Record<string, unknown>, error: unknown) {
  logError("booking.crm.failed", { action: "booking.crm.create", ...context, error });
}

export async function createInhouseBookingMultiAction(
  rawInput: unknown
): Promise<CreateInhouseBookingResult> {
  const parsed = createInhouseBookingMultiSchema.safeParse(rawInput);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    console.error("[CRM_BOOKING] validation failed", parsed.error.flatten());
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      message: firstIssue?.message ?? "Please check your input and try again.",
    };
  }

  const d: CreateInhouseBookingMultiInput = parsed.data;
  const deliveryType = d.deliveryType ?? (d.type === "home_service" ? "home_service" : "in_spa");
  const crmBookingMode =
    d.crmBookingMode ?? (deliveryType === "home_service" ? "home_service" : "walkin");
  const startTime = normalizeTimeForInsert(d.startTime);
  const paymentReceived = d.paymentReceived ?? crmBookingMode === "walkin";
  const cleanPhone = d.phone.replace(/\s/g, "");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, code: "UNAUTHORIZED", message: "Please sign in and try again." };
  }

  const { data: me } = await supabase
    .from("staff")
    .select("id, branch_id, system_role")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  const staff = (me ?? null) as StaffAuthContext | null;
  const staffRole = staff ? canonicalizeSystemRole(staff.system_role) : null;

  if (isDevAuthBypassEnabled()) {
    // Dev bypass: allow booking creation with explicit branchId
    if (!d.branchId) {
      return {
        ok: false,
        code: "BRANCH_MISSING",
        message: "Dev bypass active — please provide an explicit branchId in the booking form.",
      };
    }
    // Continue with dev bypass using the provided branchId
  } else if (!staff || !staffRole || !canAccessCrmWorkspace(staffRole)) {
    return { ok: false, code: "UNAUTHORIZED", message: "You do not have permission to create bookings." };
  }

  const resolvedBranchId = d.branchId ?? staff?.branch_id;
  if (!resolvedBranchId) {
    return {
      ok: false,
      code: "BRANCH_MISSING",
      message: "You are not assigned to a branch. Please contact an administrator.",
    };
  }

  if (
    !isDevAuthBypassEnabled() &&
    staff &&
    staffRole !== "owner" &&
    staff.branch_id !== resolvedBranchId
  ) {
    return {
      ok: false,
      code: "CRM_BRANCH_FORBIDDEN",
      message: "You can only create bookings for your assigned branch.",
    };
  }

  // Home service requires address details
  if (deliveryType === "home_service") {
    if (!d.homeServiceAddress?.trim() && !d.homeServiceFormattedAddress?.trim()) {
      return { ok: false, code: "HS_ADDRESS_MISSING", message: "Enter the complete home-service address." };
    }
    if (
      !d.homeServicePlaceId?.trim() ||
      typeof d.homeServiceLat !== "number" ||
      typeof d.homeServiceLng !== "number"
    ) {
      return {
        ok: false,
        code: "HS_LOCATION_MISSING",
        message: CRM_PRECISE_HOME_SERVICE_LOCATION_MESSAGE,
      };
    }
  }

  const logContext = {
    branchId: resolvedBranchId,
    staffId: d.staffId ?? "auto",
    serviceIds: d.serviceIds,
    bookingDate: d.date,
    startTime,
    operatorId: staff?.id ?? "dev-bypass",
    operatorRole: staff?.system_role ?? "dev-bypass",
  };

  console.log("[CRM_BOOKING] start", logContext);

  try {
    const rulesCheck = await validateBookingAgainstBranchRules({
      branchId: resolvedBranchId,
      bookingType: d.type,
      date: d.date,
      startTime,
    });
    if (!rulesCheck.ok) {
      console.error("[CRM_BOOKING] branch rules failed", { ...logContext, rulesCheck });
      return {
        ok: false,
        code: "BOOKING_RULES_ERROR",
        message: rulesCheck.message,
      };
    }

    let resolvedStaffId: string;
    let availabilityWarning: string | undefined;
    const preferCheckedInStaff =
      crmBookingMode === "walkin" &&
      deliveryType !== "home_service" &&
      d.date === getBranchBusinessDate();

    if (!d.staffId) {
      try {
        const assignment = await assignTherapistBySeniorityMultiDetailed({
          branchId: resolvedBranchId,
          serviceIds: d.serviceIds,
          date: d.date,
          startTime,
          preferCheckedIn: preferCheckedInStaff,
          requireStaffServiceAssignment: true,
        });
        resolvedStaffId = assignment.staffId;
        availabilityWarning = assignment.warning;
        console.log("[CRM_BOOKING] auto-assigned staff", { ...logContext, resolvedStaffId });
      } catch (assignErr) {
        console.error("[CRM_BOOKING] auto-assign failed", { ...logContext, assignErr });
        throw assignErr;
      }
    } else {
      const candidateSlots = await getAvailableSlotsMulti({
        branchId: resolvedBranchId,
        serviceIds: d.serviceIds,
        date: d.date,
        requireStaffServiceAssignment: true,
      });
      const exact = candidateSlots.find(
        (slot) =>
          slot.staff_id === d.staffId &&
          slot.available &&
          slot.slot_time.startsWith(startTime.substring(0, 5))
      );
      if (!exact) {
        throw new SlotUnavailableError();
      }
      resolvedStaffId = d.staffId;
      if (preferCheckedInStaff) {
        availabilityWarning = await getScheduledAvailabilityFallbackWarning({
          branchId: resolvedBranchId,
          serviceIds: d.serviceIds,
          date: d.date,
          startTime,
          requireStaffServiceAssignment: true,
        });
      }
    }

    const admin = createAdminClient();

    let resolvedResourceId = d.resourceId ?? null;

    // ── Calculate total combined duration for resource check ────────────────
    const [combinedServicesResult, combinedOverridesResult] = await Promise.all([
      admin
        .from("services")
        .select("id, duration_minutes, buffer_before, buffer_after")
        .in("id", d.serviceIds),
      admin
        .from("branch_services")
        .select("service_id, custom_duration_minutes")
        .eq("branch_id", resolvedBranchId)
        .eq("is_active", true)
        .in("service_id", d.serviceIds),
    ]);

    if (combinedServicesResult.error || combinedOverridesResult.error) {
      return {
        ok: false,
        code: "SERVICE_TIMING_ERROR",
        message: "Could not calculate the service duration. Please refresh and try again.",
      };
    }

    const combinedDurationByServiceId = new Map(
      (combinedOverridesResult.data ?? []).map((row) => [
        row.service_id,
        row.custom_duration_minutes,
      ])
    );
    const totalMinutesCombined = (combinedServicesResult.data ?? []).reduce(
      (sum, service) =>
        sum +
        Number(combinedDurationByServiceId.get(service.id) ?? service.duration_minutes) +
        Number(service.buffer_before) +
        Number(service.buffer_after),
      0
    );
    const combinedEndTime = computeEndTimeLocal(startTime, totalMinutesCombined);

    // ── Auto-assign room if not provided ──────────────────────────────────
    if (deliveryType !== "home_service" && !resolvedResourceId && combinedEndTime) {
      resolvedResourceId = await autoAssignBookingResource({
        branchId: resolvedBranchId,
        date: d.date,
        startTime,
        endTime: combinedEndTime,
      });

      if (!resolvedResourceId) {
        const { count: activeResourceCount, error: resourceCountError } = await admin
          .from("branch_resources")
          .select("id", { count: "exact", head: true })
          .eq("branch_id", resolvedBranchId)
          .eq("is_active", true);

        console.error("[CRM_BOOKING] room auto-assign failed", {
          ...logContext,
          activeResourceCount,
          resourceCountError,
        });

        if (resourceCountError || (activeResourceCount ?? 0) > 0) {
          return {
            ok: false,
            code: "RESOURCE_UNAVAILABLE",
            message: "No room is available at the selected time.",
          };
        }
      }
    }

    // Verify a manually selected room belongs to this branch and is active.
    if (d.resourceId) {
      const { data: selectedResource, error: selectedResourceError } = await admin
        .from("branch_resources")
        .select("id")
        .eq("id", d.resourceId)
        .eq("branch_id", resolvedBranchId)
        .eq("is_active", true)
        .maybeSingle();

      if (selectedResourceError || !selectedResource) {
        return {
          ok: false,
          code: "RESOURCE_INVALID",
          message: "The selected room does not belong to this branch or is inactive.",
        };
      }
    }

    // Verify resource availability if provided manually
    if (d.resourceId && combinedEndTime) {
      const isAvailable = await isResourceAvailable({
        resourceId: d.resourceId,
        date: d.date,
        startTime,
        endTime: combinedEndTime,
      });
      if (!isAvailable) {
        console.error("[CRM_BOOKING] manual room unavailable", { ...logContext, resourceId: d.resourceId });
        return {
          ok: false,
          code: "RESOURCE_UNAVAILABLE",
          message: "The selected room is unavailable.",
        };
      }
    }

    let resolvedCustomerId = d.customerId ?? null;
    if (resolvedCustomerId) {
      const { data: existingCustomer, error: existingCustomerError } = await admin
        .from("customers")
        .select("id")
        .eq("id", resolvedCustomerId)
        .maybeSingle();

      if (existingCustomerError || !existingCustomer) {
        logBookingError(logContext, existingCustomerError ?? new Error("selected customer not found"));
        return {
          ok: false,
          code: "CUSTOMER_ERROR",
          message: "Select a customer.",
        };
      }
    } else {
      const { data: customerId, error: customerError } = await admin.rpc("upsert_customer", {
        p_phone: cleanPhone,
        p_full_name: d.fullName,
        p_email: d.email || undefined,
      });

      if (customerError || !customerId) {
        console.error("[CRM_BOOKING] upsert_customer failed", { ...logContext, customerError, customerId });
        logBookingError(logContext, customerError ?? new Error("upsert_customer returned no ID"));
        return {
          ok: false,
          code: "CUSTOMER_ERROR",
          message: "Could not save customer details. Please check the phone number.",
        };
      }
      resolvedCustomerId = String(customerId);
    }
    if (!resolvedCustomerId) {
      return { ok: false, code: "CUSTOMER_ERROR", message: "Select a customer." };
    }

    const { data: servicesData, error: servicesError } = await admin
      .from("services")
      .select("id, name, price, duration_minutes, buffer_before, buffer_after")
      .in("id", d.serviceIds)
      .eq("is_active", true);

    if (servicesError) {
      console.error("[CRM_BOOKING] services load failed", { ...logContext, servicesError });
      logBookingError(logContext, servicesError);
      return {
        ok: false,
        code: "SERVICES_LOAD_ERROR",
        message: "Could not load service details. Please refresh and try again.",
      };
    }

    const services = (servicesData ?? []) as ServiceRow[];
    const servicesById = new Map(services.map((s) => [s.id, s]));
    if (servicesById.size !== new Set(d.serviceIds).size) {
      console.error("[CRM_BOOKING] service inactive", { ...logContext, requested: d.serviceIds, found: services.map((s) => s.id) });
      return {
        ok: false,
        code: "SERVICE_UNAVAILABLE",
        message: "One or more selected services are unavailable. Please choose different services.",
      };
    }

    const { data: branchOverrides, error: branchOverridesError } = await admin
      .from("branch_services")
      .select("service_id, custom_price, custom_duration_minutes, available_in_spa, available_home_service")
      .eq("branch_id", resolvedBranchId)
      .in("service_id", d.serviceIds)
      .eq("is_active", true);

    if (branchOverridesError) {
      console.error("[CRM_BOOKING] branch_services load failed", { ...logContext, branchOverridesError });
      logBookingError(logContext, branchOverridesError);
      return {
        ok: false,
        code: "PRICING_LOAD_ERROR",
        message: "Could not load branch pricing. Please refresh and try again.",
      };
    }

    const overrideByServiceId = new Map(
      (branchOverrides ?? []).map((row) => [row.service_id, row])
    );

    if (overrideByServiceId.size !== new Set(d.serviceIds).size) {
      return {
        ok: false,
        code: "SERVICE_NOT_CONFIGURED_FOR_BRANCH",
        message: "One or more selected services are not configured for this branch.",
      };
    }

    // Verify each service is eligible for the booking type
    const needsInSpa = deliveryType !== "home_service";
    for (const serviceId of d.serviceIds) {
      const override = overrideByServiceId.get(serviceId);
      if (override) {
        const eligible = needsInSpa ? override.available_in_spa : override.available_home_service;
        if (!eligible) {
          const svc = servicesById.get(serviceId);
          console.error("[CRM_BOOKING] service ineligible", { ...logContext, serviceId, deliveryType });
          return {
            ok: false,
            code: "SERVICE_INELIGIBLE",
            message: `${svc?.name ?? "A selected service"} is not available for ${deliveryType === "home_service" ? "home service" : "in-spa"} bookings at this branch.`,
          };
        }
      }
    }

    const servicePriceById = new Map(
      d.serviceIds.map((serviceId) => {
        const service = servicesById.get(serviceId);
        const price = Number(overrideByServiceId.get(serviceId)?.custom_price ?? service?.price ?? 0);
        return [serviceId, price] as const;
      })
    );
    const serviceSubtotal = d.serviceIds.reduce(
      (sum, serviceId) => sum + (servicePriceById.get(serviceId) ?? 0),
      0
    );

    // Build home service address data from the selected Google place.
    let hsAddressData: { [key: string]: Json | undefined } | null = null;
    let homeServiceQuote: HomeServiceDistanceQuote | null = null;
    let dispatchData: { [key: string]: Json | undefined } = {
      needs_location_review: false,
      travel_minutes_estimate: null,
      driver_capacity_checked: false,
      dispatch_warning: null,
    };

    if (deliveryType === "home_service" && (d.homeServiceAddress || d.homeServiceFormattedAddress)) {
      if (typeof d.homeServiceLat !== "number" || typeof d.homeServiceLng !== "number") {
        return {
          ok: false,
          code: "HS_LOCATION_MISSING",
          message: CRM_PRECISE_HOME_SERVICE_LOCATION_MESSAGE,
        };
      }

      const distanceResult = await calculateHomeServiceDistanceQuote({
        branchId: resolvedBranchId,
        destination: { lat: d.homeServiceLat, lng: d.homeServiceLng },
      });

      if (!distanceResult.ok) {
        return {
          ok: false,
          code: distanceResult.code,
          message: distanceResult.message,
        };
      }

      homeServiceQuote = distanceResult.quote;
      const formattedAddress = d.homeServiceFormattedAddress ?? d.homeServiceAddress;
      const mapUrl =
        d.homeServiceMapUrl ?? buildGoogleMapsSearchUrl(d.homeServiceLat, d.homeServiceLng);

      const accessNote = d.homeServiceAccessNote?.trim() || undefined;

      hsAddressData = {
        full_address:      d.homeServiceAddress,
        address_details:   d.homeServiceAddressDetails ?? null,
        barangay:          d.homeServiceBarangay ?? null,
        city:              d.homeServiceCity ?? null,
        landmark:          d.homeServiceLandmark ?? null,
        parking_notes:     d.homeServiceParkingNotes ?? null,
        access_note:       accessNote ?? null,
        delivery_notes:    accessNote ?? d.homeServiceCustomerNotes ?? d.homeServiceParkingNotes ?? null,
        customer_notes:    accessNote ?? d.homeServiceCustomerNotes ?? d.homeServiceParkingNotes ?? null,
        zone:              d.homeServiceZone ?? "unknown",
        formatted_address: formattedAddress,
        place_id:          d.homeServicePlaceId ?? null,
        lat:               d.homeServiceLat,
        lng:               d.homeServiceLng,
        address_components: d.homeServiceAddressComponents ?? null,
        distance_km:       homeServiceQuote.distanceKm,
        distance_source:   homeServiceQuote.distanceSource,
        travel_fee:        homeServiceQuote.travelFee,
        map_url:           mapUrl,
        source:            "google_places",
      } satisfies { [key: string]: Json | undefined };

      const branchRules = await getBranchBookingRulesOrDefault(resolvedBranchId);
      const dispatchResult = await checkHomeServiceDispatchConflict({
        branchId: resolvedBranchId,
        bookingDate: d.date,
        startTime,
        endTime: combinedEndTime ?? startTime,
        selectedZone: d.homeServiceZone ?? "unknown",
        selectedLat: d.homeServiceLat,
        selectedLng: d.homeServiceLng,
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
    let currentStart = startTime;

    for (const [serviceIndex, serviceId] of d.serviceIds.entries()) {
      const service = servicesById.get(serviceId);
      if (!service) {
        // Should never happen due to earlier check
        logBookingError(logContext, new Error(`Service not found mid-insert: ${serviceId}`));
        return {
          ok: false,
          code: "SERVICE_NOT_FOUND",
          message: "A selected service could not be found. Please try again.",
        };
      }

      const effectiveDurationMinutes = Number(
        overrideByServiceId.get(service.id)?.custom_duration_minutes ?? service.duration_minutes
      );
      const totalMinutes =
        effectiveDurationMinutes +
        Number(service.buffer_before) +
        Number(service.buffer_after);
      const endTime = computeEndTimeLocal(currentStart, totalMinutes);
      if (!endTime) {
        return {
          ok: false,
          code: "TIME_TOO_LATE",
          message: `Selected time is too late for ${service.name}. Please choose an earlier slot.`,
        };
      }

      const overridePrice = overrideByServiceId.get(service.id)?.custom_price ?? undefined;
      const servicePrice = servicePriceById.get(service.id) ?? Number(service.price);
      const travelFeeForThisRow =
        homeServiceQuote && serviceIndex === 0 ? homeServiceQuote.travelFee : 0;
      const pricingBreakdown =
        homeServiceQuote
          ? buildHomeServicePricingBreakdown({
              serviceSubtotal,
              serviceLinePrice: servicePrice,
              quote: homeServiceQuote,
              travelFeeAppliedToBooking: serviceIndex === 0,
            })
          : null;
      const metadata = {
        price_paid:
          (overridePrice !== null && overridePrice !== undefined
            ? Number(overridePrice)
            : Number(service.price)) + travelFeeForThisRow,
        service_name:          service.name,
        duration_minutes:      effectiveDurationMinutes,
        customer_notes:        d.notes ?? null,
        crm_booking_mode:      crmBookingMode,
        source:                "crm_quick_booking",
        payment_received:      paymentReceived,
        ...(hsAddressData && { home_service_address: hsAddressData }),
        ...(homeServiceQuote && {
          home_service_distance_km: homeServiceQuote.distanceKm,
          home_service_distance_source: homeServiceQuote.distanceSource,
          home_service_free_km: homeServiceQuote.freeKm,
          home_service_extra_km: homeServiceQuote.extraKm,
          home_service_extra_km_fee: homeServiceQuote.feePerExtraKm,
          home_service_travel_fee: homeServiceQuote.travelFee,
          home_service_address_text: d.homeServiceAddress ?? null,
          home_service_latitude: d.homeServiceLat ?? null,
          home_service_longitude: d.homeServiceLng ?? null,
          home_service_place_id: d.homeServicePlaceId ?? null,
          home_service_address_components: d.homeServiceAddressComponents ?? null,
          home_service_access_note: d.homeServiceAccessNote?.trim() || null,
          pricing_breakdown: pricingBreakdown,
        }),
        ...(hsAddressData && { dispatch: dispatchData }),
      };

      const amountPaid = paymentReceived ? Number(servicePrice) + travelFeeForThisRow : 0;
      const paymentMethod = paymentReceived ? (d.paymentMethod ?? "pay_on_site") : "pay_on_site";

      const { data: booking, error: bookingError } = await admin
        .from("bookings")
        .insert({
          branch_id:    resolvedBranchId,
          service_id:   serviceId,
          staff_id:     resolvedStaffId,
          resource_id:  resolvedResourceId,
          customer_id:  resolvedCustomerId,
          booking_date: d.date,
          start_time:   currentStart,
          end_time:     endTime,
          type:         d.type,
          delivery_type: deliveryType,
          status:       "confirmed",
          booking_progress_status:
            d.markArrived && deliveryType !== "home_service" ? "checked_in" : "not_started",
          checked_in_at:
            d.markArrived && deliveryType !== "home_service" ? new Date().toISOString() : null,
          payment_method:    paymentMethod,
          payment_status:    paymentReceived ? "paid" : "pending",
          payment_reference: d.paymentReference ?? null,
          amount_paid:       amountPaid,
          session_duration_minutes_snapshot: effectiveDurationMinutes,
          hold_expires_at:   null,
          travel_buffer_mins:
            deliveryType === "home_service"
              ? (d.travelBufferMins ?? rulesCheck.rules.travelBufferMins)
              : null,
          metadata,
        })
        .select("id")
        .single();

      if (bookingError || !booking) {
        // Rollback previously inserted bookings
        if (insertedIds.length > 0) {
          await admin
            .from("bookings")
            .update({ status: "cancelled" })
            .in("id", insertedIds);
        }

        const bookingErrorMessage = bookingError?.message ?? "";
        if (
          bookingError?.code === "23P01" ||
          bookingErrorMessage.includes("BOOKING_STAFF_TIME_CONFLICT") ||
          bookingErrorMessage.includes("BOOKING_RESOURCE_TIME_CONFLICT")
        ) {
          return {
            ok: false,
            code: "SLOT_UNAVAILABLE",
            message: "That therapist or room was just booked. Please choose another available option.",
          };
        }

        console.error("[CRM_BOOKING] insert failed", {
          ...logContext,
          serviceId,
          currentStart,
          endTime,
          bookingError,
        });
        logBookingError(
          { ...logContext, serviceId, currentStart, endTime },
          bookingError ?? new Error("insert returned no booking")
        );
        return {
          ok: false,
          code: "BOOKING_INSERT_FAILED",
          message: `Could not create booking for ${service.name}. The slot may have been taken. Please select a different time.`,
        };
      }

      insertedIds.push(booking.id);

      // Append-only payment audit log per booking row
      await admin
        .from("booking_payment_logs")
        .insert({
          booking_id:            booking.id,
          changed_by:            staff?.id ?? null,
          old_payment_method:    null,
          old_payment_status:    null,
          old_amount_paid:       null,
          old_payment_reference: null,
          new_payment_method:    paymentMethod,
          new_payment_status:    paymentReceived ? "paid" : "pending",
          new_amount_paid:       amountPaid,
          new_payment_reference: d.paymentReference ?? null,
          reason:                d.paymentNote?.trim() ||
            (paymentReceived
              ? "CRM quick booking - payment recorded at creation"
              : "CRM quick booking - payment pending"),
        })
        .then(({ error: logErr }) => {
          if (logErr) console.error("[CRM_BOOKING] payment_log insert failed", logErr.message);
        });

      currentStart = endTime;
    }

    const isHomeService = deliveryType === "home_service";
    const serviceNames = d.serviceIds
      .map((id) => servicesById.get(id)?.name ?? "")
      .filter(Boolean)
      .join(", ");
    const notificationJobs: Promise<void>[] = [
      createNotification({
        branchId:         resolvedBranchId,
        targetWorkspace:  "staff",
        recipientStaffId: resolvedStaffId,
        type:             isHomeService ? "home_service_assigned" : "booking_assigned",
        title:            isHomeService ? `Home Service booking — ${d.fullName}` : `New booking — ${d.fullName}`,
        body:             `${d.fullName} has a confirmed ${isHomeService ? "Home Service " : ""}booking for ${serviceNames} on ${d.date} at ${startTime}.`,
        entityType:       "booking",
        entityId:         insertedIds[0],
        actionHref:       "/staff-portal/schedule",
        priority:         isHomeService ? "high" : "normal",
        requiresAction:   isHomeService,
        metadata:         insertedIds.length > 1 ? { group_booking_ids: insertedIds } : {},
        dedupeKey:        `booking:${insertedIds[0]}:staff_assignment`,
      }),
      // No CRM payment_pending notification for in-house bookings — payment is already recorded.
    ];

    if (isHomeService && dispatchData.needs_location_review === true) {
      notificationJobs.push(
        createNotification({
          branchId: resolvedBranchId,
          targetWorkspace: "crm",
          type: "home_service_location_review",
          title: `Home Service location review needed — ${d.fullName}`,
          body: `${d.fullName}'s Home Service booking on ${d.date} at ${startTime} needs location or driver review.`,
          entityType: "booking",
          entityId: insertedIds[0],
          actionHref: "/crm/today",
          priority: "high",
          requiresAction: true,
          dedupeKey: `booking:${insertedIds[0]}:location_review`,
        })
      );
    }

    if (isHomeService && typeof dispatchData.dispatch_warning === "string") {
      notificationJobs.push(
        createNotification({
          branchId: resolvedBranchId,
          targetWorkspace: "crm",
          type: "home_service_dispatch_conflict",
          title: `Home Service dispatch conflict — ${d.fullName}`,
          body: `${d.fullName}'s Home Service booking on ${d.date} at ${startTime} may clash with another location or driver capacity.`,
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

    logBusinessEvent("booking.crm.created", {
      branchId: resolvedBranchId,
      bookingIds: insertedIds,
      bookingId: insertedIds[0],
      customerId: resolvedCustomerId,
      staffId: resolvedStaffId,
      serviceIds: d.serviceIds,
      bookingType: d.type,
      deliveryType,
      actorId: staff?.id ?? "dev-bypass",
      workspace: staff?.system_role ?? "dev",
      serviceCount: insertedIds.length,
    });

    try {
      revalidateOperationalBookingSurfaces(resolvedBranchId);
    } catch (revalidateErr) {
      logBookingError(
        logContext,
        revalidateErr instanceof Error ? revalidateErr : new Error(String(revalidateErr))
      );
    }

    return { ok: true, bookingId: insertedIds[0]!, warning: availabilityWarning };
  } catch (error) {
    console.error("[CRM_BOOKING] caught error", { ...logContext, error });

    if (error instanceof SlotUnavailableError || (error instanceof AppError && error.code === "SLOT_UNAVAILABLE")) {
      return {
        ok: false,
        code: "SLOT_UNAVAILABLE",
        message:
          "No scheduled therapist is available at this time. Try another time or check staff schedules.",
      };
    }

    logBookingError(logContext, error);

    if (error instanceof AppError) {
      const errCode = error.code;
      const safeMessages: Record<string, string> = {
        BOOKING_RULES_ERROR: "The selected time is outside branch booking hours.",
        RESOURCE_UNAVAILABLE: "No room is available at the selected time.",
        CUSTOMER_ERROR: "Could not save customer details. Please check the phone number.",
        SERVICE_UNAVAILABLE: "One or more selected services are unavailable. Please choose different services.",
        SERVICE_INELIGIBLE: "This service is not available for the selected booking type at this branch.",
      };
      if (safeMessages[errCode]) {
        return { ok: false, code: errCode, message: safeMessages[errCode] };
      }
    }

    if (error instanceof Error) {
      // Categorize known error patterns without exposing raw internals
      const msg = error.message.toLowerCase();
      if (msg.includes("foreign key") || msg.includes("violates foreign key")) {
        return {
          ok: false,
          code: "REFERENCE_ERROR",
          message: "A related record could not be found. Please refresh and try again.",
        };
      }
      if (msg.includes("unique") || msg.includes("duplicate")) {
        return {
          ok: false,
          code: "DUPLICATE_ERROR",
          message: "This booking appears to be a duplicate. Please check existing bookings.",
        };
      }
    }

    return {
      ok: false,
      code: "UNKNOWN_ERROR",
      message: "Could not save booking. Please refresh and try again.",
    };
  }
}
