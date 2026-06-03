"use server";

import { createClient } from "@/lib/supabase/server";
import { isDevAuthBypassEnabled } from "@/lib/dev-bypass";
import { updateBookingStatusSchema, editBookingSchema, updateBookingPaymentSchema } from "@/lib/validations/booking";
import { assertSlotAvailable } from "@/lib/engine/availability";
import { isResourceAvailable, autoAssignBookingResource } from "@/lib/engine/resource-availability";
import { computeEndTime } from "@/lib/engine/booking-time";
import { buildBookingSnapshot } from "@/lib/engine/snapshot";
import { revalidateOperationalBookingSurfaces } from "@/lib/bookings/revalidate-booking-surfaces";
import type { Database } from "@/types/supabase";
import { canCancelBooking, canReassignBooking } from "@/lib/permissions";
import { createNotification, resolveNotificationsForEntity } from "@/lib/notifications/create";
import { getNotificationTargetPath } from "@/lib/notifications/notification-targets";
import { logError, logBusinessEvent } from "@/lib/logger";

// ── Auth helper ────────────────────────────────────────────────────────────
async function getOperationsContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  if (isDevAuthBypassEnabled()) {
    return { supabase, me: { id: "dev", branch_id: "dev", system_role: "owner" } };
  }

  const { data: me } = await supabase
    .from("staff")
    .select("id, branch_id, system_role")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  const allowedRoles = ["owner", "manager", "assistant_manager", "store_manager", "crm", "csr", "csr_head", "csr_staff"];
  if (!me || !me.branch_id || !allowedRoles.includes(me.system_role)) return null;
  return { supabase, me };
}

// ── Status transition ──────────────────────────────────────────────────────
export async function updateBookingStatusAction(rawInput: unknown) {
  const parsed = updateBookingStatusSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const ctx = await getOperationsContext();
  if (!ctx) return { success: false, error: "Unauthorized" };
  const { supabase, me } = ctx;

  // CSR Staff cannot cancel bookings — only CSR Head+ can
  if (parsed.data.status === "cancelled" && !canCancelBooking(me.system_role)) {
    return { success: false, error: "You do not have permission to cancel bookings" };
  }

  // Set attribution for trigger (fire-and-forget — non-critical).
  // set_config is a Postgres built-in, not in generated Supabase types — cast required.
  try {
    await (supabase as unknown as { rpc: (fn: string, args: Record<string, unknown>) => Promise<unknown> })
      .rpc("set_config", { setting: "app.current_staff_id", value: me.id, is_local: true });
  } catch {
    // Non-critical: trigger attribution may not run, booking update proceeds
  }

  const updates: Database["public"]["Tables"]["bookings"]["Update"] = {
    status: parsed.data.status,
  };

  // ── Auto-assign room on confirmation ────────────────────────────────────
  if (parsed.data.status === "confirmed") {
    // 1. Fetch current booking details
    const { data: booking } = await supabase
      .from("bookings")
      .select("branch_id, booking_date, start_time, end_time, type, delivery_type, resource_id")
      .eq("id", parsed.data.bookingId)
      .eq("branch_id", me.branch_id)
      .single();

    if (booking && booking.delivery_type !== "home_service" && !booking.resource_id) {
      const assignedResourceId = await autoAssignBookingResource({
        branchId: booking.branch_id,
        date: booking.booking_date,
        startTime: booking.start_time,
        endTime: booking.end_time,
      });

      if (!assignedResourceId) {
        return {
          success: false,
          error:
            "No room/bed is available for this time. Please assign a space manually or choose another time.",
        };
      }
      updates.resource_id = assignedResourceId;
    }
  }

  // Fetch booking before updating so we have staff_id + date
  const _statusBeforeQ = supabase
    .from("bookings")
    .select("staff_id, branch_id, booking_date, start_time")
    .eq("id", parsed.data.bookingId);
  const { data: bookingBefore } = await (
    me.branch_id !== "dev" ? _statusBeforeQ.eq("branch_id", me.branch_id) : _statusBeforeQ
  ).single();

  const _statusUpdateQ = supabase
    .from("bookings")
    .update(updates)
    .eq("id", parsed.data.bookingId);
  const { error } = await (
    me.branch_id !== "dev" ? _statusUpdateQ.eq("branch_id", me.branch_id) : _statusUpdateQ
  );

  if (error) {
    logError("booking.status.change_failed", {
      action: "booking.status.update",
      bookingId: parsed.data.bookingId,
      nextStatus: parsed.data.status,
      actorId: me.id,
      workspace: me.system_role,
      error,
    });
    return { success: false, error: error.message };
  }

  logBusinessEvent("booking.status.changed", {
    bookingId: parsed.data.bookingId,
    branchId: me.branch_id,
    actorId: me.id,
    workspace: me.system_role,
    nextStatus: parsed.data.status,
  });

  // Notify the assigned therapist on cancel or customer_arrived
  if (bookingBefore?.staff_id) {
    const status = parsed.data.status;
    if (status === "cancelled") {
      const sameDay = bookingBefore.booking_date === new Date().toISOString().split("T")[0];
      await createNotification({
        branchId: bookingBefore.branch_id,
        targetWorkspace: "staff",
        recipientStaffId: bookingBefore.staff_id,
        type: "booking_cancelled",
        title: "Booking cancelled",
        body: `Your booking on ${bookingBefore.booking_date} at ${bookingBefore.start_time} has been cancelled.`,
        entityType: "booking",
        entityId: parsed.data.bookingId,
        actionHref: getNotificationTargetPath({ workspace: "staff-portal", entityType: "booking", entityId: parsed.data.bookingId }),
        priority: sameDay ? "high" : "normal",
        requiresAction: sameDay,
      });
      await resolveNotificationsForEntity(
        "booking",
        parsed.data.bookingId,
        "staff",
        "booking_assigned"
      );
      await resolveNotificationsForEntity(
        "booking",
        parsed.data.bookingId,
        "staff",
        "home_service_assigned"
      );
    }
    if (status === "confirmed") {
      await createNotification({
        branchId: bookingBefore.branch_id,
        targetWorkspace: "staff",
        recipientStaffId: bookingBefore.staff_id,
        type: "customer_arrived",
        title: "Customer has arrived",
        body: `Your customer is ready for their session on ${bookingBefore.booking_date} at ${bookingBefore.start_time}.`,
        entityType: "booking",
        entityId: parsed.data.bookingId,
        actionHref: getNotificationTargetPath({ workspace: "staff-portal", entityType: "booking", entityId: parsed.data.bookingId }),
        priority: "high",
        requiresAction: true,
      });
    }
  }

  revalidateOperationalBookingSurfaces(me.branch_id);
  return { success: true };
}

