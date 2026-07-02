"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDevBypassLayoutStaff, isDevAuthBypassEnabled } from "@/lib/dev-bypass";
import { confirmBookingPaymentSchema } from "@/lib/validations/booking";
import { bookingBlocksAvailability } from "@/lib/bookings/hold-status";
import { createNotification, resolveNotificationsForEntity } from "@/lib/notifications/create";
import { getNotificationTargetPath } from "@/lib/notifications/notification-targets";
import { autoAssignBookingResource, isResourceAvailable } from "@/lib/engine/resource-availability";
import type { Database } from "@/types/supabase";
import { revalidateOperationalBookingSurfaces } from "@/lib/bookings/revalidate-booking-surfaces";
import { revalidatePath } from "next/cache";
import { logError } from "@/lib/logger";
import { z } from "zod";
import { canonicalizeSystemRole } from "@/constants/staff";
import { canAccessCrmWorkspace } from "@/lib/auth/crm-permissions";
import { recordBookingPaymentChange } from "@/lib/bookings/payment-transaction";

const DEV_BYPASS_STAFF_ID = "00000000-0000-0000-0000-000000000000";

// Staff-portal paths to refresh after service lifecycle changes
const STAFF_PORTAL_PATHS = [
  "/staff-portal",
  "/staff-portal/today",
  "/staff-portal/schedule",
  "/staff-portal/week",
] as const;

function revalidateServiceSurfaces(branchId: string): void {
  revalidateOperationalBookingSurfaces(branchId);
  for (const path of STAFF_PORTAL_PATHS) {
    revalidatePath(path);
  }
}

async function getCrmActionsContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
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

const CONFIRMABLE_STATUSES = new Set(["pending_payment", "pending_crm_confirmation", "pending"]);
const CLOSED_BOOKING_STATUSES = new Set(["completed", "cancelled", "no_show"]);

const bookingIdSchema = z.object({
  bookingId: z.guid("Invalid booking ID"),
});

const markBookingConfirmedSchema = bookingIdSchema.extend({
  note: z.string().max(500).optional(),
});

const recordBookingFollowupSchema = bookingIdSchema.extend({
  result: z.enum(["no_answer", "reschedule", "confirm_later"]),
  note: z.string().max(500).optional(),
  followUpAt: z.string().max(100).optional(),
});

const assignBookingRoomSchema = bookingIdSchema.extend({
  resourceId: z.guid("Invalid room ID"),
});

type CrmActionContext = NonNullable<Awaited<ReturnType<typeof getCrmActionsContext>>>;
type CrmBookingActionRow = {
  id: string;
  branch_id: string;
  booking_date: string;
  start_time: string;
  end_time: string | null;
  type: string | null;
  delivery_type: string | null;
  status: string;
  booking_progress_status: string | null;
  checked_in_at?: string | null;
  resource_id: string | null;
  metadata: Database["public"]["Tables"]["bookings"]["Row"]["metadata"] | null;
  customers?: { full_name: string | null } | { full_name: string | null }[] | null;
  services?: { name: string | null } | { name: string | null }[] | null;
  branches?: { name: string | null } | { name: string | null }[] | null;
};

export type RoomAssignmentResourceOption = {
  id: string;
  name: string;
  type: string | null;
  capacity: number | null;
  isAvailable: boolean;
  isCurrent: boolean;
  isRecommended: boolean;
  reason: string;
};

export type RoomAssignmentOptionsResult =
  | {
      success: true;
      notApplicable?: false;
      booking: {
        id: string;
        customerName: string;
        serviceName: string;
        bookingDate: string;
        startTime: string;
        endTime: string | null;
        branchName: string;
      };
      resources: RoomAssignmentResourceOption[];
      currentResourceId: string | null;
      recommendedResourceId: string | null;
      setupWarning?: string | null;
    }
  | {
      success: true;
      notApplicable: true;
      message: string;
      booking?: {
        id: string;
        customerName: string;
        serviceName: string;
        bookingDate: string;
        startTime: string;
        endTime: string | null;
        branchName: string;
      };
      resources: [];
      currentResourceId: null;
      recommendedResourceId: null;
      setupWarning?: string | null;
    }
  | { success: false; error: string };

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function isHomeServiceBooking(booking: { type?: string | null; delivery_type?: string | null }): boolean {
  return booking.delivery_type === "home_service" || booking.type === "home_service";
}

