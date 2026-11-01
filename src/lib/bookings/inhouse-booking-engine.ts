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
import {
  assignTherapistsForOrder,
} from "@/lib/engine/availability";
import { AppError, GroupTherapistAllocationError, SlotUnavailableError } from "@/types/errors";
import { createNotification } from "@/lib/notifications/create";
import { logError, logBusinessEvent } from "@/lib/logger";
import { revalidateOperationalBookingSurfaces } from "@/lib/bookings/revalidate-booking-surfaces";
import { canAccessCrmWorkspace } from "@/lib/auth/crm-permissions";
import { isConsultationOnlyService } from "@/lib/bookings/consultation-only-service";
import { bookingCreationProvenance } from "@/lib/bookings/therapist-provenance";
import { validateBranchServiceEligibility } from "@/lib/services/service-catalog";
import { resolveBookingLineQuotes } from "@/lib/services/resolve-booking-line-quotes";
import { ServiceLineQuoteError, toServiceLineCommercialSnapshot } from "@/lib/services/service-line-quote";

export type BookingFailureDiagnostics = {
  ok: false;
  code: string;
  message: string;
  title?: string;
  field?:
    | "fullName"
    | "phone"
    | "date"
    | "time"
    | "staffId"
    | "service"
    | "resourceId"
    | "homeServiceAddress"
    | "paymentMethod"
    | "general";
  guestIndex?: number;
  guestName?: string;
  serviceId?: string;
  serviceName?: string;
  correctiveAction?: string;
  retrySafety?: "safe" | "verify_first" | "do_not_retry";
  diagnosticId?: string;
};

