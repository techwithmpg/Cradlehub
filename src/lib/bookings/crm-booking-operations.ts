import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification, resolveNotificationsForEntity } from "@/lib/notifications/create";
import { getNotificationTargetPath } from "@/lib/notifications/notification-targets";
import { isResourceAvailable } from "@/lib/engine/resource-availability";
import { revalidateOperationalBookingSurfaces } from "@/lib/bookings/revalidate-booking-surfaces";
import { revalidatePath } from "next/cache";
import { logError } from "@/lib/logger";
import { z } from "zod";
import { canAccessCrmWorkspace } from "@/lib/auth/crm-permissions";
import { canCancelBooking, canReassignBooking } from "@/lib/permissions";
import { buildRecommendationContext } from "@/lib/queries/assignment-recommendations";
import { scoreTherapistCandidates } from "@/lib/assignments/recommendation-engine";
import { computeEndTime } from "@/lib/engine/booking-time";
import {
  getOpenStaffScheduleException,
  resolveStaffScheduleExceptionMetadata,
} from "@/lib/bookings/staff-schedule-exception";
import { resolveStaffScheduleExceptionSignals } from "@/lib/bookings/staff-schedule-exception-signals";
import {
  BOOKING_CANCELLATION_REASON_VALUES,
  getBookingCancellationReasonLabel,
} from "@/lib/bookings/cancellation-reasons";

/** Trusted server context. Never construct from renderer authorization fields. */
export type CrmActionContext = {
  supabase: SupabaseClient<Database>;
  authUserId: string;
  me: { id: string; branch_id: string; system_role: string };
  allowOwnerCrossBranch?: boolean;
  homeServiceOnly?: boolean;
};
export type BookingOperationResult = {
  success: boolean;
  error?: string;
  code?: string;
  releasedNow?: boolean;
  releaseAt?: string;
};

export const DEV_BYPASS_STAFF_ID = "00000000-0000-0000-0000-000000000000";

export const CLOSED_BOOKING_STATUSES = new Set(["completed", "cancelled", "no_show"]);

export const bookingIdSchema = z.object({
  bookingId: z.guid("Invalid booking identifier."),
});

export const recordBookingFollowupSchema = bookingIdSchema.extend({
  result: z.enum(["no_answer", "reschedule", "confirm_later", "cancel"]),
  note: z.string().max(500).optional(),
  followUpAt: z.string().max(100).optional(),
  cancellationReason: z.enum(BOOKING_CANCELLATION_REASON_VALUES).optional(),
});

export const rescheduleBookingSchema = bookingIdSchema.extend({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid booking date"),
  startTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Invalid start time"),
  note: z.string().max(500).optional(),
  homeServiceAddress: z.string().max(1000).optional(),
  homeServiceAccessNote: z.string().max(500).optional(),
  therapistId: z.guid("Invalid therapist ID").optional(),
  overrideReason: z
    .enum([
      "customer_requested",
      "therapist_on_break",
      "manager_decision",
      "skill_or_service_mismatch",
      "workload_balance",
      "other",
    ])
    .optional(),
});

export const assignBookingTherapistSchema = bookingIdSchema.extend({
  staffId: z.guid("Invalid staff ID"),
  overrideReason: z
    .enum([
      "customer_requested",
      "therapist_on_break",
      "manager_decision",
      "skill_or_service_mismatch",
      "workload_balance",
      "other",
    ])
    .optional(),
});

export const prepareHomeServiceDispatchSchema = bookingIdSchema.extend({
  releaseNow: z.boolean().optional(),
  note: z.string().max(500).optional(),
});

export type CrmBookingActionRow = {
  id: string;
  branch_id: string;
  customer_id: string | null;
  service_id: string | null;
  booking_date: string;
  start_time: string;
  end_time: string | null;
  type: string | null;
  delivery_type: string | null;
  status: string;
  payment_status: string | null;
  booking_progress_status: string | null;
  checked_in_at?: string | null;
  session_started_at?: string | null;
  resource_id: string | null;
  metadata: Database["public"]["Tables"]["bookings"]["Row"]["metadata"] | null;
  staff_id?: string | null;
  driver_id?: string | null;
  customers?: { full_name: string | null } | { full_name: string | null }[] | null;
  services?: { name: string | null } | { name: string | null }[] | null;
  staff?:
    | { id: string; full_name: string | null }
    | { id: string; full_name: string | null }[]
    | null;
  branches?: { name: string | null } | { name: string | null }[] | null;
};

export type CrmBookingLoadFailure = {
  success: false;
  code:
    | "booking_load_failed"
    | "booking_missing"
    | "booking_wrong_branch"
    | "booking_permission_denied";
  error: string;
};