function canAccessBookingBranch(ctx: CrmActionContext, branchId: string): boolean {
  return ctx.me.system_role === "owner" || ctx.me.branch_id === branchId;
}

function normalizeProgress(status: string | null | undefined): string {
  return status || "not_started";
}

function withFollowupMetadata(
  metadata: CrmBookingActionRow["metadata"],
  input: {
    result: string;
    note?: string;
    followUpAt?: string;
    actorId: string | null;
  }
): Database["public"]["Tables"]["bookings"]["Update"]["metadata"] {
  const current =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : {};

  return {
    ...current,
    crm_followup: {
      result: input.result,
      note: input.note?.trim() || null,
      follow_up_at: input.followUpAt?.trim() || null,
      updated_at: new Date().toISOString(),
      updated_by: input.actorId,
    },
  } as Database["public"]["Tables"]["bookings"]["Update"]["metadata"];
}

async function loadCrmBookingForAction(
  ctx: CrmActionContext,
  bookingId: string
): Promise<CrmBookingActionRow | null> {
  const { data, error } = await ctx.supabase
    .from("bookings")
    .select(
      `
        id, branch_id, booking_date, start_time, end_time, type, delivery_type,
        status, booking_progress_status, checked_in_at, resource_id, metadata,
        customers ( full_name ),
        services ( name ),
        branches ( name )
      `
    )
    .eq("id", bookingId)
    .maybeSingle();

  if (error || !data) return null;
  const booking = data as unknown as CrmBookingActionRow;
  if (!canAccessBookingBranch(ctx, booking.branch_id)) return null;
  return booking;
}

function buildRoomBookingSummary(booking: CrmBookingActionRow) {
  return {
    id: booking.id,
    customerName: firstRelation(booking.customers)?.full_name ?? "Customer",
    serviceName: firstRelation(booking.services)?.name ?? "Service",
    bookingDate: booking.booking_date,
    startTime: booking.start_time,
    endTime: booking.end_time,
    branchName: firstRelation(booking.branches)?.name ?? "Branch",
  };
}

export async function markBookingConfirmedAction(rawInput: unknown): Promise<{ success: boolean; error?: string }> {
  const parsed = markBookingConfirmedSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const ctx = await getCrmActionsContext();
  if (!ctx) return { success: false, error: "Unauthorized" };

  const booking = await loadCrmBookingForAction(ctx, parsed.data.bookingId);
  if (!booking) return { success: false, error: "Booking not found" };
  if (CLOSED_BOOKING_STATUSES.has(booking.status)) {
    return { success: false, error: "This booking can no longer be confirmed." };
  }
  if (booking.status !== "confirmed" && !CONFIRMABLE_STATUSES.has(booking.status)) {
    return { success: false, error: `Booking cannot be confirmed from status "${booking.status}".` };
  }

  const currentProgress = normalizeProgress(booking.booking_progress_status);
  const updatePayload: Database["public"]["Tables"]["bookings"]["Update"] = {
    status: "confirmed",
  };

  if (currentProgress === "not_started") {
    updatePayload.booking_progress_status = "not_started";
  }

  if (parsed.data.note?.trim()) {
    updatePayload.metadata = withFollowupMetadata(booking.metadata, {
      result: "confirmed",
      note: parsed.data.note,
      actorId: ctx.me.id === DEV_BYPASS_STAFF_ID ? null : ctx.me.id,
    });
  }

  const admin = createAdminClient();
  const { data: updatedRows, error } = await admin
    .from("bookings")
    .update(updatePayload)
    .eq("id", booking.id)
    .eq("branch_id", booking.branch_id)
    .select("id");

  if (error) return { success: false, error: error.message };
  if (!updatedRows || updatedRows.length === 0) {
    return { success: false, error: "Booking could not be confirmed. You may not have permission to update it." };
  }

  revalidateOperationalBookingSurfaces(booking.branch_id);
  return { success: true };
}

