import "server-only";
import { createHash } from "node:crypto";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/supabase";
import {
  CRM_PRECISE_HOME_SERVICE_LOCATION_MESSAGE,
  createInhouseBookingMultiSchema,
  type CreateInhouseBookingMultiInput,
} from "@/lib/validations/booking";
import { resolveExactCrmBookingTime } from "@/lib/engine/exact-crm-booking-time";
import { parseBookingTime } from "@/lib/bookings/booking-clock-time";
import {
  validateBookingAgainstBranchRules,
  getBranchBookingRulesOrDefault,
} from "@/lib/queries/branch-booking-rules";
import { checkHomeServiceDispatchConflict } from "@/lib/bookings/dispatch-conflict";
import {
  buildHomeServicePricingBreakdown,
  calculateHomeServiceDistanceQuote,
  type HomeServiceDistanceQuote,
} from "@/lib/home-service/distance-service";
import { buildGoogleMapsSearchUrl } from "@/lib/maps/google-maps";
import { isResourceAvailable, autoAssignBookingResource, allocateResourcesForAttendees } from "@/lib/engine/resource-availability";
import { assignTherapistsForOrder } from "@/lib/engine/availability";
import { AppError, SlotUnavailableError } from "@/types/errors";
import { createNotification } from "@/lib/notifications/create";
import { logError, logBusinessEvent } from "@/lib/logger";
import { revalidateOperationalBookingSurfaces } from "@/lib/bookings/revalidate-booking-surfaces";
import { canAccessCrmWorkspace } from "@/lib/auth/crm-permissions";
import { isConsultationOnlyService } from "@/lib/bookings/consultation-only-service";
import { bookingCreationProvenance } from "@/lib/bookings/therapist-provenance";
import { validateBranchServiceEligibility } from "@/lib/services/service-catalog";
import { resolveBookingLineQuotes } from "@/lib/services/resolve-booking-line-quotes";
import { ServiceLineQuoteError, toServiceLineCommercialSnapshot } from "@/lib/services/service-line-quote";

export type CreateInhouseBookingResult =
  | { ok: true; bookingId: string; orderId?: string; orderNumber?: string; serviceLineIds?: string[]; attendeeIds?: string[]; serviceCount?: number; attendeeCount?: number; warning?: string }
  | { ok: false; code: string; message: string };