export type CrmBookingLoadResult =
  | { success: true; booking: CrmBookingActionRow }
  | CrmBookingLoadFailure;

export function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export function isHomeServiceBooking(booking: {
  type?: string | null;
  delivery_type?: string | null;
}): boolean {
  return booking.delivery_type === "home_service" || booking.type === "home_service";
}

export function canAccessBookingBranch(ctx: CrmActionContext, branchId: string): boolean {
  return (
    (ctx.allowOwnerCrossBranch !== false && ctx.me.system_role === "owner") ||
    ctx.me.branch_id === branchId
  );
}

export function withFollowupMetadata(
  metadata: CrmBookingActionRow["metadata"],
  input: {
    result: string;
    note?: string;
    followUpAt?: string;
    actorId: string | null;
    cancellationReason?: string;
    cancellationNote?: string;
  }
): Database["public"]["Tables"]["bookings"]["Update"]["metadata"] {
  const current =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : {};

  const updatedAt = new Date().toISOString();

  return {
    ...current,
    crm_followup: {
      result: input.result,
      note: input.note?.trim() || null,
      follow_up_at: input.followUpAt?.trim() || null,
      updated_at: updatedAt,
      updated_by: input.actorId,
    },
    ...(input.result === "cancel"
      ? {
          cancellation: {
            reason: input.cancellationReason ?? input.note?.trim() ?? null,
            note: input.cancellationNote?.trim() || null,
            cancelled_at: updatedAt,
            cancelled_by: input.actorId,
            source: "crm",
          },
        }
      : {}),
  } as Database["public"]["Tables"]["bookings"]["Update"]["metadata"];
}