export async function recordBookingFollowupAction(rawInput: unknown): Promise<{ success: boolean; error?: string }> {
  const parsed = recordBookingFollowupSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const ctx = await getCrmActionsContext();
  if (!ctx) return { success: false, error: "Unauthorized" };

  const booking = await loadCrmBookingForAction(ctx, parsed.data.bookingId);
  if (!booking) return { success: false, error: "Booking not found" };
  if (CLOSED_BOOKING_STATUSES.has(booking.status)) {
    return { success: false, error: "This booking can no longer be updated." };
  }

  const admin = createAdminClient();
  const { data: updatedRows, error } = await admin
    .from("bookings")
    .update({
      metadata: withFollowupMetadata(booking.metadata, {
        result: parsed.data.result,
        note: parsed.data.note,
        followUpAt: parsed.data.followUpAt,
        actorId: ctx.me.id === DEV_BYPASS_STAFF_ID ? null : ctx.me.id,
      }),
    })
    .eq("id", booking.id)
    .eq("branch_id", booking.branch_id)
    .select("id");

  if (error) return { success: false, error: error.message };
  if (!updatedRows || updatedRows.length === 0) {
    return { success: false, error: "Follow-up result could not be saved." };
  }

  revalidateOperationalBookingSurfaces(booking.branch_id);
  return { success: true };
}

export async function markBookingArrivedAction(rawInput: unknown): Promise<{ success: boolean; error?: string }> {
  const parsed = bookingIdSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const ctx = await getCrmActionsContext();
  if (!ctx) return { success: false, error: "Unauthorized" };

  const booking = await loadCrmBookingForAction(ctx, parsed.data.bookingId);
  if (!booking) return { success: false, error: "Booking not found" };
  if (CLOSED_BOOKING_STATUSES.has(booking.status)) {
    return { success: false, error: "This booking can no longer be marked arrived." };
  }
  if (isHomeServiceBooking(booking)) {
    return { success: false, error: "Customer arrival is only used for in-spa bookings." };
  }

  const currentProgress = normalizeProgress(booking.booking_progress_status);
  if (currentProgress === "checked_in") {
    revalidateOperationalBookingSurfaces(booking.branch_id);
    return { success: true };
  }
  if (currentProgress !== "not_started") {
    return { success: false, error: "This booking is already past arrival." };
  }

  const now = new Date().toISOString();
  const admin = createAdminClient();
  const { data: updatedRows, error } = await admin
    .from("bookings")
    .update({
      booking_progress_status: "checked_in",
      checked_in_at: now,
    })
    .eq("id", booking.id)
    .eq("branch_id", booking.branch_id)
    .select("id");

  if (error) return { success: false, error: error.message };
  if (!updatedRows || updatedRows.length === 0) {
    return { success: false, error: "Booking could not be marked arrived." };
  }

  revalidateOperationalBookingSurfaces(booking.branch_id);
  return { success: true };
}

export async function getRoomAssignmentOptionsAction(rawInput: unknown): Promise<RoomAssignmentOptionsResult> {
  const parsed = bookingIdSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const ctx = await getCrmActionsContext();
  if (!ctx) return { success: false, error: "Unauthorized" };

  const booking = await loadCrmBookingForAction(ctx, parsed.data.bookingId);
  if (!booking) return { success: false, error: "Booking not found" };

  const summary = buildRoomBookingSummary(booking);

  if (isHomeServiceBooking(booking)) {
    return {
      success: true,
      notApplicable: true,
      message: "Room assignment does not apply to home-service bookings.",
      booking: summary,
      resources: [],
      currentResourceId: null,
      recommendedResourceId: null,
    };
  }

  const admin = createAdminClient();
  const { data: resources, error: resourcesError } = await admin
    .from("branch_resources")
    .select("id, name, type, capacity, is_active")
    .eq("branch_id", booking.branch_id)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (resourcesError) return { success: false, error: resourcesError.message };

  const activeResources = resources ?? [];
  const recommendedResourceId =
    activeResources.length === 0
      ? null
      : await autoAssignBookingResource({
          branchId: booking.branch_id,
          date: booking.booking_date,
          startTime: booking.start_time,
          endTime: booking.end_time ?? booking.start_time,
          excludeBookingId: booking.id,
        });

  const resourceOptions: RoomAssignmentResourceOption[] = [];
  for (const resource of activeResources) {
    const available = await isResourceAvailable({
      resourceId: resource.id,
      date: booking.booking_date,
      startTime: booking.start_time,
      endTime: booking.end_time ?? booking.start_time,
      excludeBookingId: booking.id,
    });

    const isCurrent = resource.id === booking.resource_id;
    const isRecommended = resource.id === recommendedResourceId;
    resourceOptions.push({
      id: resource.id,
      name: resource.name,
      type: resource.type ?? null,
      capacity: resource.capacity ?? null,
      isAvailable: available || isCurrent,
      isCurrent,
      isRecommended,
      reason: available || isCurrent ? "Available for this time" : "Unavailable for this time",
    });
  }

  return {
    success: true,
    booking: summary,
    resources: resourceOptions,
    currentResourceId: booking.resource_id,
    recommendedResourceId,
    setupWarning:
      activeResources.length === 0
        ? "No active rooms are set up for this branch."
        : null,
  };
}