export type CreateInhouseBookingResult =
  | {
      ok: true;
      bookingId: string;
      orderId?: string;
      orderNumber?: string;
      serviceLineIds?: string[];
      attendeeIds?: string[];
      serviceCount?: number;
      attendeeCount?: number;
      warning?: string;
    }
  | BookingFailureDiagnostics;

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
    const fieldName = firstIssue?.path[0];
    let guestIndex: number | undefined = undefined;
    let field: BookingFailureDiagnostics["field"] = undefined;
    if (fieldName === "attendees" && typeof firstIssue?.path[1] === "number") {
      guestIndex = firstIssue.path[1];
      const subField = firstIssue.path[2];
      if (subField === "serviceIds") field = "service";
      else if (subField === "name") field = "fullName";
    } else if (fieldName === "fullName") field = "fullName";
    else if (fieldName === "phone") field = "phone";
    else if (fieldName === "serviceIds") field = "service";
    else if (fieldName === "date") field = "date";
    else if (fieldName === "startTime") field = "time";
    else if (fieldName === "staffId") field = "staffId";
    else if (fieldName === "resourceId") field = "resourceId";
    else if (fieldName === "paymentMethod") field = "paymentMethod";
    else if (typeof fieldName === "string" && fieldName.startsWith("homeService")) field = "homeServiceAddress";

    console.error("[CRM_BOOKING] validation failed", parsed.error.flatten());
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      title: "Please check your booking details",
      message: firstIssue?.message ?? "Please check your input and try again.",
      field,
      guestIndex,
      correctiveAction: "Review and correct the highlighted fields.",
      retrySafety: "safe",
    };
  }

  const d: CreateInhouseBookingMultiInput = parsed.data;
  if (d.customerRequestedTherapist && !d.staffId) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      title: "Therapist selection required",
      message: "Select a therapist requested by the customer.",
      field: "staffId",
      correctiveAction: "Select a therapist or uncheck the customer request.",
      retrySafety: "safe",
    };
  }
  const attendees = d.attendees ?? [{
    id: crypto.randomUUID(), name: d.fullName, isOrganizer: true, serviceIds: d.serviceIds,
  }];
  const groupBooking = attendees.length > 1;
  if (groupBooking && d.customerRequestedTherapist) {
    return {
      ok: false,
      code: "EXACT_THERAPIST_UNSUPPORTED_FOR_GROUP",
      title: "Exact therapist unsupported for group",
      message:
        "Exact therapist allocation is unsupported for group bookings. Proceed with a non-guaranteed preference after customer agreement, or return to single booking.",
      field: "staffId",
      correctiveAction: "Proceed with a non-guaranteed preference after customer agreement, or return to single booking.",
      retrySafety: "safe",
    };
  }
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
      title: "Invalid booking time",
      message: parsedStartTime.error,
      field: "time",
      correctiveAction: "Select a valid time format (HH:MM).",
      retrySafety: "safe",
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
        title: "Branch missing",
        message: "Dev bypass active — please provide an explicit branchId in the booking form.",
        field: "general",
        correctiveAction: "Select a branch before saving.",
        retrySafety: "safe",
      };
    }
  } else if (!staff || !staffRole || !canAccessCrmWorkspace(staffRole)) {
    return {
      ok: false,
      code: "UNAUTHORIZED",
      title: "Access restricted",
      message: "You do not have permission to create bookings.",
      field: "general",
      correctiveAction: "Sign in with an account authorized to create bookings.",
      retrySafety: "do_not_retry",
    };
  }

  const resolvedBranchId = d.branchId ?? staff?.branch_id;
  if (!resolvedBranchId) {
    return {
      ok: false,
      code: "BRANCH_MISSING",
      title: "Branch missing",
      message: "You are not assigned to a branch. Please contact an administrator.",
      field: "general",
      correctiveAction: "Contact an administrator to assign a branch.",
      retrySafety: "do_not_retry",
    };
  }

  if (!isDevBypass && staff && staffRole !== "owner" && staff.branch_id !== resolvedBranchId) {
    return {
      ok: false,
      code: "CRM_BRANCH_FORBIDDEN",
      title: "Branch forbidden",
      message: "You can only create bookings for your assigned branch.",
      field: "general",
      correctiveAction: "Switch to your assigned branch before creating bookings.",
      retrySafety: "do_not_retry",
    };
  }

  // Home service requires address details
  if (deliveryType === "home_service") {
    if (!d.homeServiceAddress?.trim() && !d.homeServiceFormattedAddress?.trim()) {
      return {
        ok: false,
        code: "HS_ADDRESS_MISSING",
        title: "Home service address required",
        message: "Enter the complete home-service address.",
        field: "homeServiceAddress",
        correctiveAction: "Select a complete address using Google Places search.",
        retrySafety: "safe",
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
        title: "Precise location required",
        message: CRM_PRECISE_HOME_SERVICE_LOCATION_MESSAGE,
        field: "homeServiceAddress",
        correctiveAction: "Select an address with verified coordinates from the dropdown.",
        retrySafety: "safe",
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
          return {
            ok: false,
            code: "IDEMPOTENCY_CONFLICT",
            title: "Conflicting booking submission",
            message: "This booking request key was already used for different details.",
            field: "general",
            correctiveAction: "Check existing bookings to confirm whether the order was already saved.",
            retrySafety: "verify_first",
          };
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
      const isPast = rulesCheck.code === "PAST_DATE" || rulesCheck.message.includes("passed");
      return {
        ok: false,
        code: rulesCheck.code ?? "BOOKING_RULES_ERROR",
        title: isPast ? "Selected date has passed" : "Branch booking rule limit",
        message: rulesCheck.message,
        field: rulesCheck.field ?? (isPast || rulesCheck.message.includes("advance") ? "date" : "time"),
        correctiveAction: rulesCheck.correctiveAction ?? "Select a valid booking date and time within branch hours.",
        retrySafety: "safe",
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
        title: "Service unavailable",
        message:
          "One or more selected services are not available for this booking type at this branch.",
        field: "service",
        correctiveAction: "Review the selected services and choose services offered at this branch.",
        retrySafety: "safe",
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
        title: "Coordinating provider required",
        message:
          "Select a coordinating provider and confirm the full participant and staffing arrangement manually.",
        field: "staffId",
        correctiveAction: "Select an available staff member to coordinate this consultation package.",
        retrySafety: "safe",
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
        let code = "EXACT_TIME_UNAVAILABLE";
        let title = "Time unavailable";
        let field: BookingFailureDiagnostics["field"] = "time";
        let correctiveAction = "Choose another available start time.";

        if (exactAvailability.reasonCode === "outside_in_spa_hours") {
          code = "OPERATING_HOURS_VIOLATION";
          title = "Outside operating hours";
          correctiveAction = "Select a start time within branch in-spa operating hours.";
        } else if (exactAvailability.reasonCode === "outside_home_service_hours") {
          code = "OPERATING_HOURS_VIOLATION";
          title = "Outside home service hours";
          correctiveAction = "Select a start time within home service dispatch hours.";
        } else if (exactAvailability.reasonCode === "past_time") {
          code = "PAST_TIME_PROHIBITED";
          title = "Selected time has passed";
          correctiveAction = "Choose a future time.";
        } else if (exactAvailability.reasonCode === "missing_service_capability") {
          code = "MISSING_SERVICE_CAPABILITY";
          title = "Therapist qualification mismatch";
          field = "staffId";
          correctiveAction = "Choose an available qualified therapist or select Automatic.";
        } else if (exactAvailability.reasonCode === "blocked_by_booking") {
          code = "THERAPIST_BOOKING_CONFLICT";
          title = "Therapist already booked";
          field = "staffId";
          correctiveAction = "Choose another therapist or select a different start time.";
        } else if (exactAvailability.reasonCode === "no_schedule_for_time") {
          code = "NO_SCHEDULE_AT_START";
          title = "Therapist not scheduled";
          correctiveAction = "Choose a time during scheduled staff shifts.";
        }

        return {
          ok: false,
          code,
          title,
          message: exactAvailability.message ?? "No qualified therapist can start at the selected exact time.",
          field,
          correctiveAction,
          retrySafety: "safe",
        };
      }
      selectedExactProvider = d.staffId
        ? exactAvailability.providers.find((provider) => provider.staffId === d.staffId && provider.selectable)
        : exactAvailability.providers.find((provider) => provider.selectable);
      if (!selectedExactProvider) {
        return {
          ok: false,
          code: "EXACT_TIME_UNAVAILABLE",
          title: "Therapist unavailable",
          message: "No qualified therapist can start at the selected exact time.",
          field: "staffId",
          correctiveAction: "Choose another available therapist or select another time.",
          retrySafety: "safe",
        };
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
        title: "Service timing error",
        message: "Could not calculate the service duration. Please refresh and try again.",
        field: "general",
        correctiveAction: "Refresh the page and reselect your services.",
        retrySafety: "safe",
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
        title: "Booking crosses midnight",
        message:
          "This booking crosses midnight. Choose an earlier start time until overnight booking is supported.",
        field: "time",
        correctiveAction: "Select an earlier start time so the service finishes before midnight.",
        retrySafety: "safe",
      };
    }

    // The single-person room path remains unchanged; groups reserve capacity per attendee.
    let attendeeResourceIds: Array<string | null> = attendees.map(() => null);
    if (groupBooking && deliveryType !== "home_service") {
      if (d.resourceId) {
        return {
          ok: false,
          code: "RESOURCE_INVALID",
          title: "Automatic room allocation required",
          message: "Use automatic room assignment when booking multiple guests.",
          field: "resourceId",
          correctiveAction: "Clear manual room selection and use Automatic for groups.",
          retrySafety: "safe",
        };
      }
      const allocated = await allocateResourcesForAttendees({
        branchId: resolvedBranchId,
        date: d.date,
        windows: attendeeEndTimes.map((endTime) => ({ startTime, endTime: endTime ?? startTime })),
      });
      if (!allocated) {
        return {
          ok: false,
          code: "RESOURCE_UNAVAILABLE",
          title: "Treatment rooms unavailable",
          message: "Not enough rooms are available for all guests.",
          field: "resourceId",
          correctiveAction: "Choose another start time or consider staggering the appointments.",
          retrySafety: "safe",
        };
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
            title: "Treatment room unavailable",
            message: "No room is available at the selected time.",
            field: "resourceId",
            correctiveAction: "Choose another start time when a treatment room is free.",
            retrySafety: "safe",
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
          title: "Invalid room selected",
          message: "The selected room does not belong to this branch or is inactive.",
          field: "resourceId",
          correctiveAction: "Select Automatic room assignment or choose an active room.",
          retrySafety: "safe",
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
          title: "Treatment room occupied",
          message: "The selected room is unavailable.",
          field: "resourceId",
          correctiveAction: "Select Automatic room assignment or choose another room.",
          retrySafety: "safe",
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
          title: "Customer not found",
          message: "Select a customer.",
          field: "fullName",
          correctiveAction: "Search for a registered customer or enter complete new customer details.",
          retrySafety: "safe",
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
          title: "Customer details error",
          message: "Could not save customer details. Please check the phone number.",
          field: "phone",
          correctiveAction: "Ensure the customer phone number is valid and contains at least 7 digits.",
          retrySafety: "safe",
        };
      }
      resolvedCustomerId = String(customerId);
    }
    if (!resolvedCustomerId) {
      return {
        ok: false,
        code: "CUSTOMER_ERROR",
        title: "Customer not selected",
        message: "Select a customer.",
        field: "fullName",
        correctiveAction: "Enter customer name and contact details.",
        retrySafety: "safe",
      };
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
        title: "Services load error",
        message: "Could not load service details. Please refresh and try again.",
        field: "service",
        correctiveAction: "Refresh the page and reselect your services.",
        retrySafety: "safe",
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
        title: "Service inactive",
        message: "One or more selected services are unavailable. Please choose different services.",
        field: "service",
        correctiveAction: "Choose active services from the catalog.",
        retrySafety: "safe",
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
        title: "Pricing load error",
        message: "Could not load branch pricing. Please refresh and try again.",
        field: "service",
        correctiveAction: "Refresh the page and reselect your services.",
        retrySafety: "safe",
      };
    }

    const overrideByServiceId = new Map(
      (branchOverrides ?? []).map((row) => [row.service_id, row])
    );

    if (overrideByServiceId.size !== allServiceIds.length) {
      return {
        ok: false,
        code: "SERVICE_NOT_CONFIGURED_FOR_BRANCH",
        title: "Service not configured for branch",
        message: "One or more selected services are not configured for this branch.",
        field: "service",
        correctiveAction: "Choose services that are offered at this branch.",
        retrySafety: "safe",
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
          title: "Precise location required",
          message: CRM_PRECISE_HOME_SERVICE_LOCATION_MESSAGE,
          field: "homeServiceAddress",
          correctiveAction: "Select an address from the dropdown suggestions.",
          retrySafety: "safe",
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
          title: "Address out of range",
          message: distanceResult.message,
          field: "homeServiceAddress",
          correctiveAction: "Verify the address or choose an In-Spa appointment.",
          retrySafety: "safe",
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
        return {
          ok: false,
          code: "DISPATCH_CONFLICT",
          title: "Home service dispatch conflict",
          message: dispatchResult.message,
          field: "time",
          correctiveAction: "Select another start time to allow sufficient driver travel buffer.",
          retrySafety: "safe",
        };
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
          home_service_transport: homeServiceQuote.transportSnapshot,
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
      ...(homeServiceQuote
        ? { home_service_transport: homeServiceQuote.transportSnapshot }
        : {}),
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
        "CASH_DRAWER_SESSION_REQUIRED",
        "BRANCH_UNAUTHORIZED",
        "CREATION_ROLE_UNAUTHORIZED",
      ];
      const code =
        knownCodes.find((known) => message.includes(known)) ?? "BOOKING_ATOMIC_PERSISTENCE_FAILED";
      logBookingError(logContext, atomicError ?? new Error(message));

      let title = "Booking submission unresolved";
      let displayMessage =
        "Could not verify whether the booking was created. Please check existing bookings before trying again.";
      let field: BookingFailureDiagnostics["field"] = "general";
      let correctiveAction =
        "Check existing bookings to confirm whether the appointment was already created before resubmitting.";
      let retrySafety: BookingFailureDiagnostics["retrySafety"] = "verify_first";

      if (code === "BOOKING_STAFF_TIME_CONFLICT") {
        title = "Therapist booked concurrently";
        displayMessage = "The selected therapist was just reserved by another booking during save.";
        field = "staffId";
        correctiveAction = "Choose another therapist or select a different start time.";
        retrySafety = "safe";
      } else if (code === "BOOKING_RESOURCE_TIME_CONFLICT") {
        title = "Treatment room conflict";
        displayMessage = "The treatment room was just reserved by another booking during save.";
        field = "resourceId";
        correctiveAction = "Choose Automatic room assignment or select another room.";
        retrySafety = "safe";
      } else if (code === "CASH_DRAWER_SESSION_REQUIRED") {
        title = "Cash drawer session required";
        displayMessage = "A cash drawer session must be open before recording a cash payment.";
        field = "paymentMethod";
        correctiveAction = "Open a cash drawer session in Cash Flow, or choose an electronic payment method.";
        retrySafety = "safe";
      } else if (code === "IDEMPOTENCY_CONFLICT") {
        title = "Conflicting booking submission";
        displayMessage = "This booking request conflicts with an existing submitted booking.";
        field = "general";
        correctiveAction = "Check existing bookings to confirm whether the appointment was already created before resubmitting.";
        retrySafety = "verify_first";
      } else if (code === "ACCOUNT_SELECTION_REQUIRED") {
        title = "Payment account selection required";
        displayMessage = "Select the payment account before collecting this payment.";
        field = "paymentMethod";
        correctiveAction = "Select the payment account in Cash Flow or collect payment at checkout.";
        retrySafety = "safe";
      } else if (code === "ACCOUNT_NOT_CONFIGURED") {
        title = "Payment account not configured";
        displayMessage = "No compatible payment account is configured for this branch.";
        field = "paymentMethod";
        correctiveAction = "Uncheck advance payment to save as Unpaid, or configure branch payment accounts.";
        retrySafety = "safe";
      } else if (code === "BRANCH_UNAUTHORIZED" || code === "CREATION_ROLE_UNAUTHORIZED") {
        title = "Permission denied";
        displayMessage = "You are not authorized to create bookings for this branch.";
        field = "general";
        correctiveAction = "Switch to your assigned branch or contact your administrator.";
        retrySafety = "do_not_retry";
      }

      return {
        ok: false,
        code,
        title,
        message: displayMessage,
        field,
        correctiveAction,
        retrySafety,
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
      return {
        ok: false,
        code: error.code,
        title: "Service duration configuration error",
        message: "Service duration configuration needs review. Refresh and review the selected services.",
        field: "service",
        correctiveAction: "Reselect the service or check service duration options.",
        retrySafety: "safe",
      };
    }
    console.error("[CRM_BOOKING] caught error", { ...logContext, error });

    const isGroupTherapistClass = typeof GroupTherapistAllocationError === "function";
    const groupReason =
      isGroupTherapistClass && error instanceof GroupTherapistAllocationError
        ? error.reason
        : typeof error === "object" && error !== null && "reason" in error
          ? (error as { reason?: unknown }).reason
          : undefined;
    const isGroupTherapistError =
      (isGroupTherapistClass && error instanceof GroupTherapistAllocationError) ||
      (error instanceof Error &&
        (error.name === "GroupTherapistAllocationError" ||
          groupReason === "INDIVIDUAL_THERAPIST_UNAVAILABLE" ||
          groupReason === "GROUP_THERAPIST_CAPACITY_EXCEEDED"));

    if (isGroupTherapistError) {
      const gError = error as GroupTherapistAllocationError;
      if (groupReason === "INDIVIDUAL_THERAPIST_UNAVAILABLE") {
        const attendeeIdx = gError.attendeeIndex ?? 0;
        const attendeeName = attendees[attendeeIdx]?.name || `Guest ${attendeeIdx + 1}`;
        return {
          ok: false,
          code: "INDIVIDUAL_THERAPIST_UNAVAILABLE",
          title: "Therapist unavailable",
          message: `${attendeeName}: No qualified therapist is available at this time.`,
          guestIndex: attendeeIdx,
          guestName: attendeeName,
          serviceId: gError.serviceIds?.[0],
          field: "staffId",
          correctiveAction: "Choose another available start time or review the selected service.",
          retrySafety: "safe",
        };
      }
      return {
        ok: false,
        code: "GROUP_THERAPIST_CAPACITY_EXCEEDED",
        title: "Not enough therapists for this group",
        message: `Not enough distinct qualified therapists are available to serve all ${attendees.length} guests simultaneously.`,
        field: "staffId",
        correctiveAction: "Choose another start time or adjust the number of concurrent guests.",
        retrySafety: "safe",
      };
    }

    if (
      (typeof SlotUnavailableError === "function" && error instanceof SlotUnavailableError) ||
      (error instanceof AppError && error.code === "SLOT_UNAVAILABLE")
    ) {
      return {
        ok: false,
        code: "SLOT_UNAVAILABLE",
        title: "Therapist unavailable",
        message:
          "No scheduled therapist is available at this time. Try another time or check staff schedules.",
        field: "staffId",
        correctiveAction: "Choose another available start time or check staff schedules.",
        retrySafety: "safe",
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
        return {
          ok: false,
          code: errCode,
          title: "Booking validation error",
          message: safeMessages[errCode]!,
          field: errCode === "CUSTOMER_ERROR" ? "fullName" : errCode === "RESOURCE_UNAVAILABLE" ? "resourceId" : "general",
          correctiveAction: "Review booking details and retry saving.",
          retrySafety: "safe",
        };
      }
    }

    if (error instanceof Error) {
      // Categorize known error patterns without exposing raw internals
      const msg = error.message.toLowerCase();
      if (msg.includes("foreign key") || msg.includes("violates foreign key")) {
        return {
          ok: false,
          code: "REFERENCE_ERROR",
          title: "Related record missing",
          message: "A related record could not be found. Please refresh and try again.",
          field: "general",
          correctiveAction: "Refresh the form and verify customer and branch records.",
          retrySafety: "safe",
        };
      }
      if (msg.includes("unique") || msg.includes("duplicate")) {
        return {
          ok: false,
          code: "DUPLICATE_ERROR",
          title: "Duplicate booking detected",
          message: "This booking appears to be a duplicate. Please check existing bookings.",
          field: "general",
          correctiveAction: "Check existing bookings to confirm whether this booking was already created.",
          retrySafety: "verify_first",
        };
      }
    }

    return {
      ok: false,
      code: "UNKNOWN_ERROR",
      title: "Booking submission unconfirmed",
      message:
        "An unexpected error occurred while saving. The booking may have been partially or fully processed.",
      field: "general",
      correctiveAction:
        "Check existing bookings or refresh before attempting to submit again to prevent duplicate bookings.",
      retrySafety: "verify_first",
    };
  }
}
