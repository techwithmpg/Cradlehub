"use server";

import { createClient } from "@/lib/supabase/server";
import { isDevAuthBypassEnabled } from "@/lib/dev-bypass";
import { updateBookingStatusSchema, editBookingSchema, updateBookingPaymentSchema } from "@/lib/validations/booking";
import { assertSlotAvailable } from "@/lib/engine/availability";
import { isResourceAvailable, autoAssignBookingResource } from "@/lib/engine/resource-availability";
import { computeEndTime } from "@/lib/engine/booking-time";
import { buildBookingSnapshot } from "@/lib/engine/snapshot";
import { revalidatePath } from "next/cache";
import type { Database } from "@/types/supabase";
import { canCancelBooking, canReassignBooking } from "@/lib/permissions";

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

  const allowedRoles = [
    "owner",
    "manager",
    "assistant_manager",
    "store_manager",
    "crm",
    "csr",
    "csr_head",
    "csr_staff",
  ];
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

  // Set attribution for trigger
  await (
    supabase as unknown as {
      rpc: (fn: string, args: Record<string, unknown>) => Promise<unknown>;
    }
  )
    .rpc("set_config", {
      setting: "app.current_staff_id",
      value: me.id,
      is_local: true,
    })
    .catch(() => {});

  const updates: Database["public"]["Tables"]["bookings"]["Update"] = {
    status: parsed.data.status,
  };

  // ── Auto-assign room on confirmation ────────────────────────────────────
  if (parsed.data.status === "confirmed") {
    // 1. Fetch current booking details
    const { data: booking } = await supabase
      .from("bookings")
      .select("branch_id, booking_date, start_time, end_time, type, resource_id")
      .eq("id", parsed.data.bookingId)
      .single();

    if (booking && booking.type !== "home_service" && !booking.resource_id) {
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

  const { error } = await supabase
    .from("bookings")
    .update(updates)
    .eq("id", parsed.data.bookingId)
    .eq("branch_id", me.branch_id); // RLS-equivalent guard

  if (error) return { success: false, error: error.message };

  revalidatePath("/manager");
  revalidatePath("/manager/bookings");
  revalidatePath("/crm");
  revalidatePath("/crm/bookings");
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
  const { data: current } = await supabase
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .eq("branch_id", me.branch_id)
    .single();

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
          branchId: me.branch_id,
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
    updates.travel_buffer_mins =
      changes.type === "home_service"
        ? (changes.travelBufferMins ?? 30)
        : null;
  }

  if (changes.travelBufferMins !== undefined && changes.type === undefined) {
    updates.travel_buffer_mins = changes.travelBufferMins;
  }

  if (notes !== undefined) {
    const existing = ((updates.metadata ?? current.metadata ?? {}) as Record<string, unknown>);
    updates.metadata = {
      ...existing,
      customer_notes: notes,
    } as Database["public"]["Tables"]["bookings"]["Update"]["metadata"];
  }

  // Set attribution so trigger writes changed_by to booking_events
  await (
    supabase as unknown as {
      rpc: (fn: string, args: Record<string, unknown>) => Promise<unknown>;
    }
  )
    .rpc("set_config", {
      setting:  "app.current_staff_id",
      value:    me.id,
      is_local: true,
    })
    .catch(() => {});

  const { error } = await supabase
    .from("bookings")
    .update(updates)
    .eq("id", bookingId)
    .eq("branch_id", me.branch_id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/manager");
  revalidatePath("/manager/bookings");
  revalidatePath("/crm");
  revalidatePath("/crm/bookings");
  return { success: true };
}

// ── Update booking payment (method, status, amount, reference) ────────────
// Intentionally separate from booking status — paying does not complete the service.
export async function updateBookingPaymentAction(rawInput: unknown) {
  const parsed = updateBookingPaymentSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const ctx = await getOperationsContext();
  if (!ctx) return { success: false, error: "Unauthorized" };
  const { supabase, me } = ctx;

  const { bookingId, paymentMethod, paymentStatus, amountPaid, paymentReference } = parsed.data;

  const { error } = await supabase
    .from("bookings")
    .update({
      payment_method:    paymentMethod,
      payment_status:    paymentStatus,
      amount_paid:       amountPaid,
      payment_reference: paymentReference ?? null,
    })
    .eq("id", bookingId)
    .eq("branch_id", me.branch_id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/manager");
  revalidatePath("/manager/bookings");
  revalidatePath("/crm");
  revalidatePath("/crm/bookings");
  return { success: true };
}