export async function assignBookingRoomAction(rawInput: unknown): Promise<{ success: boolean; error?: string }> {
  const parsed = assignBookingRoomSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const ctx = await getCrmActionsContext();
  if (!ctx) return { success: false, error: "Unauthorized" };

  const booking = await loadCrmBookingForAction(ctx, parsed.data.bookingId);
  if (!booking) return { success: false, error: "Booking not found" };
  if (CLOSED_BOOKING_STATUSES.has(booking.status)) {
    return { success: false, error: "This booking can no longer be assigned a room." };
  }
  if (isHomeServiceBooking(booking)) {
    return { success: false, error: "Room assignment does not apply to home-service bookings." };
  }

  const admin = createAdminClient();
  const { data: resource, error: resourceError } = await admin
    .from("branch_resources")
    .select("id, branch_id, is_active")
    .eq("id", parsed.data.resourceId)
    .maybeSingle();

  if (resourceError) return { success: false, error: resourceError.message };
  if (!resource || resource.branch_id !== booking.branch_id || !resource.is_active) {
    return { success: false, error: "Selected room is not available for this branch." };
  }

  const available = await isResourceAvailable({
    resourceId: resource.id,
    date: booking.booking_date,
    startTime: booking.start_time,
    endTime: booking.end_time ?? booking.start_time,
    excludeBookingId: booking.id,
  });

  if (!available) {
    return { success: false, error: "The selected room is no longer available for this time." };
  }

  const { data: updatedRows, error } = await admin
    .from("bookings")
    .update({ resource_id: resource.id })
    .eq("id", booking.id)
    .eq("branch_id", booking.branch_id)
    .select("id");

  if (error) return { success: false, error: error.message };
  if (!updatedRows || updatedRows.length === 0) {
    return { success: false, error: "Room could not be assigned. You may not have permission to update this booking." };
  }

  revalidateOperationalBookingSurfaces(booking.branch_id);
  return { success: true };
}

