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
import { canReassignBooking } from "@/lib/permissions";
import { buildRecommendationContext } from "@/lib/queries/assignment-recommendations";
import { scoreTherapistCandidates } from "@/lib/assignments/recommendation-engine";
import { computeEndTime } from "@/lib/engine/booking-time";
import {
  getOpenStaffScheduleException,
  resolveStaffScheduleExceptionMetadata,
} from "@/lib/bookings/staff-schedule-exception";
import { resolveStaffScheduleExceptionSignals } from "@/lib/bookings/staff-schedule-exception-signals";

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
  result: z.enum(["no_answer", "reschedule", "confirm_later", "cancel"]),
  note: z.string().max(500).optional(),
  followUpAt: z.string().max(100).optional(),
});

const rescheduleBookingSchema = bookingIdSchema.extend({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid booking date"),
  startTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Invalid start time"),
  note: z.string().max(500).optional(),
  homeServiceAddress: z.string().max(1000).optional(),
  homeServiceAccessNote: z.string().max(500).optional(),
});

const resolveStaffScheduleExceptionSchema = bookingIdSchema.extend({
  resolution: z.enum(["kept_selected_staff", "marked_resolved"]),
});

const assignBookingRoomSchema = bookingIdSchema.extend({
  resourceId: z.guid("Invalid room ID"),
});

const assignBookingTherapistSchema = bookingIdSchema.extend({
  staffId: z.guid("Invalid staff ID"),
  overrideReason: z.enum([
    "customer_requested",
    "therapist_on_break",
    "manager_decision",
    "skill_or_service_mismatch",
    "workload_balance",
    "other",
  ]).optional(),
});

const prepareHomeServiceDispatchSchema = bookingIdSchema.extend({
  releaseNow: z.boolean().optional(),
  note: z.string().max(500).optional(),
});

