"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isDevAuthBypassEnabled } from "@/lib/dev-bypass";
import type { Json } from "@/types/supabase";
import {
  createInhouseBookingMultiSchema,
  type CreateInhouseBookingMultiInput,
} from "@/lib/validations/booking";
import {
  assignTherapistBySeniorityMulti,
  getAvailableSlotsMulti,
} from "@/lib/engine/availability";
import { validateBookingAgainstBranchRules, getBranchBookingRulesOrDefault } from "@/lib/queries/branch-booking-rules";
import { checkHomeServiceDispatchConflict } from "@/lib/bookings/dispatch-conflict";
import { geocodeAddress, buildGoogleMapsSearchUrl } from "@/lib/maps/google-maps";
import { isResourceAvailable, autoAssignBookingResource } from "@/lib/engine/resource-availability";
import { SlotUnavailableError } from "@/types/errors";
import { createNotification } from "@/lib/notifications/create";
import { logError, logBusinessEvent } from "@/lib/logger";

type CreateInhouseBookingResult =
  | { ok: true; bookingId: string }
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
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      message: firstIssue?.message ?? "Please check your input and try again.",
    };
  }

  const d: CreateInhouseBookingMultiInput = parsed.data;
  const deliveryType = d.deliveryType ?? (d.type === "home_service" ? "home_service" : "in_spa");

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
  const bookingRoles = ["owner", "manager", "assistant_manager", "store_manager", "crm", "csr", "csr_head", "csr_staff"];

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
  } else if (!staff || !bookingRoles.includes(staff.system_role)) {
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

  // Home service requires address details
  if (deliveryType === "home_service") {
    if (!d.homeServiceAddress?.trim()) {
      return { ok: false, code: "HS_ADDRESS_MISSING", message: "Full address is required for home service bookings." };
    }
    if (!d.homeServiceBarangay?.trim() && !d.homeServiceCity?.trim()) {
      return { ok: false, code: "HS_LOCATION_MISSING", message: "Barangay or city is required for home service bookings." };
    }
  }

  const logContext = {
    branchId: resolvedBranchId,
    staffId: d.staffId ?? "auto",
    serviceIds: d.serviceIds,
    bookingDate: d.date,
    startTime: d.startTime,
    operatorId: staff?.id ?? "dev-bypass",
  };

  try {
    const rulesCheck = await validateBookingAgainstBranchRules({
      branchId: resolvedBranchId,
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

    let resolvedStaffId: string;
    if (!d.staffId) {
      resolvedStaffId = await assignTherapistBySeniorityMulti({
        branchId: resolvedBranchId,
        serviceIds: d.serviceIds,
        date: d.date,
        startTime: d.startTime,
      });
    } else {
      const candidateSlots = await getAvailableSlotsMulti({
        branchId: resolvedBranchId,
        serviceIds: d.serviceIds,
        date: d.date,
      });
      const exact = candidateSlots.find(
        (slot) =>
          slot.staff_id === d.staffId &&
          slot.available &&
          slot.slot_time.startsWith(d.startTime.substring(0, 5))
      );
      if (!exact) {
        throw new SlotUnavailableError();
      }
      resolvedStaffId = d.staffId;
    }

    const admin = createAdminClient();

    let resolvedResourceId = d.resourceId ?? null;

    // ── Calculate total combined duration for resource check ────────────────
    const { data: svcsCombined } = await admin
      .from("services")
      .select("duration_minutes, buffer_before, buffer_after")
      .in("id", d.serviceIds);

    const totalMinutesCombined = (svcsCombined ?? []).reduce(
      (sum, s) => sum + s.duration_minutes + s.buffer_before + s.buffer_after,
      0
    );
    const combinedEndTime = computeEndTimeLocal(d.startTime, totalMinutesCombined);

    // ── Auto-assign room if not provided ──────────────────────────────────
    if (deliveryType !== "home_service" && !resolvedResourceId && combinedEndTime) {
      resolvedResourceId = await autoAssignBookingResource({
        branchId: resolvedBranchId,
        date: d.date,
        startTime: d.startTime,
        endTime: combinedEndTime,
      });

      if (!resolvedResourceId) {
        return {
          ok: false,
          code: "RESOURCE_UNAVAILABLE",
          message: "No room/bed is available for this time. Please assign a space manually or choose another time.",
        };
      }
    }

    // Verify resource availability if provided manually
    if (d.resourceId && combinedEndTime) {
      const isAvailable = await isResourceAvailable({
        resourceId: d.resourceId,
        date: d.date,
        startTime: d.startTime,
        endTime: combinedEndTime,
      });
      if (!isAvailable) {
        return {
          ok: false,
          code: "RESOURCE_UNAVAILABLE",
          message: "The selected room/bed is already booked for this time.",
        };
      }
    }

    const { data: customerId, error: customerError } = await admin.rpc("upsert_customer", {
      p_phone: d.phone,
      p_full_name: d.fullName,
      p_email: d.email || undefined,
    });

    if (customerError || !customerId) {
      logBookingError(logContext, customerError ?? new Error("upsert_customer returned no ID"));
      return {
        ok: false,
        code: "CUSTOMER_ERROR",
        message: "Failed to create or find customer record. Please check the phone number and name.",
      };
    }
    const resolvedCustomerId = String(customerId);

    const { data: servicesData, error: servicesError } = await admin
      .from("services")
      .select("id, name, price, duration_minutes, buffer_before, buffer_after")
      .in("id", d.serviceIds)
      .eq("is_active", true);

    if (servicesError) {
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
      return {
        ok: false,
        code: "SERVICE_UNAVAILABLE",
        message: "One or more selected services are unavailable. Please choose different services.",
      };
    }

    const { data: branchOverrides, error: branchOverridesError } = await admin
      .from("branch_services")
      .select("service_id, custom_price, available_in_spa, available_home_service")
      .eq("branch_id", resolvedBranchId)
      .in("service_id", d.serviceIds)
      .eq("is_active", true);

    if (branchOverridesError) {
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

    // Verify each service is eligible for the booking type
    const needsInSpa = deliveryType !== "home_service";
    for (const serviceId of d.serviceIds) {
      const override = overrideByServiceId.get(serviceId);
      if (override) {
        const eligible = needsInSpa ? override.available_in_spa : override.available_home_service;
        if (!eligible) {
          const svc = servicesById.get(serviceId);
          return {
            ok: false,
            code: "SERVICE_INELIGIBLE",
            message: `${svc?.name ?? "A selected service"} is not available for ${deliveryType === "home_service" ? "home service" : "in-spa"} bookings at this branch.`,
          };
        }
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

    if (deliveryType === "home_service" && d.homeServiceAddress) {
      const geocoded =
        typeof d.homeServiceLat === "number" && typeof d.homeServiceLng === "number"
          ? {
              lat: d.homeServiceLat,
              lng: d.homeServiceLng,
              formattedAddress: d.homeServiceFormattedAddress ?? "",
              placeId: d.homeServicePlaceId ?? "",
              mapUrl: buildGoogleMapsSearchUrl(d.homeServiceLat, d.homeServiceLng),
            }
          : await geocodeAddress(
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

      const branchRules = await getBranchBookingRulesOrDefault(resolvedBranchId);
      const dispatchResult = await checkHomeServiceDispatchConflict({
        branchId: resolvedBranchId,
        bookingDate: d.date,
        startTime: d.startTime,
        endTime: combinedEndTime ?? d.startTime,
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
          ? dispatchResult.needs_location_review
          : false,
        travel_minutes_estimate: null,
        driver_capacity_checked: true,
        dispatch_warning: dispatchResult.conflict === "warning" ? dispatchResult.message : null,
      } satisfies { [key: string]: Json | undefined };
    }

    const insertedIds: string[] = [];
    let currentStart = d.startTime;

    for (const serviceId of d.serviceIds) {
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

      const totalMinutes =
        Number(service.duration_minutes) +
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
      const metadata = {
        price_paid:
          overridePrice !== null && overridePrice !== undefined
            ? Number(overridePrice)
            : Number(service.price),
        service_name:          service.name,
        duration_minutes:      Number(service.duration_minutes),
        customer_notes:        d.notes ?? null,
        ...(hsAddressData && { home_service_address: hsAddressData }),
        ...(hsAddressData && { dispatch: dispatchData }),
      };

      const servicePrice = overrideByServiceId.get(service.id)?.custom_price ?? service.price;
      const amountPaid = Number(servicePrice);

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
          payment_method:    d.paymentMethod,
          payment_status:    "paid",
          payment_reference: d.paymentReference ?? null,
          amount_paid:       amountPaid,
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
          new_payment_method:    d.paymentMethod,
          new_payment_status:    "paid",
          new_amount_paid:       amountPaid,
          new_payment_reference: d.paymentReference ?? null,
          reason:                d.paymentNote?.trim() || "CRM in-house booking — payment recorded at creation",
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
        body:             `${d.fullName} has a confirmed ${isHomeService ? "Home Service " : ""}booking for ${serviceNames} on ${d.date} at ${d.startTime}.`,
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

    if (isHomeService && typeof dispatchData.dispatch_warning === "string") {
      notificationJobs.push(
        createNotification({
          branchId: resolvedBranchId,
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

    revalidatePath("/crm");
    revalidatePath("/crm/bookings");
    revalidatePath("/crm/bookings/new");
    revalidatePath("/manager");
    revalidatePath("/manager/bookings");

    return { ok: true, bookingId: insertedIds[0]! };
  } catch (error) {
    if (error instanceof SlotUnavailableError) {
      return {
        ok: false,
        code: "SLOT_UNAVAILABLE",
        message: "No available therapist for this time slot. Please select another time or therapist.",
      };
    }

    logBookingError(logContext, error);

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