export async function confirmBookingPaymentAction(rawInput: unknown): Promise<{ success: boolean; error?: string }> {
  const parsed = confirmBookingPaymentSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const ctx = await getCrmActionsContext();
  if (!ctx) return { success: false, error: "Unauthorized" };
  const { supabase, me } = ctx;

  const { bookingId, paymentMethod, paymentReference, amountPaid, note } = parsed.data;

  // Load booking — try with hold_expires_at first, fall back if column absent
  type BookingRow = {
    id: string;
    branch_id: string;
    status: string;
    hold_expires_at: string | null;
    staff_id: string | null;
    customer_id: string | null;
    booking_date: string;
    start_time: string;
    end_time: string | null;
    delivery_type: string | null;
    type: string;
    payment_method: string | null;
    payment_status: string | null;
    amount_paid: number | null;
    payment_reference: string | null;
  };

  let booking: BookingRow | null = null;

  const { data: fullBooking, error: fetchErr } = await supabase
    .from("bookings")
    .select(
      "id, branch_id, status, hold_expires_at, staff_id, customer_id, booking_date, start_time, end_time, delivery_type, type, payment_method, payment_status, amount_paid, payment_reference"
    )
    .eq("id", bookingId)
    .maybeSingle();

  if (!fetchErr) {
    booking = fullBooking as BookingRow | null;
  } else if (fetchErr.code === "42703") {
    // hold_expires_at not yet present — retry without it
    const { data: fallback } = await supabase
      .from("bookings")
      .select(
        "id, branch_id, status, staff_id, customer_id, booking_date, start_time, end_time, delivery_type, type, payment_method, payment_status, amount_paid, payment_reference"
      )
      .eq("id", bookingId)
      .maybeSingle();
    if (fallback) booking = { ...(fallback as Omit<BookingRow, "hold_expires_at">), hold_expires_at: null };
  }

  if (!booking) return { success: false, error: "Booking not found" };

  // Fetch customer name for the staff notification — best-effort, never blocks the action
  let customerName = "the customer";
  try {
    if (booking.customer_id) {
      const { data: cust } = await supabase
        .from("customers")
        .select("full_name")
        .eq("id", booking.customer_id)
        .maybeSingle();
      if (cust?.full_name) customerName = cust.full_name;
    }
  } catch { /* non-critical — fall back to generic label */ }

  // Branch guard (owner bypasses)
  if (me.system_role !== "owner" && booking.branch_id !== me.branch_id) {
    return { success: false, error: "Booking not found" };
  }

  // Status check
  if (!CONFIRMABLE_STATUSES.has(booking.status)) {
    return { success: false, error: `Booking cannot be confirmed from status "${booking.status}"` };
  }

  // Expired hold → check for staff conflicts before allowing confirmation
  const now = new Date();
  const holdActive =
    booking.hold_expires_at !== null &&
    Number.isFinite(new Date(booking.hold_expires_at).getTime()) &&
    new Date(booking.hold_expires_at).getTime() > now.getTime();

  if (!holdActive && booking.staff_id) {
    const { data: candidates } = await supabase
      .from("bookings")
      .select("id, status, hold_expires_at, start_time, end_time")
      .eq("staff_id", booking.staff_id)
      .eq("booking_date", booking.booking_date)
      .neq("id", bookingId);

    if (candidates && candidates.length > 0) {
      const bStart = new Date(`${booking.booking_date}T${booking.start_time}`).getTime();
      const bEnd = booking.end_time
        ? new Date(`${booking.booking_date}T${booking.end_time}`).getTime()
        : bStart + 60 * 60 * 1000;

      const hasConflict = candidates.some((c) => {
        if (!bookingBlocksAvailability(c, now)) return false;
        const cStart = new Date(`${booking.booking_date}T${c.start_time}`).getTime();
        const cEnd = c.end_time
          ? new Date(`${booking.booking_date}T${c.end_time}`).getTime()
          : cStart + 60 * 60 * 1000;
        return cStart < bEnd && cEnd > bStart;
      });

      if (hasConflict) {
        return {
          success: false,
          error: "This time slot is no longer available. Please reschedule the booking before confirming.",
        };
      }
    }
  }

  const paymentResult = await recordBookingPaymentChange(supabase, {
    bookingId,
    branchId: me.system_role === "owner" ? null : booking.branch_id,
    paymentMethod,
    paymentStatus: "paid",
    amountPaid: amountPaid ?? booking.amount_paid ?? 0,
    paymentReference,
    reason: note?.trim() || "CRM payment confirmation",
    changedByStaffId: me.id === DEV_BYPASS_STAFF_ID ? null : me.id,
    nextStatus: "confirmed",
    clearHold: true,
  });

  if (!paymentResult.ok) {
    return {
      success: false,
      error: paymentResult.error,
    };
  }

  // Notify assigned staff (only after confirmed — payment confirmed before notifying)
  if (booking.staff_id) {
    const isHS = booking.delivery_type === "home_service" || booking.type === "home_service";
    await createNotification({
      branchId:         booking.branch_id,
      targetWorkspace:  "staff",
      recipientStaffId: booking.staff_id,
      type:             isHS ? "home_service_assigned" : "booking_assigned",
      title:            isHS ? `Home Service booking confirmed — ${customerName}` : `Booking confirmed — ${customerName}`,
      body:             `${customerName}'s ${isHS ? "Home Service " : ""}booking on ${booking.booking_date} at ${booking.start_time} has been confirmed and assigned to you.`,
      entityType:       "booking",
      entityId:         bookingId,
      actionHref:       getNotificationTargetPath({
        workspace:  "staff-portal",
        entityType: "booking",
        entityId:   bookingId,
      }),
      priority:       isHS ? "high" : "normal",
      requiresAction: isHS,
      dedupeKey:      `booking:${bookingId}:staff_assignment_confirmed`,
    });
  }

  // Resolve CRM payment_pending notification
  await resolveNotificationsForEntity("booking", bookingId, "crm", "payment_pending");

  revalidateOperationalBookingSurfaces(booking.branch_id);
  return { success: true };
}