// ── Edit booking (reschedule, change therapist, etc.) ────────────────────
export async function editBookingAction(rawInput: unknown) {
  const parsed = editBookingSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const ctx = await getOperationsContext();
  if (!ctx) return { success: false, error: "Unauthorized" };
  const { supabase, me } = ctx;

  const { bookingId, notes, ...changes } = parsed.data;

  // CSR Staff cannot reassign therapists — only CSR Head+ can
  if (changes.staffId && !canReassignBooking(me.system_role)) {
    return { success: false, error: "You do not have permission to reassign therapists" };
  }

  // Fetch current booking to fill in unchanged fields for validation
  const _editCurrentQ = supabase
    .from("bookings")
    .select("*")
    .eq("id", bookingId);
  const { data: current } = await (
    me.branch_id !== "dev" ? _editCurrentQ.eq("branch_id", me.branch_id) : _editCurrentQ
  ).single();

  if (!current) return { success: false, error: "Booking not found" };

  const resolvedServiceId = changes.serviceId ?? current.service_id;
  const resolvedStaffId = changes.staffId ?? current.staff_id;
  const resolvedDate = changes.date ?? current.booking_date;
  const resolvedStartTime = changes.startTime ?? current.start_time;
  const resolvedResourceId =
    changes.resourceId !== undefined ? changes.resourceId : current.resource_id;

  const updates: Database["public"]["Tables"]["bookings"]["Update"] = {};

  // If time, staff, service OR resource changed — verify availability
  if (
    changes.staffId ||
    changes.date ||
    changes.startTime ||
    changes.serviceId ||
    changes.resourceId !== undefined
  ) {
    // 1. Staff availability check
    if (changes.staffId || changes.date || changes.startTime || changes.serviceId) {
      try {
        await assertSlotAvailable({
          branchId: current.branch_id,
          serviceId: resolvedServiceId,
          staffId: resolvedStaffId,
          date: resolvedDate,
          startTime: resolvedStartTime,
        });
      } catch {
        return { success: false, error: "That time slot is no longer available" };
      }

      updates.end_time = await computeEndTime(resolvedStartTime, resolvedServiceId);
      if (changes.staffId) updates.staff_id = changes.staffId;
      if (changes.serviceId) updates.service_id = changes.serviceId;
      if (changes.date) updates.booking_date = changes.date;
      if (changes.startTime) updates.start_time = changes.startTime;
    }

    // 2. Resource availability check
    if (
      resolvedResourceId &&
      (changes.resourceId !== undefined ||
        changes.date ||
        changes.startTime ||
        changes.serviceId)
    ) {
      const isAvailable = await isResourceAvailable({
        resourceId: resolvedResourceId,
        date: resolvedDate,
        startTime: resolvedStartTime,
        endTime:
          updates.end_time ??
          (await computeEndTime(resolvedStartTime, resolvedServiceId)),
        excludeBookingId: bookingId,
      });
      if (!isAvailable) {
        return {
          success: false,
          error: "The selected room/bed is already booked for this time.",
        };
      }
    }

    if (changes.resourceId !== undefined) {
      updates.resource_id = changes.resourceId;
    }

    // Re-snapshot if service changed
    if (changes.serviceId) {
      const existing = (current.metadata ?? {}) as Record<string, unknown>;
      const nextMetadata: Record<string, unknown> = {
        ...existing,
        ...(await buildBookingSnapshot(me.branch_id, resolvedServiceId)),
        customer_notes: existing["customer_notes"] ?? null,
      };
      updates.metadata =
        nextMetadata as Database["public"]["Tables"]["bookings"]["Update"]["metadata"];
    }
  }

  if (changes.type !== undefined) {
    updates.type = changes.type;
  }

  if (changes.deliveryType !== undefined) {
    updates.delivery_type = changes.deliveryType;
    updates.travel_buffer_mins =
      changes.deliveryType === "home_service"
        ? (changes.travelBufferMins ?? 30)
        : null;
  }

  if (changes.travelBufferMins !== undefined && changes.deliveryType === undefined) {
    updates.travel_buffer_mins = changes.travelBufferMins;
  }

  if (notes !== undefined) {
    const existing = ((updates.metadata ?? current.metadata ?? {}) as Record<string, unknown>);
    updates.metadata = {
      ...existing,
      customer_notes: notes,
    } as Database["public"]["Tables"]["bookings"]["Update"]["metadata"];
  }

  // Set attribution so trigger writes changed_by to booking_events (fire-and-forget — non-critical).
  // set_config is a Postgres built-in, not in generated Supabase types — cast required.
  try {
    await (supabase as unknown as { rpc: (fn: string, args: Record<string, unknown>) => Promise<unknown> })
      .rpc("set_config", { setting: "app.current_staff_id", value: me.id, is_local: true });
  } catch {
    // Non-critical: trigger attribution may not run, booking update proceeds
  }

  const _editUpdateQ = supabase
    .from("bookings")
    .update(updates)
    .eq("id", bookingId);
  const { error } = await (
    me.branch_id !== "dev" ? _editUpdateQ.eq("branch_id", me.branch_id) : _editUpdateQ
  );

  if (error) return { success: false, error: error.message };

  // Notify newly assigned therapist if staff changed
  if (changes.staffId && changes.staffId !== current.staff_id) {
    const newDate = changes.date ?? current.booking_date;
    const newTime = changes.startTime ?? current.start_time;
    const isHS = (changes.deliveryType ?? current.delivery_type ?? current.type) === "home_service";
    await resolveNotificationsForEntity("booking", bookingId, "staff", "booking_assigned");
    await resolveNotificationsForEntity("booking", bookingId, "staff", "home_service_assigned");
    await createNotification({
      branchId: current.branch_id,
      targetWorkspace: "staff",
      recipientStaffId: changes.staffId,
      type: isHS ? "home_service_assigned" : "booking_assigned",
      title: isHS ? "Home Service booking assigned" : "Booking assigned to you",
      body: `You have been assigned a booking on ${newDate} at ${newTime}.`,
      entityType: "booking",
      entityId: bookingId,
      actionHref: getNotificationTargetPath({ workspace: "staff-portal", entityType: "booking", entityId: bookingId }),
      priority: isHS ? "high" : "normal",
      requiresAction: isHS,
    });
  }

  // Notify existing therapist of reschedule (if date/time changed, staff unchanged)
  if ((changes.date || changes.startTime) && !changes.staffId && current.staff_id) {
    const newDate = changes.date ?? current.booking_date;
    const newTime = changes.startTime ?? current.start_time;
    await createNotification({
      branchId: current.branch_id,
      targetWorkspace: "staff",
      recipientStaffId: current.staff_id,
      type: "booking_rescheduled",
      title: "Booking time changed",
      body: `Your booking has been rescheduled to ${newDate} at ${newTime}.`,
      entityType: "booking",
      entityId: bookingId,
      actionHref: getNotificationTargetPath({ workspace: "staff-portal", entityType: "booking", entityId: bookingId }),
      priority: "high",
      requiresAction: true,
    });
  }

  revalidateOperationalBookingSurfaces(me.branch_id);
  return { success: true };
}