type CrmActionContext = NonNullable<Awaited<ReturnType<typeof getCrmActionsContext>>>;
type CrmBookingActionRow = {
  id: string;
  branch_id: string;
  service_id: string | null;
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
  staff_id?: string | null;
  driver_id?: string | null;
  customers?: { full_name: string | null } | { full_name: string | null }[] | null;
  services?: { name: string | null } | { name: string | null }[] | null;
  staff?: { id: string; full_name: string | null } | { id: string; full_name: string | null }[] | null;
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

function withRescheduleMetadata(
  metadata: CrmBookingActionRow["metadata"],
  input: {
    actorId: string | null;
    fromDate: string;
    fromTime: string;
    note?: string;
    toDate: string;
    toTime: string;
    homeServiceAddress?: string;
    homeServiceAccessNote?: string;
  }
): Database["public"]["Tables"]["bookings"]["Update"]["metadata"] {
  const current =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : {};
  const updatedAt = new Date().toISOString();
  const entry = {
    from_date: input.fromDate,
    from_time: input.fromTime,
    to_date: input.toDate,
    to_time: input.toTime,
    note: input.note?.trim() || null,
    home_service_address: input.homeServiceAddress?.trim() || null,
    home_service_access_note: input.homeServiceAccessNote?.trim() || null,
    updated_at: updatedAt,
    updated_by: input.actorId,
  };
  const history = Array.isArray(current.crm_reschedule_history)
    ? current.crm_reschedule_history.slice(-19)
    : [];

  const currentAddressRaw = current.home_service_address;
  const currentAddress =
    currentAddressRaw && typeof currentAddressRaw === "object" && !Array.isArray(currentAddressRaw)
      ? (currentAddressRaw as Record<string, unknown>)
      : {};
  const shouldUpdateHomeAddress =
    input.homeServiceAddress !== undefined || input.homeServiceAccessNote !== undefined;

  return {
    ...current,
    ...(shouldUpdateHomeAddress
      ? {
          home_service_address: {
            ...currentAddress,
            ...(input.homeServiceAddress !== undefined
              ? { full_address: input.homeServiceAddress.trim() }
              : {}),
            ...(input.homeServiceAccessNote !== undefined
              ? { access_note: input.homeServiceAccessNote.trim() }
              : {}),
            updated_by: input.actorId,
            updated_at: updatedAt,
            source: "crm_reschedule",
          },
        }
      : {}),
    crm_reschedule: entry,
    crm_reschedule_history: [...history, entry],
  } as Database["public"]["Tables"]["bookings"]["Update"]["metadata"];
}

function followupResultLabel(result: string): string {
  if (result === "no_answer") return "No Answer";
  if (result === "reschedule") return "Reschedule";
  if (result === "confirm_later") return "Confirm Later";
  if (result === "cancel") return "Cancel";
  if (result === "confirmed") return "Confirmed";
  if (result === "rescheduled") return "Rescheduled";
  if (result === "staff_reassigned") return "Staff Reassigned";
  return result;
}

function auditPrefixForResult(result: string): string {
  return result === "rescheduled" || result === "staff_reassigned"
    ? "CRM action"
    : "CRM follow-up";
}

function normalizeActionTime(value: string): string {
  return value.length === 5 ? `${value}:00` : value;
}

function shortTime(value: string): string {
  return value.slice(0, 5);
}

async function insertBookingAuditEvent(params: {
  actorId: string | null;
  admin: ReturnType<typeof createAdminClient>;
  bookingId: string;
  fromStatus: string | null;
  note?: string;
  result: string;
  toStatus: string;
}) {
  const trimmedNote = params.note?.trim();
  const prefix = auditPrefixForResult(params.result);
  const auditNote = trimmedNote
    ? `${prefix}: ${followupResultLabel(params.result)}. ${trimmedNote}`
    : `${prefix}: ${followupResultLabel(params.result)}.`;

  await params.admin.from("booking_events").insert({
    booking_id: params.bookingId,
    changed_by: params.actorId,
    from_status: params.fromStatus,
    to_status: params.toStatus,
    notes: auditNote,
  });
}

async function annotateLatestBookingEvent(params: {
  actorId: string | null;
  admin: ReturnType<typeof createAdminClient>;
  bookingId: string;
  note?: string;
  previousStatus: string;
  result: string;
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

  const trimmedNote = params.note?.trim();
  const prefix = auditPrefixForResult(params.result);
  await params.admin
    .from("booking_events")
    .update({
      changed_by: params.actorId,
      notes: trimmedNote
        ? `${prefix}: ${followupResultLabel(params.result)}. ${trimmedNote}`
        : `${prefix}: ${followupResultLabel(params.result)}.`,
    })
    .eq("id", eventRow.id);
}

async function loadCrmBookingForAction(
  ctx: CrmActionContext,
  bookingId: string
): Promise<CrmBookingActionRow | null> {
  const { data, error } = await ctx.supabase
    .from("bookings")
    .select(
      `
        id, branch_id, service_id, booking_date, start_time, end_time, type, delivery_type, staff_id, driver_id,
        status, booking_progress_status, checked_in_at, resource_id, metadata,
        customers ( full_name ),
        services ( name ),
        staff ( id, full_name ),
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

  await annotateLatestBookingEvent({
    actorId: ctx.me.id === DEV_BYPASS_STAFF_ID ? null : ctx.me.id,
    admin,
    bookingId: booking.id,
    note: parsed.data.note,
    previousStatus: booking.status,
    result: "confirmed",
    nextStatus: "confirmed",
  });

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

  const actorId = ctx.me.id === DEV_BYPASS_STAFF_ID ? null : ctx.me.id;
  const nextStatus = parsed.data.result === "cancel" ? "cancelled" : booking.status;
  const admin = createAdminClient();
  const { data: updatedRows, error } = await admin
    .from("bookings")
    .update({
      status: nextStatus,
      metadata: withFollowupMetadata(booking.metadata, {
        result: parsed.data.result,
        note: parsed.data.note,
        followUpAt: parsed.data.followUpAt,
        actorId,
      }),
    })
    .eq("id", booking.id)
    .eq("branch_id", booking.branch_id)
    .select("id");

  if (error) return { success: false, error: error.message };
  if (!updatedRows || updatedRows.length === 0) {
    return { success: false, error: "Follow-up result could not be saved." };
  }

  if (nextStatus === booking.status) {
    await insertBookingAuditEvent({
      actorId,
      admin,
      bookingId: booking.id,
      fromStatus: booking.status,
      note: parsed.data.note,
      result: parsed.data.result,
      toStatus: booking.status,
    });
  } else {
    await annotateLatestBookingEvent({
      actorId,
      admin,
      bookingId: booking.id,
      note: parsed.data.note,
      previousStatus: booking.status,
      result: parsed.data.result,
      nextStatus,
    });
  }

  revalidateOperationalBookingSurfaces(booking.branch_id);
  return { success: true };
}

export async function rescheduleBookingAction(rawInput: unknown): Promise<{ success: boolean; error?: string }> {
  const parsed = rescheduleBookingSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const ctx = await getCrmActionsContext();
  if (!ctx) return { success: false, error: "Unauthorized" };

  const booking = await loadCrmBookingForAction(ctx, parsed.data.bookingId);
  if (!booking) return { success: false, error: "Booking not found" };
  if (CLOSED_BOOKING_STATUSES.has(booking.status) || booking.booking_progress_status === "completed") {
    return { success: false, error: "This booking can no longer be rescheduled." };
  }
  if (booking.status === "in_progress" || booking.booking_progress_status === "session_started") {
    return { success: false, error: "This booking has already started." };
  }
  if (!booking.service_id) {
    return { success: false, error: "This booking has no service to validate against." };
  }

  const nextDate = parsed.data.date;
  const nextStartTime = normalizeActionTime(parsed.data.startTime);
  const currentStartTime = normalizeActionTime(booking.start_time);
  const scheduleChanged =
    booking.booking_date !== nextDate || shortTime(currentStartTime) !== shortTime(nextStartTime);

  const currentMetadata =
    booking.metadata && typeof booking.metadata === "object" && !Array.isArray(booking.metadata)
      ? (booking.metadata as Record<string, unknown>)
      : {};
  const currentHomeAddressRaw = currentMetadata.home_service_address;
  const currentHomeAddress =
    currentHomeAddressRaw && typeof currentHomeAddressRaw === "object" && !Array.isArray(currentHomeAddressRaw)
      ? (currentHomeAddressRaw as Record<string, unknown>)
      : {};
  const currentAddress =
    typeof currentHomeAddress.full_address === "string" ? currentHomeAddress.full_address : "";
  const currentAccessNote =
    typeof currentHomeAddress.access_note === "string" ? currentHomeAddress.access_note : "";
  const nextAddress = parsed.data.homeServiceAddress?.trim();
  const nextAccessNote = parsed.data.homeServiceAccessNote?.trim();
  const addressChanged =
    isHomeServiceBooking(booking) &&
    ((nextAddress !== undefined && nextAddress !== currentAddress) ||
      (nextAccessNote !== undefined && nextAccessNote !== currentAccessNote));

  if (!scheduleChanged && !addressChanged) {
    return { success: false, error: "Choose a new date, time, or home-service address before saving." };
  }

  let nextEndTime: string;
  try {
    nextEndTime = await computeEndTime(nextStartTime, booking.service_id);
  } catch {
    return { success: false, error: "Could not calculate the new booking end time." };
  }

  const recommendationContext = await buildRecommendationContext(booking.id, {
    booking_date: nextDate,
    start_time: nextStartTime,
    end_time: nextEndTime,
  });
  if (!recommendationContext) {
    return { success: false, error: "Could not verify staff availability for the new time." };
  }

  const scoredCandidates = scoreTherapistCandidates(recommendationContext);
  if (booking.staff_id) {
    const currentTherapist = scoredCandidates.find((candidate) => candidate.staffId === booking.staff_id);
    if (!currentTherapist || currentTherapist.status === "unavailable") {
      return {
        success: false,
        error: currentTherapist?.warnings[0] ?? "Assigned therapist is not available at the new time.",
      };
    }
  } else if (!scoredCandidates.some((candidate) => candidate.status !== "unavailable")) {
    return { success: false, error: "No therapist is available at the new time." };
  }

  if (booking.resource_id && !isHomeServiceBooking(booking)) {
    const resourceAvailable = await isResourceAvailable({
      resourceId: booking.resource_id,
      date: nextDate,
      startTime: nextStartTime,
      endTime: nextEndTime,
      excludeBookingId: booking.id,
    });
    if (!resourceAvailable) {
      return { success: false, error: "The assigned room is not available at the new time." };
    }
  }

  const actorId = ctx.me.id === DEV_BYPASS_STAFF_ID ? null : ctx.me.id;
  const openScheduleException = getOpenStaffScheduleException(currentMetadata);
  const rescheduleMetadata = withRescheduleMetadata(booking.metadata, {
    actorId,
    fromDate: booking.booking_date,
    fromTime: currentStartTime,
    note: parsed.data.note,
    toDate: nextDate,
    toTime: nextStartTime,
    homeServiceAddress: isHomeServiceBooking(booking) ? nextAddress : undefined,
    homeServiceAccessNote: isHomeServiceBooking(booking) ? nextAccessNote : undefined,
  });
  const nextMetadata =
    scheduleChanged && openScheduleException
      ? resolveStaffScheduleExceptionMetadata(
          rescheduleMetadata as Record<string, unknown>,
          {
            resolution: "rescheduled_booking",
            resolvedAt: new Date().toISOString(),
            resolvedByStaffId: actorId,
          }
        )
      : rescheduleMetadata;
  const admin = createAdminClient();
  const { data: updatedRows, error } = await admin
    .from("bookings")
    .update({
      booking_date: nextDate,
      start_time: nextStartTime,
      end_time: nextEndTime,
      metadata: nextMetadata as Database["public"]["Tables"]["bookings"]["Update"]["metadata"],
    })
    .eq("id", booking.id)
    .eq("branch_id", booking.branch_id)
    .select("id");

  if (error) return { success: false, error: error.message };
  if (!updatedRows || updatedRows.length === 0) {
    return { success: false, error: "Booking could not be rescheduled. You may not have permission." };
  }

  const auditNote = [
    scheduleChanged
      ? `Rescheduled from ${booking.booking_date} ${shortTime(currentStartTime)} to ${nextDate} ${shortTime(nextStartTime)}.`
      : null,
    addressChanged ? "Home-service address updated." : null,
    parsed.data.note?.trim() || null,
  ].filter(Boolean).join(" ");
  await insertBookingAuditEvent({
    actorId,
    admin,
    bookingId: booking.id,
    fromStatus: booking.status,
    note: auditNote,
    result: "rescheduled",
    toStatus: booking.status,
  });

  if (booking.staff_id) {
    await createNotification({
      branchId: booking.branch_id,
      targetWorkspace: "staff",
      recipientStaffId: booking.staff_id,
      type: "booking_rescheduled",
      title: "Booking time changed",
      body: `Your booking has been rescheduled to ${nextDate} at ${shortTime(nextStartTime)}.`,
      entityType: "booking",
      entityId: booking.id,
      actionHref: getNotificationTargetPath({ workspace: "staff-portal", entityType: "booking", entityId: booking.id }),
      priority: "high",
      requiresAction: true,
    });
  }

  if (scheduleChanged && openScheduleException) {
    await resolveStaffScheduleExceptionSignals({
      bookingId: booking.id,
      branchId: booking.branch_id,
      staffId: openScheduleException.selectedStaffId,
      reasonCode: openScheduleException.reasonCode,
      completedByStaffId: actorId,
    });
  }

  revalidateOperationalBookingSurfaces(booking.branch_id);
  return { success: true };
}

export async function resolveStaffScheduleExceptionAction(
  rawInput: unknown
): Promise<{ success: boolean; error?: string }> {
  const parsed = resolveStaffScheduleExceptionSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const ctx = await getCrmActionsContext();
  if (!ctx) return { success: false, error: "Unauthorized" };

  const booking = await loadCrmBookingForAction(ctx, parsed.data.bookingId);
  if (!booking) return { success: false, error: "Booking not found" };
  const currentMetadata =
    booking.metadata && typeof booking.metadata === "object" && !Array.isArray(booking.metadata)
      ? (booking.metadata as Record<string, unknown>)
      : {};
  const scheduleException = getOpenStaffScheduleException(currentMetadata);
  if (!scheduleException) return { success: true };

  const actorId = ctx.me.id === DEV_BYPASS_STAFF_ID ? null : ctx.me.id;
  const nextMetadata = resolveStaffScheduleExceptionMetadata(currentMetadata, {
    resolution: parsed.data.resolution,
    resolvedAt: new Date().toISOString(),
    resolvedByStaffId: actorId,
  });
  const admin = createAdminClient();
  const { data: updatedRows, error } = await admin
    .from("bookings")
    .update({
      metadata: nextMetadata as Database["public"]["Tables"]["bookings"]["Update"]["metadata"],
    })
    .eq("id", booking.id)
    .eq("branch_id", booking.branch_id)
    .select("id");

  if (error) return { success: false, error: error.message };
  if (!updatedRows || updatedRows.length === 0) {
    return { success: false, error: "Staff review could not be resolved." };
  }

  const resolutionLabel =
    parsed.data.resolution === "kept_selected_staff"
      ? "kept selected staff"
      : "marked resolved";
  await insertBookingAuditEvent({
    actorId,
    admin,
    bookingId: booking.id,
    fromStatus: booking.status,
    note: `Resolved staff schedule exception (${resolutionLabel}). Original reason: ${scheduleException.reasonLabel}.`,
    result: "staff_schedule_exception_resolved",
    toStatus: booking.status,
  });
  await resolveStaffScheduleExceptionSignals({
    bookingId: booking.id,
    branchId: booking.branch_id,
    staffId: scheduleException.selectedStaffId,
    reasonCode: scheduleException.reasonCode,
    completedByStaffId: actorId,
  });

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
export async function assignBookingTherapistAction(
  rawInput: unknown
): Promise<{ success: boolean; error?: string }> {
  const parsed = assignBookingTherapistSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const ctx = await getCrmActionsContext();
  if (!ctx) return { success: false, error: "Unauthorized" };

  if (!canReassignBooking(ctx.me.system_role)) {
    return { success: false, error: "You do not have permission to reassign therapists" };
  }

  const booking = await loadCrmBookingForAction(ctx, parsed.data.bookingId);
  if (!booking) return { success: false, error: "Booking not found" };
  if (CLOSED_BOOKING_STATUSES.has(booking.status)) {
    return { success: false, error: "This booking is already closed." };
  }

  const admin = createAdminClient();

  // Verify staff exists, is active, and belongs to the booking branch
  const { data: staff, error: staffError } = await admin
    .from("staff")
    .select("id, branch_id, full_name, is_active, staff_type, system_role")
    .eq("id", parsed.data.staffId)
    .maybeSingle();

  if (staffError) return { success: false, error: staffError.message };
  if (!staff || !staff.is_active || staff.branch_id !== booking.branch_id) {
    return { success: false, error: "Selected therapist is not available for this branch." };
  }

  const recommendationContext = await buildRecommendationContext(booking.id);
  if (!recommendationContext) {
    return { success: false, error: "Could not verify staff availability for this booking." };
  }
  const candidate = scoreTherapistCandidates(recommendationContext).find(
    (item) => item.staffId === parsed.data.staffId
  );
  if (!candidate) {
    return { success: false, error: "Selected therapist is not qualified for this service." };
  }
  if (candidate.status === "unavailable") {
    const reason = candidate.warnings[0] ?? "Selected therapist is not available at this time.";
    return { success: false, error: reason };
  }

  const previousStaffId = booking.staff_id ?? null;
  const previousStaffName = firstRelation(booking.staff)?.full_name ?? "Unassigned";
  const nextStaffName = staff.full_name ?? "Selected therapist";
  const now = new Date().toISOString();
  const openScheduleException = getOpenStaffScheduleException(
    booking.metadata && typeof booking.metadata === "object" && !Array.isArray(booking.metadata)
      ? (booking.metadata as Record<string, unknown>)
      : {}
  );
  const actorId = ctx.me.id === DEV_BYPASS_STAFF_ID ? null : ctx.me.id;

  // Build metadata audit entry
  const metadata = booking.metadata ?? {};
  const assignmentAudit = Array.isArray((metadata as Record<string, unknown>).assignment_audit)
    ? [...((metadata as Record<string, unknown>).assignment_audit as unknown[])]
    : [];
  assignmentAudit.push({
    staff_id: parsed.data.staffId,
    previous_staff_id: previousStaffId,
    reason: parsed.data.overrideReason ?? "recommendation_top_pick",
    assigned_at: now,
    assigned_by: actorId,
    source: "assignment_assistant",
  });

  const assignmentMetadata = {
    ...(metadata as Record<string, unknown>),
    assignment_audit: assignmentAudit,
  };
  const nextMetadata =
    openScheduleException && parsed.data.staffId !== previousStaffId
      ? resolveStaffScheduleExceptionMetadata(assignmentMetadata, {
          resolution: "reassigned_staff",
          resolvedAt: now,
          resolvedByStaffId: actorId,
          previousStaffId,
          newStaffId: parsed.data.staffId,
        })
      : assignmentMetadata;

  const { data: updatedRows, error } = await admin
    .from("bookings")
    .update({
      staff_id: parsed.data.staffId,
      metadata: nextMetadata as Database["public"]["Tables"]["bookings"]["Update"]["metadata"],
    })
    .eq("id", booking.id)
    .eq("branch_id", booking.branch_id)
    .select("id, branch_id, booking_date, start_time, delivery_type, type, staff_id");

  if (error) return { success: false, error: error.message };
  if (!updatedRows || updatedRows.length === 0) {
    return { success: false, error: "Therapist could not be assigned. You may not have permission." };
  }

  const updated = updatedRows[0]!;

  // Audit is stored in bookings.metadata.assignment_audit.
  await insertBookingAuditEvent({
    actorId,
    admin,
    bookingId: booking.id,
    fromStatus: booking.status,
    note: `Assigned therapist changed from ${previousStaffName} to ${nextStaffName}. Reason: ${parsed.data.overrideReason ?? "staff_reassigned"}.`,
    result: "staff_reassigned",
    toStatus: booking.status,
  });

  // Notify newly assigned therapist
  if (parsed.data.staffId !== previousStaffId) {
    const isHS = updated.delivery_type === "home_service" || updated.type === "home_service";
    await resolveNotificationsForEntity("booking", booking.id, "staff", "booking_assigned");
    await resolveNotificationsForEntity("booking", booking.id, "staff", "home_service_assigned");
    await createNotification({
      branchId: updated.branch_id,
      targetWorkspace: "staff",
      recipientStaffId: parsed.data.staffId,
      type: isHS ? "home_service_assigned" : "booking_assigned",
      title: isHS ? "Home Service booking assigned" : "Booking assigned to you",
      body: `You have been assigned a booking on ${updated.booking_date} at ${updated.start_time}.`,
      entityType: "booking",
      entityId: booking.id,
      actionHref: getNotificationTargetPath({ workspace: "staff-portal", entityType: "booking", entityId: booking.id }),
      priority: isHS ? "high" : "normal",
      requiresAction: isHS,
    });
  }

  if (openScheduleException && parsed.data.staffId !== previousStaffId) {
    await resolveStaffScheduleExceptionSignals({
      bookingId: booking.id,
      branchId: booking.branch_id,
      staffId: openScheduleException.selectedStaffId,
      reasonCode: openScheduleException.reasonCode,
      completedByStaffId: actorId,
    });
  }

  revalidateOperationalBookingSurfaces(booking.branch_id);
  return { success: true };
}


function readDispatchNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function readHomeServiceGps(metadata: CrmBookingActionRow["metadata"]): { lat: number | null; lng: number | null } {
  const current =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : {};
  const addressRaw = current.home_service_address;
  const address =
    addressRaw && typeof addressRaw === "object" && !Array.isArray(addressRaw)
      ? (addressRaw as Record<string, unknown>)
      : {};
  return {
    lat: readDispatchNumber(address.lat),
    lng: readDispatchNumber(address.lng),
  };
}

function readDispatchEta(metadata: CrmBookingActionRow["metadata"]): number {
  const current =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : {};
  const dispatchRaw = current.dispatch;
  const dispatch =
    dispatchRaw && typeof dispatchRaw === "object" && !Array.isArray(dispatchRaw)
      ? (dispatchRaw as Record<string, unknown>)
      : {};
  const liveEtaRaw = dispatch.live_eta;
  const liveEta =
    liveEtaRaw && typeof liveEtaRaw === "object" && !Array.isArray(liveEtaRaw)
      ? (liveEtaRaw as Record<string, unknown>)
      : {};
  return readDispatchNumber(liveEta.eta_minutes) ?? readDispatchNumber(dispatch.eta_minutes) ?? 25;
}

function withDispatchMetadata(
  metadata: CrmBookingActionRow["metadata"],
  input: {
    actorId: string | null;
    status: "scheduled" | "released_to_driver";
    approvedAt: string;
    releaseAt: string;
    releasedAt: string | null;
    etaMinutes: number;
    bufferMinutes: number;
    lat: number;
    lng: number;
    note?: string;
  }
): Database["public"]["Tables"]["bookings"]["Update"]["metadata"] {
  const current =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : {};
  const dispatchRaw = current.dispatch;
  const dispatch =
    dispatchRaw && typeof dispatchRaw === "object" && !Array.isArray(dispatchRaw)
      ? (dispatchRaw as Record<string, unknown>)
      : {};

  return {
    ...current,
    dispatch: {
      ...dispatch,
      status: input.status,
      ready: true,
      approved_at: input.approvedAt,
      approved_by: input.actorId,
      release_at: input.releaseAt,
      released_at: input.releasedAt,
      eta_minutes: input.etaMinutes,
      buffer_minutes: input.bufferMinutes,
      destination_lat: input.lat,
      destination_lng: input.lng,
      note: input.note?.trim() || null,
      source: "crm_dispatch_modal",
    },
  } as Database["public"]["Tables"]["bookings"]["Update"]["metadata"];
}

export async function prepareHomeServiceDispatchAction(
  rawInput: unknown
): Promise<{ success: boolean; error?: string; releasedNow?: boolean; releaseAt?: string }> {
  const parsed = prepareHomeServiceDispatchSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const ctx = await getCrmActionsContext();
  if (!ctx) return { success: false, error: "Unauthorized" };

  const booking = await loadCrmBookingForAction(ctx, parsed.data.bookingId);
  if (!booking) return { success: false, error: "Booking not found" };
  if (!isHomeServiceBooking(booking)) {
    return { success: false, error: "Dispatch preparation only applies to home-service bookings." };
  }
  if (CLOSED_BOOKING_STATUSES.has(booking.status) || booking.booking_progress_status === "completed") {
    return { success: false, error: "This booking can no longer be dispatched." };
  }
  if (!booking.driver_id) {
    return { success: false, error: "Assign a driver before dispatch." };
  }
  if (!booking.staff_id) {
    return { success: false, error: "Confirm a therapist before dispatch." };
  }

  const gps = readHomeServiceGps(booking.metadata);
  if (gps.lat === null || gps.lng === null) {
    return { success: false, error: "GPS location is missing. Dispatch cannot be released without coordinates." };
  }

  const etaMinutes = readDispatchEta(booking.metadata);
  const bufferMinutes = 10;
  const appointmentAt = new Date(`${booking.booking_date}T${normalizeActionTime(booking.start_time)}`);
  const releaseAt = new Date(appointmentAt.getTime() - (etaMinutes + bufferMinutes) * 60_000);
  const now = new Date();
  const shouldReleaseNow = parsed.data.releaseNow === true || now.getTime() >= releaseAt.getTime();
  const actorId = ctx.me.id === DEV_BYPASS_STAFF_ID ? null : ctx.me.id;
  const admin = createAdminClient();

  const { data: updatedRows, error } = await admin
    .from("bookings")
    .update({
      metadata: withDispatchMetadata(booking.metadata, {
        actorId,
        status: shouldReleaseNow ? "released_to_driver" : "scheduled",
        approvedAt: now.toISOString(),
        releaseAt: releaseAt.toISOString(),
        releasedAt: shouldReleaseNow ? now.toISOString() : null,
        etaMinutes,
        bufferMinutes,
        lat: gps.lat,
        lng: gps.lng,
        note: parsed.data.note,
      }),
    })
    .eq("id", booking.id)
    .eq("branch_id", booking.branch_id)
    .select("id");

  if (error) return { success: false, error: error.message };
  if (!updatedRows || updatedRows.length === 0) {
    return { success: false, error: "Dispatch could not be prepared." };
  }

  await insertBookingAuditEvent({
    actorId,
    admin,
    bookingId: booking.id,
    fromStatus: booking.status,
    toStatus: booking.status,
    result: shouldReleaseNow ? "dispatch_released" : "dispatch_scheduled",
    note: shouldReleaseNow
      ? `Home-service dispatch released to driver. ${parsed.data.note?.trim() ?? ""}`.trim()
      : `Home-service dispatch scheduled for ${releaseAt.toISOString()}. ${parsed.data.note?.trim() ?? ""}`.trim(),
  });

  if (shouldReleaseNow) {
    await resolveNotificationsForEntity("booking", booking.id, "driver", "home_service_assigned");
    await createNotification({
      branchId: booking.branch_id,
      targetWorkspace: "driver",
      recipientStaffId: booking.driver_id,
      type: "home_service_assigned",
      title: "Home Service trip released",
      body: `Trip is ready. Tap View and follow the saved GPS coordinates.`,
      entityType: "booking",
      entityId: booking.id,
      actionHref: `/driver/jobs/${booking.id}`,
      priority: "high",
      requiresAction: true,
      dedupeKey: `dispatch:released:${booking.id}`,
      metadata: {
        releaseAt: releaseAt.toISOString(),
        etaMinutes,
        destinationLat: gps.lat,
        destinationLng: gps.lng,
      },
    });
  }

  revalidateOperationalBookingSurfaces(booking.branch_id);
  revalidatePath("/crm/dispatch");
  revalidatePath("/manager/dispatch");
  revalidatePath("/driver");
  revalidatePath("/driver/dispatch");
  revalidatePath("/staff-portal/dispatch");

  return {
    success: true,
    releasedNow: shouldReleaseNow,
    releaseAt: releaseAt.toISOString(),
  };
}

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


