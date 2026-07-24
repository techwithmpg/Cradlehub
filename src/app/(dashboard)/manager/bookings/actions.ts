"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDevBypassLayoutStaff, isDevAuthBypassEnabled } from "@/lib/dev-bypass";
import {
  updateBookingStatusSchema,
  editBookingSchema,
  updateBookingPaymentSchema,
} from "@/lib/validations/booking";
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
import { canonicalizeSystemRole } from "@/constants/staff";
import { canAccessCrmWorkspace } from "@/lib/auth/crm-permissions";
import { recordBookingPaymentChange } from "@/lib/bookings/payment-transaction";
import { getBookingPaymentGate } from "@/lib/bookings/payment-gate";

const DEV_BYPASS_STAFF_ID = "00000000-0000-0000-0000-000000000000";

// ── Auth helper ────────────────────────────────────────────────────────────
async function getOperationsContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  if (isDevAuthBypassEnabled()) {
    const mock = getDevBypassLayoutStaff();
    return {
      supabase,
      me: {
        id: DEV_BYPASS_STAFF_ID,
        branch_id: mock.branch_id,
        system_role: mock.system_role,
      },
    };
  }

  const { data: me } = await supabase
    .from("staff")
    .select("id, branch_id, system_role")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  const role = me ? canonicalizeSystemRole(me.system_role) : null;
  if (!me || !me.branch_id || !role || !canAccessCrmWorkspace(role)) return null;
  return { supabase, me: { ...me, system_role: role } };
}

// ── Status transition ──────────────────────────────────────────────────────
function withStatusActionMetadata(
  metadata: Database["public"]["Tables"]["bookings"]["Row"]["metadata"] | null,
  input: {
    actorId: string | null;
    note?: string;
    status: string;
  }
): Database["public"]["Tables"]["bookings"]["Update"]["metadata"] {
  const current =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : {};
  const note = input.note?.trim() || null;
  const updatedAt = new Date().toISOString();

  return {
    ...current,
    crm_status_update: {
      note,
      status: input.status,
      updated_at: updatedAt,
      updated_by: input.actorId,
    },
    ...(input.status === "cancelled"
      ? {
          cancellation: {
            reason: note,
            cancelled_at: updatedAt,
            cancelled_by: input.actorId,
            source: "crm",
          },
        }
      : {}),
  } as Database["public"]["Tables"]["bookings"]["Update"]["metadata"];
}

async function annotateLatestBookingEvent(params: {
  actorId: string | null;
  admin: ReturnType<typeof createAdminClient>;
  bookingId: string;
  note?: string;
  previousStatus?: string | null;
  nextStatus: string;
}) {
  if (params.previousStatus === params.nextStatus) return;

  const { data: eventRow } = await params.admin
    .from("booking_events")
    .select("id")
    .eq("booking_id", params.bookingId)
    .eq("to_status", params.nextStatus)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!eventRow) return;

  await params.admin
    .from("booking_events")
    .update({
      changed_by: params.actorId,
      notes: params.note?.trim() || null,
    })
    .eq("id", eventRow.id);
}