// ── CRM Service Start ────────────────────────────────────────────────────────
// Calls the update_booking_progress RPC to atomically set:
//   booking_progress_status = 'session_started'
//   session_started_at = now()
//   status = 'in_progress'
// This is the correct way for CRM to start a service session.
export async function crmStartServiceAction(
  rawInput: unknown
): Promise<{ success: boolean; error?: string }> {
  const parsed = bookingIdSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid booking ID" };
  }

  const ctx = await getCrmActionsContext();
  if (!ctx) return { success: false, error: "Unauthorized" };

  const booking = await loadCrmBookingForAction(ctx, parsed.data.bookingId);
  if (!booking) return { success: false, error: "Booking not found" };

  if (CLOSED_BOOKING_STATUSES.has(booking.status)) {
    return { success: false, error: "This booking is already closed." };
  }

  if (isHomeServiceBooking(booking)) {
    return { success: false, error: "Home-service sessions are started by the assigned staff." };
  }

  // Idempotent: fully started (both fields + timestamp set) → return success
  if (
    (booking.booking_progress_status === "session_started" || booking.status === "in_progress")
    && (booking as { session_started_at?: string | null }).session_started_at
  ) {
    return { success: true };
  }

  // Use a direct update instead of the RPC so this works regardless of whether
  // the direct-start migration (20260603000001) has been applied to the DB.
  // All three fields are written atomically in one UPDATE statement.
  const now = new Date().toISOString();
  const admin = createAdminClient();
  const { data: updatedRows, error } = await admin
    .from("bookings")
    .update({
      status:                   "in_progress",
      booking_progress_status:  "session_started",
      session_started_at:       now,
    })
    .eq("id", parsed.data.bookingId)
    .eq("branch_id", booking.branch_id)
    .select("id");

  if (error) {
    logError("crm.start_service_failed", { bookingId: parsed.data.bookingId, error });
    return { success: false, error: error.message };
  }
  if (!updatedRows || updatedRows.length === 0) {
    return { success: false, error: "Booking could not be started. You may not have permission." };
  }

  revalidateServiceSurfaces(booking.branch_id);
  return { success: true };
}

// ── CRM Service Complete ─────────────────────────────────────────────────────
// Calls the update_booking_progress RPC to atomically set:
//   booking_progress_status = 'completed'
//   session_completed_at = now()
//   status = 'completed'
// This is the correct way for CRM to complete a service session.
export async function crmCompleteServiceAction(
  rawInput: unknown
): Promise<{ success: boolean; error?: string }> {
  const parsed = bookingIdSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid booking ID" };
  }

  const ctx = await getCrmActionsContext();
  if (!ctx) return { success: false, error: "Unauthorized" };

  const booking = await loadCrmBookingForAction(ctx, parsed.data.bookingId);
  if (!booking) return { success: false, error: "Booking not found" };

  // Idempotent: already completed → return success
  if (booking.status === "completed" || booking.booking_progress_status === "completed") {
    return { success: true };
  }

  if (booking.status === "cancelled" || booking.status === "no_show") {
    return { success: false, error: "This booking is already closed." };
  }

  // Direct update — reliable regardless of booking_progress_status current value.
  const now = new Date().toISOString();
  const admin = createAdminClient();
  const { data: updatedRows, error } = await admin
    .from("bookings")
    .update({
      status:                   "completed",
      booking_progress_status:  "completed",
      session_completed_at:     now,
    })
    .eq("id", parsed.data.bookingId)
    .eq("branch_id", booking.branch_id)
    .select("id");

  if (error) {
    logError("crm.complete_service_failed", { bookingId: parsed.data.bookingId, error });
    return { success: false, error: error.message };
  }
  if (!updatedRows || updatedRows.length === 0) {
    return { success: false, error: "Booking could not be completed. You may not have permission." };
  }

  revalidateServiceSurfaces(booking.branch_id);
  return { success: true };
}
