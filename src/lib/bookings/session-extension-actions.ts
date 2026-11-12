"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canAccessCrmWorkspace } from "@/lib/auth/crm-permissions";
import { canonicalizeSystemRole } from "@/constants/staff";
import { isDevAuthBypassEnabled, getDevBypassLayoutStaff } from "@/lib/dev-bypass";
import { resolveExactCrmBookingTime } from "@/lib/engine/exact-crm-booking-time";
import { bookingBlocksAvailability } from "@/lib/bookings/hold-status";
import { rangesOverlap, timeToMinutes } from "@/lib/engine/slot-time";
import { createOrUpdateNotification } from "@/lib/notifications/workflow-notifications-store";
import { revalidateOperationalBookingSurfaces } from "@/lib/bookings/revalidate-booking-surfaces";
import type { Json } from "@/types/supabase";

export type SessionExtensionConflictResolution =
  | {
      kind: "clear";
      summary: string;
    }
  | {
      kind: "domino_auto_swap";
      conflictingBookingId: string;
      conflictingCustomerName: string;
      conflictingStartTime: string;
      replacementStaffId: string;
      replacementStaffName: string;
      replacementStatusLabel: string;
      wasCustomerRequested: boolean;
      summary: string;
    }
  | {
      kind: "blocked";
      reason: string;
    };

export type SessionExtensionPreview = {
  ok: boolean;
  error?: string;
  bookingId: string;
  extraMinutes: number;
  currentDurationMinutes: number;
  newDurationMinutes: number;
  currentEndTime: string;
  newEndTime: string;
  newSessionDueAtIso: string | null;
  currentPrice: number;
  additionalPrice: number;
  newTotalPrice: number;
  resolution: SessionExtensionConflictResolution;
};

export type CommitSessionExtensionResult = {
  ok: boolean;
  message: string;
  newEndTime?: string;
  newSessionDueAtIso?: string | null;
  newDurationMinutes?: number;
  additionalPrice?: number;
  newTotalPrice?: number;
  swappedBookingId?: string | null;
  swappedToStaffName?: string | null;
};