export async function updateBookingStatusAction(rawInput: unknown) {
  const parsed = updateBookingStatusSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const ctx = await getOperationsContext();
  if (!ctx) return { success: false, error: "Unauthorized" };
  const { supabase, me } = ctx;

  if (parsed.data.status === "cancelled" && !canCancelBooking(me.system_role)) {
    return { success: false, error: "You do not have permission to cancel bookings" };
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
    .select("staff_id, branch_id, booking_date, start_time, status, metadata")
    .eq("id", parsed.data.bookingId);
  const { data: bookingBefore } = await (
    me.system_role !== "owner" ? _statusBeforeQ.eq("branch_id", me.branch_id) : _statusBeforeQ
  ).single();

  if (!bookingBefore) {
    return { success: false, error: "Booking not found" };
  }

  const statusNote = parsed.data.notes?.trim() || undefined;
  if (statusNote) {
    updates.metadata = withStatusActionMetadata(bookingBefore.metadata, {
      actorId: me.id === DEV_BYPASS_STAFF_ID ? null : me.id,
      note: statusNote,
      status: parsed.data.status,
    });
  }

  const admin = createAdminClient();
  const _statusUpdateQ = admin.from("bookings").update(updates).eq("id", parsed.data.bookingId);
  const { data: updatedRows, error } = await (
    me.system_role !== "owner" ? _statusUpdateQ.eq("branch_id", me.branch_id) : _statusUpdateQ
  ).select("id, branch_id");

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
  const updatedBooking = updatedRows?.[0] ?? null;
  if (!updatedBooking) {
    return {
      success: false,
      error:
        "Booking status could not be updated. It may belong to another branch or no longer exist.",
    };
  }

  logBusinessEvent("booking.status.changed", {
    bookingId: parsed.data.bookingId,
    branchId: updatedBooking.branch_id,
    actorId: me.id,
    workspace: me.system_role,
    nextStatus: parsed.data.status,
  });

  await annotateLatestBookingEvent({
    actorId: me.id === DEV_BYPASS_STAFF_ID ? null : me.id,
    admin,
    bookingId: parsed.data.bookingId,
    note: statusNote,
    previousStatus: bookingBefore.status,
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
        actionHref: getNotificationTargetPath({
          workspace: "staff-portal",
          entityType: "booking",
          entityId: parsed.data.bookingId,
        }),
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
        actionHref: getNotificationTargetPath({
          workspace: "staff-portal",
          entityType: "booking",
          entityId: parsed.data.bookingId,
        }),
        priority: "high",
        requiresAction: true,
      });
    }
  }

  revalidateOperationalBookingSurfaces(updatedBooking.branch_id);
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

  if (changes.staffId && !canReassignBooking(me.system_role)) {
    return { success: false, error: "You do not have permission to reassign therapists" };
  }

  // Fetch current booking to fill in unchanged fields for validation
  const _editCurrentQ = supabase.from("bookings").select("*").eq("id", bookingId);
  const { data: current } = await (
    me.system_role !== "owner" ? _editCurrentQ.eq("branch_id", me.branch_id) : _editCurrentQ
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
      (changes.resourceId !== undefined || changes.date || changes.startTime || changes.serviceId)
    ) {
      const isAvailable = await isResourceAvailable({
        resourceId: resolvedResourceId,
        date: resolvedDate,
        startTime: resolvedStartTime,
        endTime: updates.end_time ?? (await computeEndTime(resolvedStartTime, resolvedServiceId)),
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
      changes.deliveryType === "home_service" ? (changes.travelBufferMins ?? 30) : null;
  }

  if (changes.travelBufferMins !== undefined && changes.deliveryType === undefined) {
    updates.travel_buffer_mins = changes.travelBufferMins;
  }

  if (notes !== undefined) {
    const existing = (updates.metadata ?? current.metadata ?? {}) as Record<string, unknown>;
    updates.metadata = {
      ...existing,
      customer_notes: notes,
    } as Database["public"]["Tables"]["bookings"]["Update"]["metadata"];
  }

  // Set attribution so trigger writes changed_by to booking_events (fire-and-forget — non-critical).
  // set_config is a Postgres built-in, not in generated Supabase types — cast required.
  if (me.id !== DEV_BYPASS_STAFF_ID) {
    try {
      await (
        supabase as unknown as {
          rpc: (fn: string, args: Record<string, unknown>) => Promise<unknown>;
        }
      ).rpc("set_config", { setting: "app.current_staff_id", value: me.id, is_local: true });
    } catch {
      // Non-critical: trigger attribution may not run, booking update proceeds
    }
  }

  const _editUpdateQ = supabase.from("bookings").update(updates).eq("id", bookingId);
  const { data: updatedRows, error } = await (
    me.system_role !== "owner" ? _editUpdateQ.eq("branch_id", me.branch_id) : _editUpdateQ
  ).select("id, branch_id");

  if (error) return { success: false, error: error.message };
  const updatedBooking = updatedRows?.[0] ?? null;
  if (!updatedBooking) {
    return {
      success: false,
      error: "Booking could not be updated. It may belong to another branch or no longer exist.",
    };
  }

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
      actionHref: getNotificationTargetPath({
        workspace: "staff-portal",
        entityType: "booking",
        entityId: bookingId,
      }),
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
      actionHref: getNotificationTargetPath({
        workspace: "staff-portal",
        entityType: "booking",
        entityId: bookingId,
      }),
      priority: "high",
      requiresAction: true,
    });
  }

  revalidateOperationalBookingSurfaces(updatedBooking.branch_id);
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

  const {
    bookingId,
    paymentMethod,
    paymentStatus,
    amountPaid,
    paymentReference,
    paymentPurpose,
    reason,
  } = parsed.data;

  // Fetch current payment state for audit log
  const _paymentBeforeQ = supabase
    .from("bookings")
    .select(
      "branch_id, status, booking_progress_status, session_completed_at, payment_method, payment_status, amount_paid, payment_reference"
    )
    .eq("id", bookingId);
  const { data: before } = await (
    me.system_role !== "owner" ? _paymentBeforeQ.eq("branch_id", me.branch_id) : _paymentBeforeQ
  ).single();

  if (!before) {
    return { success: false, error: "Booking not found" };
  }

  const paymentGate = getBookingPaymentGate({
    bookingStatus: before.status,
    bookingProgressStatus: before.booking_progress_status,
    sessionCompletedAt: before.session_completed_at,
    previousAmountPaid: Number(before.amount_paid ?? 0),
    nextAmountPaid: amountPaid,
    nextPaymentStatus: paymentStatus,
    paymentPurpose,
    reason,
  });
  if (!paymentGate.allowed) {
    return { success: false, error: paymentGate.error };
  }

  const isSignificantChange =
    (before?.payment_status === "paid" && paymentStatus !== "paid") ||
    (before?.amount_paid ?? 0) > amountPaid;

  if (isSignificantChange && !reason?.trim()) {
    return { success: false, error: "Reason is required for voids, refunds, or corrections" };
  }

  const paymentResult = await recordBookingPaymentChange(supabase, {
    bookingId,
    branchId: me.system_role === "owner" ? null : me.branch_id,
    paymentMethod,
    paymentStatus,
    amountPaid,
    paymentReference,
    reason:
      paymentPurpose && paymentPurpose !== "final_settlement"
        ? `[${paymentPurpose}] ${reason?.trim() ?? ""}`.trim()
        : reason,
    changedByStaffId: me.id === DEV_BYPASS_STAFF_ID ? null : me.id,
  });

  if (!paymentResult.ok) return { success: false, error: paymentResult.error };

  const needsPaymentFollowUp =
    paymentStatus === "unpaid" || paymentStatus === "pending" || paymentMethod === "pay_on_site";

  if (paymentStatus === "paid" || paymentStatus === "refunded" || !needsPaymentFollowUp) {
    await resolveNotificationsForEntity("booking", bookingId, "crm", "payment_pending");
  } else {
    await createNotification({
      branchId: paymentResult.booking.branch_id,
      targetWorkspace: "crm",
      type: "payment_pending",
      title: "Payment needs follow-up",
      body: "A booking payment is unpaid or pending confirmation.",
      entityType: "booking",
      entityId: bookingId,
      actionHref: getNotificationTargetPath({
        workspace: "crm",
        entityType: "booking",
        entityId: bookingId,
      }),
      priority: "normal",
      requiresAction: true,
    });
  }

  revalidateOperationalBookingSurfaces(paymentResult.booking.branch_id);
  return { success: true };
}