export type InhouseBookingOperator = {
  authUserId: string;
  staff: {
    id: string;
    branch_id: string | null;
    system_role: string;
  } | null;
  staffRole: string | null;
  isDevBypass: boolean;
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

function phpCents(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
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

export function normalizeCrmBookingInput(rawInput: unknown): unknown {
  if (!rawInput || typeof rawInput !== "object") return rawInput;
  const obj = rawInput as Record<string, unknown>;
  if (typeof obj.startTime === "string") {
    const parsed = parseBookingTime(obj.startTime);
    if (parsed.ok) {
      return {
        ...obj,
        startTime: parsed.value.canonicalTime,
      };
    }
  }
  return rawInput;
}

export async function executeInhouseBookingCreation(
  rawInput: unknown,
  operator: InhouseBookingOperator
): Promise<CreateInhouseBookingResult> {
  const normalizedInput = normalizeCrmBookingInput(rawInput);
  const parsed = createInhouseBookingMultiSchema.safeParse(normalizedInput);
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
  if (d.customerRequestedTherapist && !d.staffId) {
    return { ok: false, code: "VALIDATION_ERROR", message: "Select a therapist requested by the customer." };
  }
  const attendees = d.attendees ?? [{
    id: crypto.randomUUID(), name: d.fullName, isOrganizer: true, serviceIds: d.serviceIds,
  }];
  const groupBooking = attendees.length > 1;
  const groupInputHash = groupBooking ? createHash("sha256").update(JSON.stringify(d)).digest("hex") : null;
  const allServiceIds = [...new Set(attendees.flatMap((attendee) => attendee.serviceIds))];
  const orderedServiceIds = attendees.flatMap((attendee) => attendee.serviceIds);
  const deliveryType = d.deliveryType ?? (d.type === "home_service" ? "home_service" : "in_spa");
  const crmBookingMode =
    d.crmBookingMode ?? (deliveryType === "home_service" ? "home_service" : "walkin");
  const parsedStartTime = parseBookingTime(d.startTime);
  if (!parsedStartTime.ok) {
    return {
      ok: false,
      code: "INVALID_BOOKING_TIME",
      message: parsedStartTime.error,
    };
  }
  const startTime = parsedStartTime.value.canonicalTime;
  const paymentReceived = d.paymentReceived ?? false;
  const cleanPhone = d.phone.replace(/\s/g, "");

  const { staff, staffRole, isDevBypass } = operator;

  if (isDevBypass) {
    // Dev bypass: allow booking creation with explicit branchId
    if (!d.branchId) {
      return {
        ok: false,
        code: "BRANCH_MISSING",
        message: "Dev bypass active — please provide an explicit branchId in the booking form.",
      };
    }
  } else if (!staff || !staffRole || !canAccessCrmWorkspace(staffRole)) {
    return {
      ok: false,
      code: "UNAUTHORIZED",
      message: "You do not have permission to create bookings.",
    };
  }

  const resolvedBranchId = d.branchId ?? staff?.branch_id;
  if (!resolvedBranchId) {
    return {
      ok: false,
      code: "BRANCH_MISSING",
      message: "You are not assigned to a branch. Please contact an administrator.",
    };
  }

  if (!isDevBypass && staff && staffRole !== "owner" && staff.branch_id !== resolvedBranchId) {
    return {
      ok: false,
      code: "CRM_BRANCH_FORBIDDEN",
      message: "You can only create bookings for your assigned branch.",
    };
  }

  // Home service requires address details
  if (deliveryType === "home_service") {
    if (!d.homeServiceAddress?.trim() && !d.homeServiceFormattedAddress?.trim()) {
      return {
        ok: false,
        code: "HS_ADDRESS_MISSING",
        message: "Enter the complete home-service address.",
      };
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
    serviceIds: allServiceIds,
    bookingDate: d.date,
    startTime,
    operatorId: staff?.id ?? (isDevBypass ? "dev-bypass" : operator.authUserId),
    operatorRole: staff?.system_role ?? (isDevBypass ? "dev-bypass" : (staffRole ?? "unknown")),
  };

  try {
    if (groupBooking && d.idempotencyKey) {
      const replayClient = createAdminClient();
      const { data: existingOrder, error: replayError } = await replayClient
        .from("booking_orders")
        .select("id, order_number, metadata")
        .eq("idempotency_key", d.idempotencyKey)
        .eq("branch_id", resolvedBranchId)
        .maybeSingle();
      if (replayError) throw replayError;
      if (existingOrder) {
        const metadata = existingOrder.metadata as Record<string, unknown> | null;
        if (metadata?.crm_input_hash !== groupInputHash) {
          return { ok: false, code: "IDEMPOTENCY_CONFLICT", message: "This booking request key was already used for different details." };
        }
        const [attendeeRows, bookingRows] = await Promise.all([
          replayClient.from("booking_attendees").select("id, sequence").eq("booking_order_id", existingOrder.id),
          replayClient.from("bookings").select("id, attendee_id, line_sequence").eq("order_id", existingOrder.id),
        ]);
        if (attendeeRows.error || bookingRows.error) throw attendeeRows.error ?? bookingRows.error;
        const sortedAttendees = [...(attendeeRows.data ?? [])].sort((a, b) => a.sequence - b.sequence);
        const sequenceById = new Map(sortedAttendees.map((row) => [row.id, row.sequence]));
        const serviceLineIds = [...(bookingRows.data ?? [])].sort((a, b) =>
          (sequenceById.get(a.attendee_id ?? "") ?? 0) - (sequenceById.get(b.attendee_id ?? "") ?? 0) ||
          (a.line_sequence ?? 0) - (b.line_sequence ?? 0)
        ).map((row) => row.id);
        if (serviceLineIds.length !== orderedServiceIds.length || sortedAttendees.length !== attendees.length) {
          throw new Error("Group booking replay rows are incomplete");
        }
        return { ok: true, bookingId: serviceLineIds[0]!, orderId: existingOrder.id,
          orderNumber: existingOrder.order_number, serviceLineIds,
          attendeeIds: sortedAttendees.map((row) => row.id),
          serviceCount: serviceLineIds.length, attendeeCount: sortedAttendees.length };
      }
    }
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

    const serviceEligibility = await validateBranchServiceEligibility({
      branchId: resolvedBranchId,
      serviceIds: allServiceIds,
      audience: "crm",
      deliveryMode: deliveryType,
      useAdminClient: true,
    });
    if (!serviceEligibility.ok) {
      return {
        ok: false,
        code: "SERVICE_INELIGIBLE",
        message:
          "One or more selected services are not available for this booking type at this branch.",
      };
    }

    const consultationClient = createAdminClient();
    const { data: consultationServices, error: consultationError } = await consultationClient
      .from("services")
      .select("name, metadata, service_categories(name)")
      .in("id", allServiceIds);
    if (consultationError) throw consultationError;
    const requiresManualArrangement = (consultationServices ?? []).some((service) => {
      const categoryValue = service.service_categories;
      const category = Array.isArray(categoryValue) ? categoryValue[0] : categoryValue;
      return isConsultationOnlyService({
        name: service.name,
        categoryName: category?.name ?? null,
        metadata: service.metadata,
      });
    });
    if (requiresManualArrangement && !d.staffId) {
      return {
        ok: false,
        code: "MANUAL_ARRANGEMENT_REQUIRED",
        message:
          "Select a coordinating provider and confirm the full participant and staffing arrangement manually.",
      };
    }

    const attendeeQuotes = await Promise.all(attendees.map((attendee, index) =>
      resolveBookingLineQuotes({
        branchId: resolvedBranchId,
        serviceIds: attendee.serviceIds,
        serviceLines: d.attendees?.[index]?.serviceLines ?? (d.attendees ? undefined : d.serviceLines),
        audience: "crm",
        deliveryMode: deliveryType,
      })
    ));

    const admin = createAdminClient();

    let attendeeStaffIds: string[];
    let selectedExactProvider: Awaited<ReturnType<typeof resolveExactCrmBookingTime>>["providers"][number] | undefined;
    let availabilityWarning: string | undefined;
    if (groupBooking) {
      const assignments = await assignTherapistsForOrder({
        branchId: resolvedBranchId,
        attendees: attendees.map((attendee, index) => ({ id: attendee.id, serviceIds: attendee.serviceIds,
          selectedDurationMinutes: attendeeQuotes[index]!.map((quote) => quote.selectedDurationMinutes) })),
        date: d.date,
        startTime,
        deliveryMode: deliveryType,
        preferredStaffId: d.staffId,
        requireStaffServiceAssignment: true,
      });
      attendeeStaffIds = attendees.map((attendee) => {
        const assignment = assignments.find((item) => item.attendeeId === attendee.id);
        if (!assignment) throw new SlotUnavailableError();
        return assignment.staffId;
      });
      availabilityWarning = requiresManualArrangement
        ? "Manual arrangement required: confirm every participant, provider, room, and time before finalizing."
        : undefined;
    } else {
      const exactAvailability = await resolveExactCrmBookingTime({
        branchId: resolvedBranchId,
        serviceIds: d.serviceIds,
        selectedDurationMinutes: attendeeQuotes[0]!.map((quote) => quote.selectedDurationMinutes),
        date: d.date,
        startTime,
        bookingMode: crmBookingMode,
        deliveryType,
        staffId: d.staffId,
        travelBufferMins:
          deliveryType === "home_service"
            ? (d.travelBufferMins ?? rulesCheck.rules.travelBufferMins)
            : 0,
      });
      if (!exactAvailability.available) {
        return {
          ok: false,
          code: exactAvailability.reasonCode === "no_schedule_for_time"
            ? "NO_SCHEDULE_AT_START" : "EXACT_TIME_UNAVAILABLE",
          message: exactAvailability.message ?? "No qualified therapist can start at the selected exact time.",
        };
      }
      selectedExactProvider = d.staffId
        ? exactAvailability.providers.find((provider) => provider.staffId === d.staffId && provider.selectable)
        : exactAvailability.providers.find((provider) => provider.selectable);
      if (!selectedExactProvider) {
        return { ok: false, code: "EXACT_TIME_UNAVAILABLE", message: "No qualified therapist can start at the selected exact time." };
      }
      attendeeStaffIds = [selectedExactProvider.staffId];
      availabilityWarning = Array.from(new Set([
        requiresManualArrangement
          ? "Manual arrangement required: the selected provider is only the coordinator; confirm every participant, provider, room, and time before finalizing."
          : null,
        exactAvailability.warning,
        selectedExactProvider.warning,
      ].filter((warning): warning is string => Boolean(warning)))).join(" ") || undefined;
    }
    const resolvedStaffId = attendeeStaffIds[0]!;

    let resolvedResourceId = d.resourceId ?? null;

    // ── Calculate total combined duration for resource check ────────────────
    const [combinedServicesResult, combinedOverridesResult] = await Promise.all([
      admin
        .from("services")
        .select("id, duration_minutes, buffer_before, buffer_after")
        .in("id", allServiceIds),
      admin
        .from("branch_services")
        .select("service_id, custom_duration_minutes")
        .eq("branch_id", resolvedBranchId)
        .eq("is_active", true)
        .in("service_id", allServiceIds),
    ]);

    if (combinedServicesResult.error || combinedOverridesResult.error) {
      return {
        ok: false,
        code: "SERVICE_TIMING_ERROR",
        message: "Could not calculate the service duration. Please refresh and try again.",
      };
    }

    const durationServiceById = new Map((combinedServicesResult.data ?? []).map((service) => [service.id, service]));
    const attendeeDurations = attendees.map((attendee, attendeeIndex) => attendee.serviceIds.reduce((sum, id, lineIndex) => {
      const service = durationServiceById.get(id);
      return sum + (service
        ? attendeeQuotes[attendeeIndex]![lineIndex]!.selectedDurationMinutes + Number(service.buffer_before) + Number(service.buffer_after)
        : 0);
    }, 0));
    const combinedEndTime = computeEndTimeLocal(startTime, Math.max(...attendeeDurations));
    const attendeeEndTimes = attendeeDurations.map((minutes) => computeEndTimeLocal(startTime, minutes));
    if (!combinedEndTime) {
      return {
        ok: false,
        code: "TIME_TOO_LATE",
        message:
          "This booking crosses midnight. Choose an earlier time until overnight booking is enabled.",
      };
    }

    // The single-person room path remains unchanged; groups reserve capacity per attendee.
    let attendeeResourceIds: Array<string | null> = attendees.map(() => null);
    if (groupBooking && deliveryType !== "home_service") {
      if (d.resourceId) {
        return { ok: false, code: "RESOURCE_INVALID", message: "Use automatic room assignment when booking multiple guests." };
      }
      const allocated = await allocateResourcesForAttendees({
        branchId: resolvedBranchId,
        date: d.date,
        windows: attendeeEndTimes.map((endTime) => ({ startTime, endTime: endTime ?? startTime })),
      });
      if (!allocated) {
        return { ok: false, code: "RESOURCE_UNAVAILABLE", message: "Not enough rooms are available for all guests." };
      }
      attendeeResourceIds = allocated;
    }
    if (!groupBooking && deliveryType !== "home_service" && !resolvedResourceId && combinedEndTime) {
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
    if (!groupBooking && d.resourceId) {
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
    if (!groupBooking && d.resourceId && combinedEndTime) {
      const isAvailable = await isResourceAvailable({
        resourceId: d.resourceId,
        date: d.date,
        startTime,
        endTime: combinedEndTime,
      });
      if (!isAvailable) {
        console.error("[CRM_BOOKING] manual room unavailable", {
          ...logContext,
          resourceId: d.resourceId,
        });
        return {
          ok: false,
          code: "RESOURCE_UNAVAILABLE",
          message: "The selected room is unavailable.",
        };
      }
    }
    if (!groupBooking) attendeeResourceIds = [resolvedResourceId];

    let resolvedCustomerId = d.customerId ?? null;
    if (resolvedCustomerId) {
      const { data: existingCustomer, error: existingCustomerError } = await admin
        .from("customers")
        .select("id")
        .eq("id", resolvedCustomerId)
        .maybeSingle();

      if (existingCustomerError || !existingCustomer) {
        logBookingError(
          logContext,
          existingCustomerError ?? new Error("selected customer not found")
        );
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
        console.error("[CRM_BOOKING] upsert_customer failed", {
          ...logContext,
          customerError,
          customerId,
        });
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
      .in("id", allServiceIds)
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
    if (servicesById.size !== allServiceIds.length) {
      console.error("[CRM_BOOKING] service inactive", {
        ...logContext,
        requested: allServiceIds,
        found: services.map((s) => s.id),
      });
      return {
        ok: false,
        code: "SERVICE_UNAVAILABLE",
        message: "One or more selected services are unavailable. Please choose different services.",
      };
    }

    const { data: branchOverrides, error: branchOverridesError } = await admin
      .from("branch_services")
      .select("service_id, custom_price, custom_duration_minutes")
      .eq("branch_id", resolvedBranchId)
      .in("service_id", allServiceIds)
      .eq("is_active", true);

    if (branchOverridesError) {
      console.error("[CRM_BOOKING] branch_services load failed", {
        ...logContext,
        branchOverridesError,
      });
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

    if (overrideByServiceId.size !== allServiceIds.length) {
      return {
        ok: false,
        code: "SERVICE_NOT_CONFIGURED_FOR_BRANCH",
        message: "One or more selected services are not configured for this branch.",
      };
    }

    const serviceSubtotal = phpCents(attendeeQuotes.flat().reduce((sum, quote) => sum + quote.calculatedPrice, 0));

    // Build home service address data from the selected Google place.
    let hsAddressData: { [key: string]: Json | undefined } | null = null;
    let homeServiceQuote: HomeServiceDistanceQuote | null = null;
    let dispatchData: { [key: string]: Json | undefined } = {
      needs_location_review: false,
      travel_minutes_estimate: null,
      driver_capacity_checked: false,
      dispatch_warning: null,
    };

    if (
      deliveryType === "home_service" &&
      (d.homeServiceAddress || d.homeServiceFormattedAddress)
    ) {
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
        full_address: formattedAddress,
        address_details: d.homeServiceAddressDetails ?? null,
        barangay: d.homeServiceBarangay ?? null,
        city: d.homeServiceCity ?? null,
        landmark: d.homeServiceLandmark ?? null,
        parking_notes: d.homeServiceParkingNotes ?? null,
        access_note: accessNote ?? null,
        delivery_notes:
          accessNote ?? d.homeServiceCustomerNotes ?? d.homeServiceParkingNotes ?? null,
        customer_notes:
          accessNote ?? d.homeServiceCustomerNotes ?? d.homeServiceParkingNotes ?? null,
        zone: d.homeServiceZone ?? "unknown",
        formatted_address: formattedAddress,
        place_id: d.homeServicePlaceId ?? null,
        lat: d.homeServiceLat,
        lng: d.homeServiceLng,
        address_components: d.homeServiceAddressComponents ?? null,
        distance_km: homeServiceQuote.distanceKm,
        distance_source: homeServiceQuote.distanceSource,
        travel_fee: homeServiceQuote.travelFee,
        map_url: mapUrl,
        source: "google_places",
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
        needs_location_review:
          dispatchResult.conflict === "warning" ? dispatchResult.needs_location_review : false,
        travel_minutes_estimate: null,
        driver_capacity_checked: true,
        dispatch_warning: dispatchResult.conflict === "warning" ? dispatchResult.message : null,
      } satisfies { [key: string]: Json | undefined };
    }

    const serviceLines: Array<Record<string, unknown>> = [];
    for (const [attendeeIndex, attendee] of attendees.entries()) {
      let currentStart = startTime;
      for (const [serviceIndex, serviceId] of attendee.serviceIds.entries()) {
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

      const quote = attendeeQuotes[attendeeIndex]![serviceIndex]!;
      const effectiveDurationMinutes = quote.selectedDurationMinutes;
      const totalMinutes =
        effectiveDurationMinutes + Number(service.buffer_before) + Number(service.buffer_after);
      const endTime = computeEndTimeLocal(currentStart, totalMinutes);
      if (!endTime) {
        return {
          ok: false,
          code: "TIME_TOO_LATE",
          message: `Selected time is too late for ${service.name}. Please choose an earlier slot.`,
        };
      }

      const servicePrice = quote.calculatedPrice;
      const pricingBreakdown = homeServiceQuote
        ? buildHomeServicePricingBreakdown({
            serviceSubtotal,
            serviceLinePrice: servicePrice,
            quote: homeServiceQuote,
            travelFeeAppliedToBooking: attendeeIndex === 0 && serviceIndex === 0,
          })
        : null;
      const metadata = {
        price_paid: phpCents(servicePrice),
        service_name: service.name,
        duration_minutes: effectiveDurationMinutes,
        commercial_snapshot: toServiceLineCommercialSnapshot(quote),
        customer_notes: d.notes ?? null,
        crm_booking_mode: crmBookingMode,
        source: "crm_quick_booking",
        ...(selectedExactProvider && { exact_time_resolution: {
          schedule_start_time: selectedExactProvider.scheduleStartTime,
          schedule_end_time: selectedExactProvider.scheduleEndTime,
          service_end_time: selectedExactProvider.serviceEndTime,
          operational_start_time: selectedExactProvider.operationalStartTime,
          operational_end_time: selectedExactProvider.operationalEndTime,
          overtime_minutes: selectedExactProvider.overtimeMinutes,
          operational_overtime_minutes: selectedExactProvider.operationalOvertimeMinutes,
          operational_starts_before_shift: selectedExactProvider.operationalStartsBeforeShift,
          policy: "start_inside_schedule_finish_after_allowed",
        } }),
        payment_received: false,
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

      serviceLines.push({
        attendee_sequence: attendeeIndex + 1,
        line_sequence: serviceIndex + 1,
        service_id: serviceId,
        staff_id: attendeeStaffIds[attendeeIndex],
        ...(groupBooking && { resource_id: attendeeResourceIds[attendeeIndex] }),
        start_time: currentStart,
        end_time: endTime,
        travel_buffer_mins:
          deliveryType === "home_service"
            ? (d.travelBufferMins ?? rulesCheck.rules.travelBufferMins)
            : null,
        metadata: {
          ...metadata,
          _therapist_provenance: bookingCreationProvenance({
            selectedStaffId: attendeeIndex === 0 ? d.staffId : null,
            assignedStaffId: attendeeStaffIds[attendeeIndex]!,
            selectedBy: d.customerRequestedTherapist ? "customer" : "front_desk",
          }),
        },
      });

      currentStart = endTime;
      }
    }

    const orderMetadata = {
      total_amount: phpCents(serviceSubtotal + (homeServiceQuote?.travelFee ?? 0)),
      subtotal_amount: serviceSubtotal,
      home_service_fee: phpCents(homeServiceQuote?.travelFee ?? 0),
      crm_booking_mode: crmBookingMode,
      source: "crm_quick_booking",
      payment_received: paymentReceived,
      ...(groupBooking && { booking_for: d.bookingFor, total_attendees: attendees.length,
        total_services: serviceLines.length, total_duration_minutes: Math.max(...attendeeDurations),
        crm_input_hash: groupInputHash }),
    };
    const rpcArgs = {
      p_actor_auth_user_id: operator.authUserId,
      p_idempotency_key: d.idempotencyKey ?? crypto.randomUUID(),
      p_order: {
        branch_id: resolvedBranchId,
        organizer_customer_id: resolvedCustomerId,
        delivery_type: deliveryType,
        booking_date: d.date,
        currency: "PHP",
        payment_preference: "pay_at_spa",
        metadata: orderMetadata,
      },
      p_attendees: attendees.map((attendee, index) => ({
        sequence: index + 1,
        display_name: attendee.name,
        customer_id: attendee.isOrganizer ? resolvedCustomerId : null,
      })),
      p_service_lines: serviceLines,
      p_options: {
        type: d.type,
        resource_id: groupBooking ? null : resolvedResourceId,
        mark_arrived: d.markArrived ?? false,
        payment_received: paymentReceived,
        payment_method: paymentReceived ? d.paymentMethod : null,
        payment_reference: d.paymentReference ?? null,
        payment_note: d.paymentNote ?? null,
        financial_account_id: d.financialAccountId ?? null,
        payments:
          d.payments?.map((part) => ({
            amount: part.amount,
            payment_method: part.paymentMethod,
            financial_account_id: part.financialAccountId ?? null,
            external_reference: part.externalReference ?? null,
          })) ?? null,
      },
    };
    const { data: atomicData, error: atomicError } = await (
      admin as unknown as {
        rpc: (
          name: string,
          args: typeof rpcArgs
        ) => Promise<{
          data: { service_line_ids?: string[]; attendee_ids?: string[]; order_id?: string; order_number?: string; idempotency_status?: string } | null;
          error: { message: string; code?: string } | null;
        }>;
      }
    ).rpc("create_inhouse_order_with_payment_atomic", rpcArgs);
    if (atomicError || !atomicData?.service_line_ids?.length) {
      const message = atomicError?.message ?? "Atomic booking creation returned no service lines";
      const knownCodes = [
        "ACCOUNT_SELECTION_REQUIRED",
        "ACCOUNT_NOT_CONFIGURED",
        "ACCOUNT_BRANCH_OR_RAIL_MISMATCH",
        "PAYMENT_DELTA_MISMATCH",
        "IDEMPOTENCY_CONFLICT",
        "BOOKING_STAFF_TIME_CONFLICT",
        "BOOKING_RESOURCE_TIME_CONFLICT",
      ];
      const code =
        knownCodes.find((known) => message.includes(known)) ?? "BOOKING_ATOMIC_PERSISTENCE_FAILED";
      logBookingError(logContext, atomicError ?? new Error(message));
      return {
        ok: false,
        code,
        message:
          code === "ACCOUNT_SELECTION_REQUIRED"
            ? "Select the payment account before collecting this payment."
            : code === "ACCOUNT_NOT_CONFIGURED"
              ? "No compatible payment account is configured for this branch."
              : "Could not create the booking and payment together. Please review the booking and try again.",
      };
    }
    const insertedIds = atomicData.service_line_ids;
    const isReplay = atomicData.idempotency_status === "replayed";

    const isHomeService = deliveryType === "home_service";
    const serviceNames = orderedServiceIds
      .map((id) => servicesById.get(id)?.name ?? "")
      .filter(Boolean)
      .join(", ");
    const notificationJobs: Promise<void>[] = isReplay
      ? []
      : [
          createNotification({
            branchId: resolvedBranchId,
            targetWorkspace: "staff",
            recipientStaffId: resolvedStaffId,
            type: isHomeService ? "home_service_assigned" : "booking_assigned",
            title: isHomeService
              ? `Home Service booking — ${d.fullName}`
              : `New booking — ${d.fullName}`,
            body: `${d.fullName} has a confirmed ${isHomeService ? "Home Service " : ""}booking for ${serviceNames} on ${d.date} at ${startTime}.`,
            entityType: "booking",
            entityId: insertedIds[0],
            actionHref: "/staff-portal/schedule",
            priority: isHomeService ? "high" : "normal",
            requiresAction: isHomeService,
            metadata: insertedIds.length > 1 ? { group_booking_ids: insertedIds } : {},
            dedupeKey: `booking:${insertedIds[0]}:staff_assignment`,
          }),
          // No CRM payment_pending notification for in-house bookings — payment is already recorded.
        ];

    if (!isReplay && groupBooking) {
      let firstLineIndex = attendees[0]!.serviceIds.length;
      for (let index = 1; index < attendees.length; index += 1) {
        const attendee = attendees[index]!;
        const attendeeBookingId = insertedIds[firstLineIndex]!;
        notificationJobs.push(createNotification({
          branchId: resolvedBranchId,
          targetWorkspace: "staff",
          recipientStaffId: attendeeStaffIds[index],
          type: isHomeService ? "home_service_assigned" : "booking_assigned",
          title: isHomeService ? `Home Service booking — ${attendee.name}` : `New booking — ${attendee.name}`,
          body: `${attendee.name} has a confirmed ${isHomeService ? "Home Service " : ""}booking on ${d.date} at ${startTime}.`,
          entityType: "booking",
          entityId: attendeeBookingId,
          actionHref: "/staff-portal/schedule",
          priority: isHomeService ? "high" : "normal",
          requiresAction: isHomeService,
          dedupeKey: `booking:${attendeeBookingId}:staff_assignment`,
        }));
        firstLineIndex += attendee.serviceIds.length;
      }
    }

    if (!isReplay && isHomeService && dispatchData.needs_location_review === true) {
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

    if (!isReplay && isHomeService && typeof dispatchData.dispatch_warning === "string") {
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
      logBookingError(
        logContext,
        notifyErr instanceof Error ? notifyErr : new Error(String(notifyErr))
      );
    }

    logBusinessEvent(isReplay ? "booking.crm.replayed" : "booking.crm.created", {
      branchId: resolvedBranchId,
      bookingIds: insertedIds,
      bookingId: insertedIds[0],
      customerId: resolvedCustomerId,
      staffId: resolvedStaffId,
      serviceIds: orderedServiceIds,
      bookingType: d.type,
      deliveryType,
      actorId: staff?.id ?? (isDevBypass ? "dev-bypass" : operator.authUserId),
      workspace: staff?.system_role ?? (isDevBypass ? "dev" : (staffRole ?? "unknown")),
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

    return {
      ok: true, bookingId: insertedIds[0]!, orderId: atomicData.order_id,
      orderNumber: atomicData.order_number, serviceLineIds: insertedIds,
      attendeeIds: atomicData.attendee_ids, serviceCount: insertedIds.length,
      attendeeCount: attendees.length, warning: availabilityWarning,
    };
  } catch (error) {
    if (error instanceof ServiceLineQuoteError) {
      return { ok: false, code: error.code, message: "Service duration configuration needs review. Refresh and review the selected services." };
    }
    console.error("[CRM_BOOKING] caught error", { ...logContext, error });

    if (
      error instanceof SlotUnavailableError ||
      (error instanceof AppError && error.code === "SLOT_UNAVAILABLE")
    ) {
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
        SERVICE_UNAVAILABLE:
          "One or more selected services are unavailable. Please choose different services.",
        SERVICE_INELIGIBLE:
          "This service is not available for the selected booking type at this branch.",
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