function minutesToClockTime(totalMinutes: number): string {
  const clamped = Math.min(23 * 60 + 59, Math.max(0, Math.round(totalMinutes)));
  const hh = Math.floor(clamped / 60);
  const mm = clamped % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00`;
}

function roundPhpPrice(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

async function getCrmOperator() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  if (isDevAuthBypassEnabled()) {
    const mock = getDevBypassLayoutStaff();
    return {
      id: "00000000-0000-0000-0000-000000000000",
      branch_id: mock.branch_id,
      system_role: mock.system_role,
    };
  }

  const admin = createAdminClient();
  const { data: staff } = await admin
    .from("staff")
    .select("id, branch_id, system_role")
    .eq("auth_user_id", auth.user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!staff) return null;
  const role = canonicalizeSystemRole(staff.system_role);
  if (!role || !canAccessCrmWorkspace(role)) return null;
  return { ...staff, system_role: role };
}

export async function previewSessionExtensionAction(input: {
  bookingId: string;
  extraMinutes: number;
}): Promise<SessionExtensionPreview> {
  const extraMinutes = Math.max(5, Math.min(180, Math.round(Number(input.extraMinutes) || 0)));
  const operator = await getCrmOperator();
  if (!operator) {
    return {
      ok: false,
      error: "Unauthorized to preview session extension.",
      bookingId: input.bookingId,
      extraMinutes,
      currentDurationMinutes: 60,
      newDurationMinutes: 60 + extraMinutes,
      currentEndTime: "",
      newEndTime: "",
      newSessionDueAtIso: null,
      currentPrice: 0,
      additionalPrice: 0,
      newTotalPrice: 0,
      resolution: { kind: "blocked", reason: "Unauthorized" },
    };
  }

  const admin = createAdminClient();
  const { data: booking, error } = await admin
    .from("bookings")
    .select(
      "id, order_id, branch_id, service_id, staff_id, resource_id, booking_date, start_time, end_time, status, booking_progress_status, delivery_type, session_started_at, session_due_at, metadata, services(name, price, duration_minutes)"
    )
    .eq("id", input.bookingId)
    .maybeSingle();

  if (error || !booking) {
    return {
      ok: false,
      error: "Booking could not be found.",
      bookingId: input.bookingId,
      extraMinutes,
      currentDurationMinutes: 60,
      newDurationMinutes: 60 + extraMinutes,
      currentEndTime: "",
      newEndTime: "",
      newSessionDueAtIso: null,
      currentPrice: 0,
      additionalPrice: 0,
      newTotalPrice: 0,
      resolution: { kind: "blocked", reason: "Booking not found" },
    };
  }

  const meta =
    booking.metadata && typeof booking.metadata === "object" && !Array.isArray(booking.metadata)
      ? (booking.metadata as Record<string, unknown>)
      : {};

  const svcRel = Array.isArray(booking.services) ? booking.services[0] : booking.services;
  const currentDurationMinutes =
    typeof meta.duration_minutes === "number" && meta.duration_minutes > 0
      ? meta.duration_minutes
      : svcRel?.duration_minutes ?? 60;

  const currentPrice =
    typeof meta.price_paid === "number" && meta.price_paid >= 0
      ? meta.price_paid
      : Number(svcRel?.price ?? 0);

  // Pro-rata extension calculation based on the active service's per-minute rate
  const perMinuteRate = currentDurationMinutes > 0 ? currentPrice / currentDurationMinutes : 0;
  const additionalPrice = roundPhpPrice(Math.round((perMinuteRate * extraMinutes) / 10) * 10);
  const newTotalPrice = roundPhpPrice(currentPrice + additionalPrice);
  const newDurationMinutes = currentDurationMinutes + extraMinutes;

  const startMins = timeToMinutes(booking.start_time);
  const currentEndMins = booking.end_time
    ? timeToMinutes(booking.end_time)
    : startMins + currentDurationMinutes;
  const newEndMins = currentEndMins + extraMinutes;

  if (newEndMins >= 24 * 60) {
    return {
      ok: false,
      error: "Extension crosses midnight.",
      bookingId: booking.id,
      extraMinutes,
      currentDurationMinutes,
      newDurationMinutes,
      currentEndTime: booking.end_time ?? minutesToClockTime(currentEndMins),
      newEndTime: minutesToClockTime(newEndMins),
      newSessionDueAtIso: null,
      currentPrice,
      additionalPrice,
      newTotalPrice,
      resolution: {
        kind: "blocked",
        reason: "Extended session would cross midnight. Choose a shorter extension.",
      },
    };
  }

  const currentEndTime = booking.end_time ?? minutesToClockTime(currentEndMins);
  const newEndTime = minutesToClockTime(newEndMins);

  let newSessionDueAtIso: string | null = null;
  if (booking.session_due_at) {
    const dueMs = Date.parse(booking.session_due_at);
    if (Number.isFinite(dueMs)) {
      newSessionDueAtIso = new Date(dueMs + extraMinutes * 60_000).toISOString();
    }
  } else if (booking.session_started_at) {
    const startMs = Date.parse(booking.session_started_at);
    if (Number.isFinite(startMs)) {
      newSessionDueAtIso = new Date(startMs + newDurationMinutes * 60_000).toISOString();
    }
  }

  // Check if the assigned therapist has any overlapping booking during [currentEndMins, newEndMins]
  if (!booking.staff_id) {
    return {
      ok: true,
      bookingId: booking.id,
      extraMinutes,
      currentDurationMinutes,
      newDurationMinutes,
      currentEndTime,
      newEndTime,
      newSessionDueAtIso,
      currentPrice,
      additionalPrice,
      newTotalPrice,
      resolution: {
        kind: "clear",
        summary: `Ready to extend by +${extraMinutes} min (until ${newEndTime.slice(0, 5)}).`,
      },
    };
  }

  const { data: dayBookings } = await admin
    .from("bookings")
    .select(
      "id, service_id, staff_id, resource_id, start_time, end_time, status, hold_expires_at, delivery_type, metadata, customers(full_name)"
    )
    .eq("branch_id", booking.branch_id)
    .eq("booking_date", booking.booking_date)
    .neq("id", booking.id);

  const now = new Date();
  const activeDayBookings = (dayBookings ?? []).filter((b) => bookingBlocksAvailability(b, now));

  // 1. Check Therapist Conflicts in the extended window
  const therapistConflicts = activeDayBookings.filter((b) => {
    if (b.staff_id !== booking.staff_id) return false;
    const bStart = timeToMinutes(b.start_time);
    const bEnd = b.end_time ? timeToMinutes(b.end_time) : bStart + 60;
    return rangesOverlap(currentEndMins, newEndMins, bStart, bEnd);
  });

  if (therapistConflicts.length === 0) {
    return {
      ok: true,
      bookingId: booking.id,
      extraMinutes,
      currentDurationMinutes,
      newDurationMinutes,
      currentEndTime,
      newEndTime,
      newSessionDueAtIso,
      currentPrice,
      additionalPrice,
      newTotalPrice,
      resolution: {
        kind: "clear",
        summary: `Therapist and room are available until ${newEndTime.slice(0, 5)}. Checkout balance will update automatically (+₱${additionalPrice.toFixed(2)}).`,
      },
    };
  }

  if (therapistConflicts.length > 1) {
    return {
      ok: false,
      error: "Multiple upcoming bookings conflict with this extension.",
      bookingId: booking.id,
      extraMinutes,
      currentDurationMinutes,
      newDurationMinutes,
      currentEndTime,
      newEndTime,
      newSessionDueAtIso,
      currentPrice,
      additionalPrice,
      newTotalPrice,
      resolution: {
        kind: "blocked",
        reason: `This extension overlaps ${therapistConflicts.length} upcoming bookings for this therapist.`,
      },
    };
  }

  // Exactly 1 conflicting upcoming booking -> Run Domino Auto-Swap Finder using our FCFS Engine!
  const nextBooking = therapistConflicts[0]!;
  const nextMeta =
    nextBooking.metadata &&
    typeof nextBooking.metadata === "object" &&
    !Array.isArray(nextBooking.metadata)
      ? (nextBooking.metadata as Record<string, unknown>)
      : {};
  const provenance =
    nextMeta._therapist_provenance &&
    typeof nextMeta._therapist_provenance === "object"
      ? (nextMeta._therapist_provenance as Record<string, unknown>)
      : {};
  const wasCustomerRequested = provenance.therapist_selection_source === "customer_selected";
  const nextCustRel = Array.isArray(nextBooking.customers)
    ? nextBooking.customers[0]
    : nextBooking.customers;
  const nextCustomerName = nextCustRel?.full_name ?? "Next Guest";
  const nextDuration =
    typeof nextMeta.duration_minutes === "number" && nextMeta.duration_minutes > 0
      ? nextMeta.duration_minutes
      : Math.max(30, timeToMinutes(nextBooking.end_time ?? nextBooking.start_time) - timeToMinutes(nextBooking.start_time));

  if (!nextBooking.service_id) {
    return {
      ok: false,
      error: "Conflicting booking has no service ID for auto-swap.",
      bookingId: booking.id,
      extraMinutes,
      currentDurationMinutes,
      newDurationMinutes,
      currentEndTime,
      newEndTime,
      newSessionDueAtIso,
      currentPrice,
      additionalPrice,
      newTotalPrice,
      resolution: {
        kind: "blocked",
        reason: `Therapist has an upcoming booking at ${nextBooking.start_time.slice(0, 5)} (${nextCustomerName}).`,
      },
    };
  }

  const nextAvailability = await resolveExactCrmBookingTime({
    branchId: booking.branch_id,
    serviceIds: [nextBooking.service_id],
    selectedDurationMinutes: [nextDuration],
    date: booking.booking_date,
    startTime: nextBooking.start_time,
    bookingMode: "walkin",
    deliveryType: nextBooking.delivery_type === "home_service" ? "home_service" : "in_spa",
  });

  const replacement = nextAvailability.providers.find(
    (p) => p.selectable && p.staffId !== booking.staff_id
  );

  if (!replacement) {
    return {
      ok: false,
      error: "No replacement therapist available for the next booking.",
      bookingId: booking.id,
      extraMinutes,
      currentDurationMinutes,
      newDurationMinutes,
      currentEndTime,
      newEndTime,
      newSessionDueAtIso,
      currentPrice,
      additionalPrice,
      newTotalPrice,
      resolution: {
        kind: "blocked",
        reason: `Therapist is booked at ${nextBooking.start_time.slice(0, 5)} for ${nextCustomerName}, and no other qualified therapist is free to take over that appointment.`,
      },
    };
  }

  return {
    ok: true,
    bookingId: booking.id,
    extraMinutes,
    currentDurationMinutes,
    newDurationMinutes,
    currentEndTime,
    newEndTime,
    newSessionDueAtIso,
    currentPrice,
    additionalPrice,
    newTotalPrice,
    resolution: {
      kind: "domino_auto_swap",
      conflictingBookingId: nextBooking.id,
      conflictingCustomerName: nextCustomerName,
      conflictingStartTime: nextBooking.start_time.slice(0, 5),
      replacementStaffId: replacement.staffId,
      replacementStaffName: replacement.fullName,
      replacementStatusLabel: replacement.statusLabel,
      wasCustomerRequested,
      summary: wasCustomerRequested
        ? `Note: ${nextCustomerName} (${nextBooking.start_time.slice(0, 5)}) requested this therapist, but ${replacement.fullName} (${replacement.statusLabel}) can cover if approved.`
        : `Smart Auto-Swap Ready: ${nextCustomerName}'s ${nextBooking.start_time.slice(0, 5)} appointment ("Any Therapist") will automatically move to ${replacement.fullName} (${replacement.statusLabel}).`,
    },
  };
}