// ── Update booking payment (method, status, amount, reference) ────────────
// Intentionally separate from booking status — paying does not complete the service.
// Appends an audit row to booking_payment_logs before updating.
export async function updateBookingPaymentAction(rawInput: unknown) {
  const parsed = updateBookingPaymentSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const ctx = await getOperationsContext();
  if (!ctx) return { success: false, error: "Unauthorized" };
  const { supabase, me } = ctx;

  const { bookingId, paymentMethod, paymentStatus, amountPaid, paymentReference, reason } = parsed.data;

  // Fetch current payment state for audit log
  const _paymentBeforeQ = supabase
    .from("bookings")
    .select("branch_id, payment_method, payment_status, amount_paid, payment_reference")
    .eq("id", bookingId);
  const { data: before } = await (
    me.branch_id !== "dev" ? _paymentBeforeQ.eq("branch_id", me.branch_id) : _paymentBeforeQ
  ).single();

  const isSignificantChange =
    (before?.payment_status === "paid" && paymentStatus !== "paid") ||
    ((before?.amount_paid ?? 0) > amountPaid);

  if (isSignificantChange && !reason?.trim()) {
    return { success: false, error: "Reason is required for voids, refunds, or corrections" };
  }

  // Insert audit log
  await supabase.from("booking_payment_logs").insert({
    booking_id:            bookingId,
    changed_by:            me.id === "dev" ? null : me.id,
    old_payment_method:    before?.payment_method ?? null,
    old_payment_status:    before?.payment_status ?? null,
    old_amount_paid:       before?.amount_paid ?? null,
    old_payment_reference: before?.payment_reference ?? null,
    new_payment_method:    paymentMethod,
    new_payment_status:    paymentStatus,
    new_amount_paid:       amountPaid,
    new_payment_reference: paymentReference ?? null,
    reason:                reason?.trim() ?? null,
  });

  const _paymentUpdateQ = supabase
    .from("bookings")
    .update({
      payment_method:    paymentMethod,
      payment_status:    paymentStatus,
      amount_paid:       amountPaid,
      payment_reference: paymentReference ?? null,
    })
    .eq("id", bookingId);
  const { error } = await (
    me.branch_id !== "dev" ? _paymentUpdateQ.eq("branch_id", me.branch_id) : _paymentUpdateQ
  );

  if (error) return { success: false, error: error.message };

  const needsPaymentFollowUp =
    paymentStatus === "unpaid" ||
    paymentStatus === "pending" ||
    paymentMethod === "pay_on_site";

  if (paymentStatus === "paid" || paymentStatus === "refunded" || !needsPaymentFollowUp) {
    await resolveNotificationsForEntity("booking", bookingId, "crm", "payment_pending");
  } else {
    await createNotification({
      branchId: before?.branch_id ?? me.branch_id,
      targetWorkspace: "crm",
      type: "payment_pending",
      title: "Payment needs follow-up",
      body: "A booking payment is unpaid or pending confirmation.",
      entityType: "booking",
      entityId: bookingId,
      actionHref: getNotificationTargetPath({ workspace: "crm", entityType: "booking", entityId: bookingId }),
      priority: "normal",
      requiresAction: true,
    });
  }

  revalidateOperationalBookingSurfaces(me.branch_id);
  return { success: true };
}