export function withRescheduleMetadata(
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

export function followupResultLabel(result: string): string {
  if (result === "no_answer") return "No Answer";
  if (result === "reschedule") return "Reschedule";
  if (result === "confirm_later") return "Confirm Later";
  if (result === "cancel") return "Cancel";
  if (result === "confirmed") return "Confirmed";
  if (result === "rescheduled") return "Rescheduled";
  if (result === "staff_reassigned") return "Staff Reassigned";
  return result;
}

export function auditPrefixForResult(result: string): string {
  return result === "rescheduled" || result === "staff_reassigned" ? "CRM action" : "CRM follow-up";
}

export function normalizeActionTime(value: string): string {
  return value.length === 5 ? `${value}:00` : value;
}

export function shortTime(value: string): string {
  return value.slice(0, 5);
}

export async function insertBookingAuditEvent(params: {
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

export async function annotateLatestBookingEvent(params: {
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

export async function loadCrmBookingForAction(
  ctx: CrmActionContext,
  bookingId: string,
  action: string,
  related: "none" | "room_summary" | "staff_summary" = "none"
): Promise<CrmBookingLoadResult> {
  const fail = (
    code: CrmBookingLoadFailure["code"],
    message: string,
    error?: unknown,
    branchId?: string | null
  ): CrmBookingLoadFailure => {
    logError("crm.booking_action_load_failed", {
      action,
      bookingId,
      authUserId: ctx.authUserId,
      branchId: branchId ?? ctx.me.branch_id,
      code,
      ...(error === undefined ? {} : { error }),
    });
    return { success: false, code, error: message };
  };

  const { data: baseBooking, error: baseError } = await ctx.supabase
    .from("bookings")
    .select("id, branch_id, status, booking_progress_status, customer_id")
    .eq("id", bookingId)
    .maybeSingle();

  if (baseError) {
    return fail("booking_load_failed", "Booking could not be loaded. Please try again.", baseError);
  }

  const admin = createAdminClient();
  if (!baseBooking) {
    const { data: existing, error: diagnosticError } = await admin
      .from("bookings")
      .select("id, branch_id")
      .eq("id", bookingId)
      .maybeSingle();

    if (diagnosticError) {
      return fail(
        "booking_load_failed",
        "Booking could not be loaded. Please try again.",
        diagnosticError
      );
    }
    if (!existing) {
      return fail("booking_missing", "Booking does not exist.");
    }
    if (!canAccessBookingBranch(ctx, existing.branch_id)) {
      return fail(
        "booking_wrong_branch",
        "Booking belongs to another branch.",
        undefined,
        existing.branch_id
      );
    }
    return fail(
      "booking_permission_denied",
      "You do not have permission to access this booking.",
      undefined,
      existing.branch_id
    );
  }

  if (!canAccessBookingBranch(ctx, baseBooking.branch_id)) {
    return fail(
      "booking_wrong_branch",
      "Booking belongs to another branch.",
      undefined,
      baseBooking.branch_id
    );
  }

  const { data: details, error: detailError } = await admin
    .from("bookings")
    .select(
      "id, branch_id, customer_id, service_id, booking_date, start_time, end_time, type, delivery_type, staff_id, driver_id, status, payment_status, booking_progress_status, checked_in_at, session_started_at, resource_id, metadata"
    )
    .eq("id", bookingId)
    .eq("branch_id", baseBooking.branch_id)
    .maybeSingle();

  if (detailError) {
    return fail(
      "booking_load_failed",
      "Booking could not be loaded. Please try again.",
      detailError,
      baseBooking.branch_id
    );
  }
  if (!details) {
    return fail(
      "booking_permission_denied",
      "You do not have permission to access this booking.",
      undefined,
      baseBooking.branch_id
    );
  }

  const booking = details as unknown as CrmBookingActionRow;
  if (ctx.homeServiceOnly && !isHomeServiceBooking(booking))
    return fail("booking_permission_denied", "This action requires a Home Service booking.");

  if (related === "room_summary") {
    const [customerResult, serviceResult, branchResult] = await Promise.all([
      booking.customer_id
        ? admin.from("customers").select("full_name").eq("id", booking.customer_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      booking.service_id
        ? admin.from("services").select("name").eq("id", booking.service_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      admin.from("branches").select("name").eq("id", booking.branch_id).maybeSingle(),
    ]);
    const relatedError = customerResult.error ?? serviceResult.error ?? branchResult.error;
    if (relatedError) {
      return fail(
        "booking_load_failed",
        "Booking details could not be loaded. Please try again.",
        relatedError,
        booking.branch_id
      );
    }
    booking.customers = customerResult.data;
    booking.services = serviceResult.data;
    booking.branches = branchResult.data;
  }

  if (related === "staff_summary" && booking.staff_id) {
    const { data: staff, error: staffError } = await admin
      .from("staff")
      .select("id, full_name")
      .eq("id", booking.staff_id)
      .maybeSingle();
    if (staffError) {
      return fail(
        "booking_load_failed",
        "Booking details could not be loaded. Please try again.",
        staffError,
        booking.branch_id
      );
    }
    booking.staff = staff;
  }

  return { success: true, booking };
}

export async function recordBookingFollowup(
  ctx: CrmActionContext,
  rawInput: unknown
): Promise<BookingOperationResult> {
  const parsed = recordBookingFollowupSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  if (!ctx.me.branch_id || !canAccessCrmWorkspace(ctx.me.system_role))
    return { success: false, code: "FORBIDDEN", error: "Unauthorized" };

  const bookingResult = await loadCrmBookingForAction(
    ctx,
    parsed.data.bookingId,
    "booking.followup.record"
  );
  if (!bookingResult.success) return bookingResult;
  const booking = bookingResult.booking;
  const isCancellation = parsed.data.result === "cancel";
  if (isCancellation && !canCancelBooking(ctx.me.system_role)) {
    return { success: false, error: "You do not have permission to cancel bookings." };
  }
  if (isCancellation && booking.status === "cancelled") {
    return { success: false, error: "Booking is already cancelled." };
  }
  if (
    isCancellation &&
    (booking.status === "completed" || booking.booking_progress_status === "completed")
  ) {
    return { success: false, error: "Completed bookings cannot be cancelled." };
  }
  if (isCancellation && booking.status === "no_show") {
    return { success: false, error: "Booking status does not allow cancellation." };
  }
  if (!isCancellation && CLOSED_BOOKING_STATUSES.has(booking.status)) {
    return { success: false, error: "This booking can no longer be updated." };
  }

  const actorId = ctx.me.id === DEV_BYPASS_STAFF_ID ? null : ctx.me.id;
  const cancellationReason = parsed.data.cancellationReason
    ? getBookingCancellationReasonLabel(parsed.data.cancellationReason)
    : undefined;
  const actionNote = isCancellation
    ? [cancellationReason, parsed.data.note?.trim()].filter(Boolean).join(". ")
    : parsed.data.note;
  const nextStatus = isCancellation ? "cancelled" : booking.status;
  const admin = createAdminClient();
  const { data: updatedRows, error } = await admin
    .from("bookings")
    .update({
      status: nextStatus,
      metadata: withFollowupMetadata(booking.metadata, {
        result: parsed.data.result,
        note: actionNote,
        followUpAt: parsed.data.followUpAt,
        actorId,
        cancellationReason,
        cancellationNote: parsed.data.note,
      }),
    })
    .eq("id", booking.id)
    .eq("branch_id", booking.branch_id)
    .select("id");

  if (error) {
    logError("crm.booking_action_update_failed", {
      action: isCancellation ? "booking.cancel" : "booking.followup.record",
      bookingId: booking.id,
      authUserId: ctx.authUserId,
      branchId: booking.branch_id,
      code: "booking_update_failed",
      error,
    });
    return {
      success: false,
      ...(ctx.allowOwnerCrossBranch === false ? { code: "SERVER_ERROR" } : {}),
      error: "Booking update failed. Please try again.",
    };
  }
  if (!updatedRows || updatedRows.length === 0) {
    return { success: false, error: "Follow-up result could not be saved." };
  }

  if (nextStatus === booking.status) {
    await insertBookingAuditEvent({
      actorId,
      admin,
      bookingId: booking.id,
      fromStatus: booking.status,
      note: actionNote,
      result: parsed.data.result,
      toStatus: booking.status,
    });
  } else {
    await annotateLatestBookingEvent({
      actorId,
      admin,
      bookingId: booking.id,
      note: actionNote,
      previousStatus: booking.status,
      result: parsed.data.result,
      nextStatus,
    });
  }

  if (isCancellation && booking.staff_id && booking.payment_status === "paid") {
    const sameDay = booking.booking_date === new Date().toISOString().split("T")[0];
    await createNotification({
      branchId: booking.branch_id,
      targetWorkspace: "staff",
      recipientStaffId: booking.staff_id,
      type: "booking_cancelled",
      title: "Booking cancelled",
      body: `Your booking on ${booking.booking_date} at ${booking.start_time} has been cancelled.`,
      entityType: "booking",
      entityId: booking.id,
      actionHref: getNotificationTargetPath({
        workspace: "staff-portal",
        entityType: "booking",
        entityId: booking.id,
      }),
      priority: sameDay ? "high" : "normal",
      requiresAction: sameDay,
    });
    await resolveNotificationsForEntity("booking", booking.id, "staff", "booking_assigned");
    await resolveNotificationsForEntity("booking", booking.id, "staff", "home_service_assigned");
  }

  if (isCancellation && booking.driver_id && booking.payment_status === "paid") {
    await createNotification({
      branchId: booking.branch_id,
      targetWorkspace: "driver",
      recipientStaffId: booking.driver_id,
      type: "booking_cancelled",
      title: "Assigned trip cancelled",
      body: `The Home Service trip on ${booking.booking_date} at ${booking.start_time} has been cancelled.`,
      entityType: "booking",
      entityId: booking.id,
      actionHref: `/driver/jobs/${booking.id}`,
      priority: "high",
      requiresAction: true,
      dedupeKey: `booking:${booking.id}:driver_cancelled`,
    });
    await resolveNotificationsForEntity("booking", booking.id, "driver", "home_service_assigned");
  }

  revalidateOperationalBookingSurfaces(booking.branch_id);
  return { success: true };
}

export async function rescheduleBooking(
  ctx: CrmActionContext,
  rawInput: unknown
): Promise<BookingOperationResult> {
  const parsed = rescheduleBookingSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  if (!ctx.me.branch_id || !canAccessCrmWorkspace(ctx.me.system_role))
    return { success: false, code: "FORBIDDEN", error: "Unauthorized" };

  const bookingResult = await loadCrmBookingForAction(
    ctx,
    parsed.data.bookingId,
    "booking.reschedule",
    "staff_summary"
  );
  if (!bookingResult.success) return bookingResult;
  const booking = bookingResult.booking;
  if (
    CLOSED_BOOKING_STATUSES.has(booking.status) ||
    booking.booking_progress_status === "completed"
  ) {
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
    currentHomeAddressRaw &&
    typeof currentHomeAddressRaw === "object" &&
    !Array.isArray(currentHomeAddressRaw)
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

  const targetStaffId = parsed.data.therapistId ?? booking.staff_id ?? null;
  const staffChanged =
    parsed.data.therapistId !== undefined && parsed.data.therapistId !== (booking.staff_id ?? null);

  if (!scheduleChanged && !addressChanged && !staffChanged) {
    return {
      success: false,
      error: "Choose a new date, time, therapist, or home-service address before saving.",
    };
  }

  if (staffChanged && !canReassignBooking(ctx.me.system_role)) {
    return { success: false, error: "You do not have permission to reassign therapists" };
  }

  let nextEndTime: string;
  try {
    nextEndTime = await computeEndTime(nextStartTime, booking.service_id, ctx.supabase);
  } catch {
    return {
      success: false,
      ...(ctx.allowOwnerCrossBranch === false ? { code: "SERVER_ERROR" } : {}),
      error: "Could not calculate the new booking end time.",
    };
  }

  const recommendationContext = await buildRecommendationContext(
    booking.id,
    {
      booking_date: nextDate,
      start_time: nextStartTime,
      end_time: nextEndTime,
    },
    {
      supabase: ctx.supabase,
      throwOnError: ctx.allowOwnerCrossBranch === false,
      branchId: ctx.allowOwnerCrossBranch === false ? ctx.me.branch_id : undefined,
    }
  );
  if (!recommendationContext) {
    return { success: false, error: "Could not verify staff availability for the new time." };
  }

  const scoredCandidates = scoreTherapistCandidates(recommendationContext);

  if (staffChanged && targetStaffId) {
    const admin = createAdminClient();
    const { data: staff, error: staffError } = await admin
      .from("staff")
      .select("id, branch_id, full_name, is_active")
      .eq("id", targetStaffId)
      .maybeSingle();

    if (staffError || !staff || !staff.is_active || staff.branch_id !== booking.branch_id) {
      return { success: false, error: "Selected therapist is not available for this branch." };
    }

    const candidate = scoredCandidates.find((c) => c.staffId === targetStaffId);
    if (!candidate) {
      return { success: false, error: "Selected therapist is not qualified for this service." };
    }
    if (candidate.status === "unavailable") {
      return {
        success: false,
        error: candidate.warnings[0] ?? "Selected therapist is not available at this time.",
      };
    }
  } else if (booking.staff_id) {
    const currentTherapist = scoredCandidates.find(
      (candidate) => candidate.staffId === booking.staff_id
    );
    if (!currentTherapist || currentTherapist.status === "unavailable") {
      return {
        success: false,
        error:
          currentTherapist?.warnings[0] ?? "Assigned therapist is not available at the new time.",
      };
    }
  } else if (!scoredCandidates.some((candidate) => candidate.status !== "unavailable")) {
    return { success: false, error: "No therapist is available at the new time." };
  }

  if (booking.resource_id && !isHomeServiceBooking(booking)) {
    const resourceAvailable = await isResourceAvailable(
      {
        resourceId: booking.resource_id,
        date: nextDate,
        startTime: nextStartTime,
        endTime: nextEndTime,
        excludeBookingId: booking.id,
      },
      { throwOnError: ctx.allowOwnerCrossBranch === false }
    );
    if (!resourceAvailable) {
      return { success: false, error: "The assigned room is not available at the new time." };
    }
  }

  const actorId = ctx.me.id === DEV_BYPASS_STAFF_ID ? null : ctx.me.id;
  const now = new Date().toISOString();
  let updatedMetadata = withRescheduleMetadata(booking.metadata, {
    actorId,
    fromDate: booking.booking_date,
    fromTime: currentStartTime,
    note: parsed.data.note,
    toDate: nextDate,
    toTime: nextStartTime,
    homeServiceAddress: isHomeServiceBooking(booking) ? nextAddress : undefined,
    homeServiceAccessNote: isHomeServiceBooking(booking) ? nextAccessNote : undefined,
  }) as Record<string, unknown>;

  if (staffChanged && targetStaffId) {
    const previousStaffId = booking.staff_id ?? null;
    const assignmentAudit = Array.isArray(updatedMetadata.assignment_audit)
      ? [...(updatedMetadata.assignment_audit as unknown[])]
      : [];
    assignmentAudit.push({
      staff_id: targetStaffId,
      previous_staff_id: previousStaffId,
      reason: parsed.data.overrideReason ?? "reschedule_reassignment",
      assigned_at: now,
      assigned_by: actorId,
      source: "crm_reschedule",
    });
    updatedMetadata.assignment_audit = assignmentAudit;
  }

  const openScheduleException = getOpenStaffScheduleException(currentMetadata);
  if (scheduleChanged && openScheduleException) {
    updatedMetadata = resolveStaffScheduleExceptionMetadata(updatedMetadata, {
      resolution: "rescheduled_booking",
      resolvedAt: now,
      resolvedByStaffId: actorId,
    }) as Record<string, unknown>;
  }

  const admin = createAdminClient();
  const updatePayload: Database["public"]["Tables"]["bookings"]["Update"] = {
    booking_date: nextDate,
    start_time: nextStartTime,
    end_time: nextEndTime,
    ...(staffChanged && targetStaffId ? { staff_id: targetStaffId } : {}),
    metadata: updatedMetadata as Database["public"]["Tables"]["bookings"]["Update"]["metadata"],
  };

  const { data: updatedRows, error } = await admin
    .from("bookings")
    .update(updatePayload)
    .eq("id", booking.id)
    .eq("branch_id", booking.branch_id)
    .select("id");

  if (error)
    return {
      success: false,
      ...(ctx.allowOwnerCrossBranch === false ? { code: "SERVER_ERROR" } : {}),
      error: "Booking update failed. Please try again.",
    };
  if (!updatedRows || updatedRows.length === 0) {
    return {
      success: false,
      error: "Booking could not be rescheduled. You may not have permission.",
    };
  }

  const auditNote = [
    scheduleChanged
      ? `Rescheduled from ${booking.booking_date} ${shortTime(currentStartTime)} to ${nextDate} ${shortTime(nextStartTime)}.`
      : null,
    staffChanged ? `Therapist reassigned.` : null,
    addressChanged ? "Home-service address updated." : null,
    parsed.data.note?.trim() || null,
  ]
    .filter(Boolean)
    .join(" ");

  await insertBookingAuditEvent({
    actorId,
    admin,
    bookingId: booking.id,
    fromStatus: booking.status,
    note: auditNote,
    result: "rescheduled",
    toStatus: booking.status,
  });

  if (staffChanged) {
    if (booking.staff_id && booking.payment_status === "paid") {
      await createNotification({
        branchId: booking.branch_id,
        targetWorkspace: "staff",
        recipientStaffId: booking.staff_id,
        type: "booking_reassigned",
        title: "Booking reassigned",
        body: `A booking previously assigned to you has been reassigned to another staff member.`,
        entityType: "booking",
        entityId: booking.id,
        actionHref: getNotificationTargetPath({
          workspace: "staff-portal",
          entityType: "booking",
          entityId: booking.id,
        }),
        priority: "normal",
        requiresAction: false,
      });
    }

    if (targetStaffId && booking.payment_status === "paid") {
      await createNotification({
        branchId: booking.branch_id,
        targetWorkspace: "staff",
        recipientStaffId: targetStaffId,
        type: "booking_rescheduled",
        title: "Booking assigned and rescheduled",
        body: `You have been assigned to a booking rescheduled to ${nextDate} at ${shortTime(nextStartTime)}.`,
        entityType: "booking",
        entityId: booking.id,
        actionHref: getNotificationTargetPath({
          workspace: "staff-portal",
          entityType: "booking",
          entityId: booking.id,
        }),
        priority: "high",
        requiresAction: true,
      });
    }
  } else if (booking.staff_id && booking.payment_status === "paid") {
    await createNotification({
      branchId: booking.branch_id,
      targetWorkspace: "staff",
      recipientStaffId: booking.staff_id,
      type: "booking_rescheduled",
      title: "Booking time changed",
      body: `Your booking has been rescheduled to ${nextDate} at ${shortTime(nextStartTime)}.`,
      entityType: "booking",
      entityId: booking.id,
      actionHref: getNotificationTargetPath({
        workspace: "staff-portal",
        entityType: "booking",
        entityId: booking.id,
      }),
      priority: "high",
      requiresAction: true,
    });
  }

  if (booking.driver_id && booking.payment_status === "paid") {
    await createNotification({
      branchId: booking.branch_id,
      targetWorkspace: "driver",
      recipientStaffId: booking.driver_id,
      type: "booking_rescheduled",
      title: "Assigned trip time changed",
      body: `Your Home Service trip has moved to ${nextDate} at ${shortTime(nextStartTime)}.`,
      entityType: "booking",
      entityId: booking.id,
      actionHref: `/driver/jobs/${booking.id}`,
      priority: "high",
      requiresAction: true,
      dedupeKey: `booking:${booking.id}:driver_rescheduled:${nextDate}:${shortTime(nextStartTime)}`,
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

export async function assignBookingTherapist(
  ctx: CrmActionContext,
  rawInput: unknown
): Promise<BookingOperationResult> {
  const parsed = assignBookingTherapistSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  if (!ctx.me.branch_id || !canAccessCrmWorkspace(ctx.me.system_role))
    return { success: false, code: "FORBIDDEN", error: "Unauthorized" };

  if (!canReassignBooking(ctx.me.system_role)) {
    return { success: false, error: "You do not have permission to reassign therapists" };
  }

  const bookingResult = await loadCrmBookingForAction(
    ctx,
    parsed.data.bookingId,
    "booking.staff.assign",
    "staff_summary"
  );
  if (!bookingResult.success) return bookingResult;
  const booking = bookingResult.booking;
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

  if (staffError)
    return {
      success: false,
      ...(ctx.allowOwnerCrossBranch === false ? { code: "SERVER_ERROR" } : {}),
      error: "Staff could not be loaded. Please try again.",
    };
  if (!staff || !staff.is_active || staff.branch_id !== booking.branch_id) {
    return { success: false, error: "Selected therapist is not available for this branch." };
  }

  const recommendationContext = await buildRecommendationContext(
    booking.id,
    {},
    {
      supabase: ctx.supabase,
      throwOnError: ctx.allowOwnerCrossBranch === false,
      branchId: ctx.allowOwnerCrossBranch === false ? ctx.me.branch_id : undefined,
    }
  );
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

  if (error)
    return {
      success: false,
      ...(ctx.allowOwnerCrossBranch === false ? { code: "SERVER_ERROR" } : {}),
      error: "Booking update failed. Please try again.",
    };
  if (!updatedRows || updatedRows.length === 0) {
    return {
      success: false,
      error: "Therapist could not be assigned. You may not have permission.",
    };
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
  if (parsed.data.staffId !== previousStaffId && booking.payment_status === "paid") {
    const isHS = updated.delivery_type === "home_service" || updated.type === "home_service";
    await resolveNotificationsForEntity("booking", booking.id, "staff", "booking_assigned");
    await resolveNotificationsForEntity("booking", booking.id, "staff", "home_service_assigned");
    if (previousStaffId) {
      await createNotification({
        branchId: updated.branch_id,
        targetWorkspace: "staff",
        recipientStaffId: previousStaffId,
        type: "booking_reassigned",
        title: "Booking reassigned",
        body: `The booking on ${updated.booking_date} at ${updated.start_time} is no longer assigned to you.`,
        entityType: "booking",
        entityId: booking.id,
        actionHref: getNotificationTargetPath({
          workspace: "staff-portal",
          entityType: "booking",
          entityId: booking.id,
        }),
        priority: "normal",
        requiresAction: false,
        dedupeKey: `booking:${booking.id}:staff_reassigned_from:${previousStaffId}`,
      });
    }
    await createNotification({
      branchId: updated.branch_id,
      targetWorkspace: "staff",
      recipientStaffId: parsed.data.staffId,
      type: isHS ? "home_service_assigned" : "booking_assigned",
      title: isHS ? "Home Service booking assigned" : "Booking assigned to you",
      body: `You have been assigned a booking on ${updated.booking_date} at ${updated.start_time}.`,
      entityType: "booking",
      entityId: booking.id,
      actionHref: getNotificationTargetPath({
        workspace: "staff-portal",
        entityType: "booking",
        entityId: booking.id,
      }),
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

export function readDispatchNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function readHomeServiceGps(metadata: CrmBookingActionRow["metadata"]): {
  lat: number | null;
  lng: number | null;
} {
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

export function readDispatchEta(metadata: CrmBookingActionRow["metadata"]): number {
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

export function withDispatchMetadata(
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

export async function prepareHomeServiceDispatch(
  ctx: CrmActionContext,
  rawInput: unknown
): Promise<BookingOperationResult> {
  const parsed = prepareHomeServiceDispatchSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  if (!ctx.me.branch_id || !canAccessCrmWorkspace(ctx.me.system_role))
    return { success: false, code: "FORBIDDEN", error: "Unauthorized" };

  const bookingResult = await loadCrmBookingForAction(
    ctx,
    parsed.data.bookingId,
    "booking.dispatch.prepare"
  );
  if (!bookingResult.success) return bookingResult;
  const booking = bookingResult.booking;
  if (!isHomeServiceBooking(booking)) {
    return { success: false, error: "Dispatch preparation only applies to home-service bookings." };
  }
  if (
    CLOSED_BOOKING_STATUSES.has(booking.status) ||
    booking.booking_progress_status === "completed"
  ) {
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
    return {
      success: false,
      error: "GPS location is missing. Dispatch cannot be released without coordinates.",
    };
  }

  const etaMinutes = readDispatchEta(booking.metadata);
  const bufferMinutes = 10;
  const appointmentAt = new Date(
    `${booking.booking_date}T${normalizeActionTime(booking.start_time)}`
  );
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

  if (error)
    return {
      success: false,
      ...(ctx.allowOwnerCrossBranch === false ? { code: "SERVER_ERROR" } : {}),
      error: "Booking update failed. Please try again.",
    };
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

export const CONFIRMABLE_STATUSES = new Set([
  "pending_payment",
  "pending_crm_confirmation",
  "pending",
]);

export const markBookingConfirmedSchema = bookingIdSchema.extend({
  note: z.string().max(500).optional(),
});

export function normalizeProgress(status: string | null | undefined): string {
  return status || "not_started";
}

export const STAFF_PORTAL_PATHS = [
  "/staff-portal",
  "/staff-portal/today",
  "/staff-portal/schedule",
  "/staff-portal/week",
] as const;

export function revalidateServiceSurfaces(branchId: string): void {
  revalidateOperationalBookingSurfaces(branchId);
  for (const path of STAFF_PORTAL_PATHS) {
    revalidatePath(path);
  }
}

export async function confirmCrmBooking(
  ctx: CrmActionContext,
  rawInput: unknown
): Promise<BookingOperationResult> {
  const parsed = markBookingConfirmedSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  if (!ctx.me.branch_id || !canAccessCrmWorkspace(ctx.me.system_role)) {
    return { success: false, code: "FORBIDDEN", error: "Unauthorized" };
  }

  const bookingResult = await loadCrmBookingForAction(
    ctx,
    parsed.data.bookingId,
    "booking.confirm"
  );
  if (!bookingResult.success) return bookingResult;
  const booking = bookingResult.booking;
  if (booking.status === "cancelled") {
    return { success: false, error: "Booking is already cancelled." };
  }
  if (booking.status === "completed" || booking.booking_progress_status === "completed") {
    return { success: false, error: "Completed bookings cannot be confirmed." };
  }
  if (booking.status === "no_show") {
    return { success: false, error: "Booking status does not allow confirmation." };
  }
  if (booking.status !== "confirmed" && !CONFIRMABLE_STATUSES.has(booking.status)) {
    return {
      success: false,
      error: `Booking cannot be confirmed from status "${booking.status}".`,
    };
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

  if (error) {
    logError("crm.booking_action_update_failed", {
      action: "booking.confirm",
      bookingId: booking.id,
      authUserId: ctx.authUserId,
      branchId: booking.branch_id,
      code: "booking_update_failed",
      error,
    });
    return { success: false, error: "Booking update failed. Please try again." };
  }
  if (!updatedRows || updatedRows.length === 0) {
    return {
      success: false,
      error: "Booking could not be confirmed. You may not have permission to update it.",
    };
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

export async function markCrmBookingArrived(
  ctx: CrmActionContext,
  rawInput: unknown
): Promise<BookingOperationResult> {
  const parsed = bookingIdSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  if (!ctx.me.branch_id || !canAccessCrmWorkspace(ctx.me.system_role)) {
    return { success: false, code: "FORBIDDEN", error: "Unauthorized" };
  }

  const bookingResult = await loadCrmBookingForAction(
    ctx,
    parsed.data.bookingId,
    "booking.arrival.mark"
  );
  if (!bookingResult.success) return bookingResult;
  const booking = bookingResult.booking;
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

export async function startCrmBookingService(
  ctx: CrmActionContext,
  rawInput: unknown
): Promise<BookingOperationResult> {
  const parsed = bookingIdSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid booking ID" };
  }

  if (!ctx.me.branch_id || !canAccessCrmWorkspace(ctx.me.system_role)) {
    return { success: false, code: "FORBIDDEN", error: "Unauthorized" };
  }

  const bookingResult = await loadCrmBookingForAction(
    ctx,
    parsed.data.bookingId,
    "booking.service.start"
  );
  if (!bookingResult.success) return bookingResult;
  const booking = bookingResult.booking;

  if (CLOSED_BOOKING_STATUSES.has(booking.status)) {
    return { success: false, error: "This booking is already closed." };
  }

  if (isHomeServiceBooking(booking)) {
    return { success: false, error: "Home-service sessions are started by the assigned staff." };
  }

  // Idempotent: fully started (both fields + timestamp set) → return success
  if (
    (booking.booking_progress_status === "session_started" || booking.status === "in_progress") &&
    (booking as { session_started_at?: string | null }).session_started_at
  ) {
    return { success: true };
  }

  const admin = createAdminClient();
  const { error } = await admin.rpc("start_booking_service_session", {
    p_booking_id: parsed.data.bookingId,
    p_source: "crm",
    p_actor_staff_id: ctx.me.id,
  });

  if (error) {
    logError("crm.start_service_failed", {
      bookingId: parsed.data.bookingId,
      error,
    });
    return { success: false, error: error.message };
  }

  revalidateServiceSurfaces(booking.branch_id);
  return { success: true };
}

export async function completeCrmBookingService(
  ctx: CrmActionContext,
  rawInput: unknown
): Promise<BookingOperationResult> {
  const parsed = bookingIdSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid booking ID" };
  }

  if (!ctx.me.branch_id || !canAccessCrmWorkspace(ctx.me.system_role)) {
    return { success: false, code: "FORBIDDEN", error: "Unauthorized" };
  }

  const bookingResult = await loadCrmBookingForAction(
    ctx,
    parsed.data.bookingId,
    "booking.service.complete"
  );
  if (!bookingResult.success) return bookingResult;
  const booking = bookingResult.booking;

  // Idempotent: already completed → return success
  if (booking.status === "completed" || booking.booking_progress_status === "completed") {
    return { success: true };
  }

  if (booking.status === "cancelled" || booking.status === "no_show") {
    return { success: false, error: "This booking is already closed." };
  }

  const admin = createAdminClient();
  const { error } = await admin.rpc("complete_booking_service_session", {
    p_booking_id: parsed.data.bookingId,
    p_completion_source: "crm_manual",
    p_actor_staff_id: ctx.me.id,
  });

  if (error) {
    logError("crm.complete_service_failed", {
      bookingId: parsed.data.bookingId,
      error,
    });
    return { success: false, error: error.message };
  }

  revalidateServiceSurfaces(booking.branch_id);
  return { success: true };
}