export async function commitSessionExtensionAction(input: {
  bookingId: string;
  extraMinutes: number;
}): Promise<CommitSessionExtensionResult> {
  const preview = await previewSessionExtensionAction(input);
  if (!preview.ok || preview.resolution.kind === "blocked") {
    return {
      ok: false,
      message:
        preview.resolution.kind === "blocked"
          ? preview.resolution.reason
          : preview.error ?? "Could not extend session.",
    };
  }

  const operator = await getCrmOperator();
  if (!operator) {
    return { ok: false, message: "Unauthorized." };
  }

  const admin = createAdminClient();
  const { data: booking } = await admin
    .from("bookings")
    .select("id, order_id, branch_id, staff_id, payment_status, amount_paid, metadata, customers(full_name)")
    .eq("id", input.bookingId)
    .maybeSingle();

  if (!booking) {
    return { ok: false, message: "Booking not found." };
  }

  let swappedBookingId: string | null = null;
  let swappedToStaffName: string | null = null;

  // 1. If Domino Auto-Swap is required, atomically reassign the conflicting next booking to the #1 FCFS replacement therapist!
  if (preview.resolution.kind === "domino_auto_swap") {
    const swap = preview.resolution;
    const { data: conflictingRow } = await admin
      .from("bookings")
      .select("id, metadata")
      .eq("id", swap.conflictingBookingId)
      .maybeSingle();

    const conflictMeta =
      conflictingRow?.metadata &&
      typeof conflictingRow.metadata === "object" &&
      !Array.isArray(conflictingRow.metadata)
        ? (conflictingRow.metadata as Record<string, unknown>)
        : {};

    const { error: swapErr } = await admin
      .from("bookings")
      .update({
        staff_id: swap.replacementStaffId,
        metadata: {
          ...conflictMeta,
          domino_reassigned_at: new Date().toISOString(),
          domino_reassigned_by: operator.id,
          domino_reassigned_reason: `Auto-reassigned to accommodate +${preview.extraMinutes}m session extension on prior booking`,
        } as Json,
      })
      .eq("id", swap.conflictingBookingId);

    if (swapErr) {
      return {
        ok: false,
        message: "Could not reassign the overlapping upcoming booking. Please try again.",
      };
    }

    swappedBookingId = swap.conflictingBookingId;
    swappedToStaffName = swap.replacementStaffName;

    // Notify replacement therapist via Web Push
    void createOrUpdateNotification({
      branchId: booking.branch_id,
      targetWorkspace: "staff",
      recipientStaffId: swap.replacementStaffId,
      actorStaffId: operator.id,
      type: "booking_reassigned",
      title: `New Assigned Appointment at ${swap.conflictingStartTime}`,
      body: `You have been assigned ${swap.conflictingCustomerName}'s ${swap.conflictingStartTime} appointment (covering for an extended session).`,
      entityType: "booking",
      entityId: swap.conflictingBookingId,
      actionHref: "/staff-portal/schedule",
      priority: "high",
      requiresAction: false,
      dedupeKey: `domino-swap:${swap.conflictingBookingId}:${Date.now()}`,
    });
  }

  // 2. Update the extended booking's end_time, session_due_at, duration_minutes, price_paid, and payment_status
  const currentMeta =
    booking.metadata && typeof booking.metadata === "object" && !Array.isArray(booking.metadata)
      ? (booking.metadata as Record<string, unknown>)
      : {};
  const existingExtensions = Array.isArray(currentMeta.session_extensions)
    ? currentMeta.session_extensions
    : [];

  const nextPaymentStatus =
    booking.payment_status === "paid" && preview.additionalPrice > 0
      ? "pending"
      : booking.payment_status;

  const updatedMeta: Record<string, unknown> = {
    ...currentMeta,
    duration_minutes: preview.newDurationMinutes,
    price_paid: preview.newTotalPrice,
    session_extensions: [
      ...existingExtensions,
      {
        added_minutes: preview.extraMinutes,
        additional_price: preview.additionalPrice,
        previous_end_time: preview.currentEndTime,
        new_end_time: preview.newEndTime,
        extended_at: new Date().toISOString(),
        extended_by: operator.id,
        swapped_booking_id: swappedBookingId,
      },
    ],
  };

  const { error: updateError } = await admin
    .from("bookings")
    .update({
      end_time: preview.newEndTime,
      ...(preview.newSessionDueAtIso ? { session_due_at: preview.newSessionDueAtIso } : {}),
      payment_status: nextPaymentStatus,
      metadata: updatedMeta as Json,
    })
    .eq("id", booking.id);

  if (updateError) {
    return { ok: false, message: "Could not save session extension." };
  }

  // 3. Synchronize parent booking_orders total_amount & payment_status so Cash Flow & Checkout match 100%!
  if (booking.order_id && preview.additionalPrice > 0) {
    const { data: orderRow } = await admin
      .from("booking_orders")
      .select("id, metadata")
      .eq("id", booking.order_id)
      .maybeSingle();

    if (orderRow) {
      const orderMeta =
        orderRow.metadata &&
        typeof orderRow.metadata === "object" &&
        !Array.isArray(orderRow.metadata)
          ? (orderRow.metadata as Record<string, unknown>)
          : {};
      const oldOrderTotal = Number(orderMeta.total_amount ?? preview.currentPrice);
      const oldSubtotal = Number(orderMeta.subtotal_amount ?? preview.currentPrice);

      await admin
        .from("booking_orders")
        .update({
          metadata: {
            ...orderMeta,
            total_amount: roundPhpPrice(oldOrderTotal + preview.additionalPrice),
            subtotal_amount: roundPhpPrice(oldSubtotal + preview.additionalPrice),
            payment_received: false,
          } as Json,
        })
        .eq("id", orderRow.id);
    }
  }

  // 4. Notify the active therapist via Web Push that their session was extended
  if (booking.staff_id) {
    const custRel = Array.isArray(booking.customers) ? booking.customers[0] : booking.customers;
    const custName = custRel?.full_name ?? "Guest";
    void createOrUpdateNotification({
      branchId: booking.branch_id,
      targetWorkspace: "staff",
      recipientStaffId: booking.staff_id,
      actorStaffId: operator.id,
      type: "booking_status_changed",
      title: `Session Extended +${preview.extraMinutes} min`,
      body: `${custName}'s session has been extended by +${preview.extraMinutes} min (new finish time: ${preview.newEndTime.slice(0, 5)}).`,
      entityType: "booking",
      entityId: booking.id,
      actionHref: "/staff-portal",
      priority: "high",
      requiresAction: false,
      dedupeKey: `session-ext:${booking.id}:${Date.now()}`,
    });
  }

  revalidateOperationalBookingSurfaces();
  revalidatePath("/crm/today");
  revalidatePath("/crm/bookings");
  revalidatePath("/crm/cash-flow");

  return {
    ok: true,
    message: swappedToStaffName
      ? `Extended +${preview.extraMinutes}m (+₱${preview.additionalPrice.toFixed(2)}) and auto-moved next booking to ${swappedToStaffName}!`
      : `Session extended by +${preview.extraMinutes}m (+₱${preview.additionalPrice.toFixed(2)})! Checkout total updated automatically.`,
    newEndTime: preview.newEndTime,
    newSessionDueAtIso: preview.newSessionDueAtIso,
    newDurationMinutes: preview.newDurationMinutes,
    additionalPrice: preview.additionalPrice,
    newTotalPrice: preview.newTotalPrice,
    swappedBookingId,
    swappedToStaffName,
  };
}
