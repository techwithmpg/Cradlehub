"use server";

import { createClient } from "@/lib/supabase/server";
import { getMyUpcomingBookings, getMyMonthlyStats } from "@/lib/queries/bookings";
import { attachBranchResources } from "@/lib/queries/booking-resources";
import { getStaffSchedule, getStaffOverrides, getBlockedTimes } from "@/lib/queries/staff";
import { isDevAuthBypassEnabled, getDevBypassStaffRecord } from "@/lib/dev-bypass";
import {
  canTransitionBookingProgress,
  getTimestampFieldForProgressStatus,
  type BookingProgressStatus,
} from "@/lib/bookings/progress";
import type { StaffPortalBooking, StaffPortalStaff } from "@/components/features/staff-portal/types";

import { revalidatePath } from "next/cache";
import { logError, logBusinessEvent } from "@/lib/logger";
import { revalidateOperationalBookingSurfaces } from "@/lib/bookings/revalidate-booking-surfaces";

const STAFF_PORTAL_PATHS = [
  "/staff-portal",
  "/staff-portal/today",
  "/staff-portal/schedule",
  "/staff-portal/week",
] as const;

function revalidateStaffAndOperationalSurfaces(branchId?: string | null): void {
  for (const path of STAFF_PORTAL_PATHS) {
    revalidatePath(path);
  }
  revalidateOperationalBookingSurfaces(branchId);
}

// ── Resolve authenticated staff record ────────────────────────────────────
async function getMyStaffRecord(): Promise<StaffPortalStaff | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Select only core columns needed for the portal shell.
  // staff_type, avatar_url, avatar_path require later migrations — they default to null.
  const { data: me, error: meError } = await supabase
    .from("staff")
    .select("id, full_name, nickname, tier, system_role, branch_id")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (meError) {
    logError("staff_portal.staff_lookup_failed", {
      userId: user.id,
      error: meError,
    });
  }

  // Dev bypass: return a mock staff record so the portal renders
  // with empty data instead of crashing with "Unauthorized".
  if (!me && isDevAuthBypassEnabled()) {
    return getDevBypassStaffRecord();
  }

  if (!me) return null;

  // Merge in nullable fields that may not exist in this deployment yet.
  return {
    ...me,
    staff_type: null,
    avatar_url: null,
    avatar_path: null,
  } as StaffPortalStaff;
}

// ── Update staff profile photo ──────────────────────────────────────────
export async function updateStaffProfilePhotoAction(formData: FormData) {
  const supabase = await createClient();
  const me = await getMyStaffRecord();
  if (!me) return { error: "Unauthorized" };

  const file = formData.get("file") as File;
  if (!file) return { error: "No file provided" };

  // Validate file type
  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!allowedTypes.includes(file.type)) {
    return { error: "Invalid file type. Only JPG, PNG, and WebP are allowed." };
  }

  // Validate file size (2MB)
  if (file.size > 2 * 1024 * 1024) {
    return { error: "File too large. Maximum size is 2MB." };
  }

  const fileExt = file.name.split(".").pop();
  const filePath = `staff-avatars/${me.id}/profile.${fileExt}`;

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from("staff-pictures")
    .upload(filePath, file, {
      upsert: true,
      contentType: file.type,
    });

  if (uploadError) return { error: uploadError.message };

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from("staff-pictures")
    .getPublicUrl(filePath);

  // Update staff record
  const { error: updateError } = await supabase
    .from("staff")
    .update({
      avatar_url: publicUrl,
      avatar_path: filePath,
    })
    .eq("id", me.id);

  if (updateError) return { error: updateError.message };

  revalidatePath("/staff-portal");
  revalidatePath("/staff-portal/profile");
  revalidatePath("/owner/staff");

  return { success: true, avatarUrl: publicUrl };
}

// ── Today's bookings for the portal home ──────────────────────────────────
// IMPORTANT: customer select intentionally excludes phone and email (Rule 13).
// Staff should never see customer contact details through this portal.
export async function getMyTodayAction(date: string) {
  const supabase = await createClient();
  const me = await getMyStaffRecord();
  if (!me) return { error: "Unauthorized" };

  const selectWithResource = `
      id, booking_date, start_time, end_time, type, status,
      booking_progress_status, home_service_tracking_status,
      travel_buffer_mins, metadata,
      travel_started_at, arrived_at, session_started_at, completed_at,
      session_completed_at, checked_in_at, no_show_at,
      resource_id,
      services  ( id, name, duration_minutes ),
      customers ( id, full_name )
    `;
  const selectWithoutResource = `
      id, booking_date, start_time, end_time, type, status,
      booking_progress_status, home_service_tracking_status,
      travel_buffer_mins, metadata,
      travel_started_at, arrived_at, session_started_at, completed_at,
      session_completed_at, checked_in_at, no_show_at,
      services  ( id, name, duration_minutes ),
      customers ( id, full_name )
    `;
  const query = async (select: string) =>
    supabase
      .from("bookings")
      .select(select)
      .eq("staff_id", me.id)
      .eq("booking_date", date)
      .not("status", "in", '("cancelled","no_show")')
      .order("start_time");

  let { data, error } = await query(selectWithResource);

  if (
    error &&
    /column bookings\.resource_id does not exist/i.test(error.message)
  ) {
    const fallback = await query(selectWithoutResource);
    data = fallback.data;
    error = fallback.error;
  }

  if (error) return { error: error.message };

  try {
    const bookings = await attachBranchResources(
      supabase,
      (data ?? []) as unknown as Array<
        StaffPortalBooking & { resource_id?: string | null }
      >
    );
    return { bookings: bookings as unknown as StaffPortalBooking[], staff: me };
  } catch (resourceError) {
    return {
      error:
        resourceError instanceof Error
          ? resourceError.message
          : "Unable to load booking resources",
    };
  }
}

// ── Unified Booking Progress Result Type ──────────────────────────────────
export type BookingProgressResult =
  | {
      ok: true;
      bookingId: string;
      status: BookingProgressStatus;
      timestamp: string;
    }
  | {
      ok: false;
      code:
        | "UNAUTHORIZED"
        | "NOT_FOUND"
        | "INVALID_TRANSITION"
        | "ALREADY_COMPLETED"
        | "PERMISSION_DENIED"
        | "DATABASE_ERROR";
      message: string;
    };

// ── Update booking progress ───────────────────────────────────────────────
// Unified action for home_service, walkin, and online bookings.
// Role-aware: assigned staff can do therapist actions; CSR can check-in / no-show.
export async function updateBookingProgressAction({
  bookingId,
  nextStatus,
}: {
  bookingId: string;
  nextStatus: BookingProgressStatus;
}): Promise<BookingProgressResult> {
  const supabase = await createClient();
  const me = await getMyStaffRecord();
  if (!me) {
    return {
      ok: false,
      code: "UNAUTHORIZED",
      message: "You must be signed in to update progress.",
    };
  }

  // Fetch the booking — delivery_type drives transition validation (not type)
  const { data: booking, error: fetchError } = await supabase
    .from("bookings")
    .select("id, staff_id, branch_id, type, delivery_type, status, booking_progress_status, driver_id")
    .eq("id", bookingId)
    .single();

  if (fetchError || !booking) {
    return {
      ok: false,
      code: "NOT_FOUND",
      message: "Booking not found.",
    };
  }

  const isAssignedStaff = booking.staff_id === me.id;
  const isAssignedDriver =
    (booking as { driver_id?: string | null }).driver_id === me.id;
  const isManager = ["owner", "manager"].includes(me.system_role);
  const isCsr = ["csr", "csr_head", "csr_staff"].includes(me.system_role);
  const isDriver = me.system_role === "driver";

  // Categorize the requested action
  const therapistActions: BookingProgressStatus[] = [
    "session_started",
    "completed",
  ];
  // Drivers can advance travel stages for home-service trips
  const driverActions: BookingProgressStatus[] = ["travel_started", "arrived"];
  const csrActions: BookingProgressStatus[] = ["checked_in", "no_show"];
  const isTherapistAction = therapistActions.includes(nextStatus);
  const isDriverAction = driverActions.includes(nextStatus);
  const isCsrAction = csrActions.includes(nextStatus);

  // ── Permission checks ──
  if (isTherapistAction && !isAssignedStaff && !isManager) {
    return {
      ok: false,
      code: "PERMISSION_DENIED",
      message: "Only the assigned therapist can perform this action.",
    };
  }

  if (isDriverAction && !isAssignedStaff && !isManager && !(isDriver && isAssignedDriver)) {
    return {
      ok: false,
      code: "PERMISSION_DENIED",
      message: "Only the assigned driver or therapist can advance travel status.",
    };
  }

  if (isCsrAction && !isCsr && !isManager && !isAssignedStaff) {
    return {
      ok: false,
      code: "PERMISSION_DENIED",
      message: "You do not have permission to perform this action.",
    };
  }

  // ── Booking state checks ──
  if (booking.status === "cancelled") {
    return {
      ok: false,
      code: "ALREADY_COMPLETED",
      message: "This appointment has been cancelled.",
    };
  }

  if (booking.status === "completed" || booking.status === "no_show") {
    return {
      ok: false,
      code: "ALREADY_COMPLETED",
      message: "This appointment has already been concluded.",
    };
  }

  // ── Transition validation ──
  const currentStatus = booking.booking_progress_status as BookingProgressStatus;
  // Use delivery_type (operational discriminator) — the RPC also uses delivery_type.
  const deliveryType = (booking as { delivery_type?: string | null }).delivery_type;
  const bookingType: import("@/lib/bookings/progress").BookingTypeForProgress =
    deliveryType === "home_service" ? "home_service" : "in_spa";

  if (!canTransitionBookingProgress({ bookingType, currentStatus, nextStatus })) {
    return {
      ok: false,
      code: "INVALID_TRANSITION",
      message: getInvalidTransitionMessage(bookingType, currentStatus, nextStatus),
    };
  }

  // ── Execute via RPC (SECURITY DEFINER) ──
  const { error: rpcError } = await supabase.rpc("update_booking_progress", {
    p_booking_id: bookingId,
    p_next_status: nextStatus,
  });

  if (rpcError) {
    logError("staff_progress.update_failed", {
      bookingId,
      actorId: me.id,
      branchId: booking.branch_id,
      currentStatus,
      nextStatus,
      error: rpcError,
    });
    return {
      ok: false,
      code: "DATABASE_ERROR",
      message: rpcError.message,
    };
  }

  // ── Fetch updated timestamp ──
  const timestampField = getTimestampFieldForProgressStatus(nextStatus) ?? "updated_at";
  const { data: updated, error: tsError } = await supabase
    .from("bookings")
    .select(timestampField)
    .eq("id", bookingId)
    .single();

  const timestamp = (updated?.[timestampField as keyof typeof updated] as string | null) ?? new Date().toISOString();

  if (tsError) {
    return {
      ok: true,
      bookingId,
      status: nextStatus,
      timestamp,
    };
  }

  logBusinessEvent("staff_progress.updated", {
    bookingId,
    branchId: booking.branch_id,
    actorId: me.id,
    workspace: me.system_role,
    previousStatus: currentStatus,
    nextStatus,
    bookingType,
  });

  revalidateStaffAndOperationalSurfaces(booking.branch_id);

  return {
    ok: true,
    bookingId,
    status: nextStatus,
    timestamp,
  };
}

// ── Auto-complete due session ─────────────────────────────────────────────────
// Called by the countdown timer when the service duration expires.
// Server validates booking state + server time independently.
export async function autoCompleteDueSessionAction(
  bookingId: string
): Promise<BookingProgressResult> {
  const supabase = await createClient();
  const me = await getMyStaffRecord();
  if (!me) {
    return { ok: false, code: "UNAUTHORIZED", message: "You must be signed in." };
  }

  const { data: booking, error: fetchError } = await supabase
    .from("bookings")
    .select("id, staff_id, branch_id, delivery_type, status, booking_progress_status, session_started_at, service_id, services(duration_minutes)")
    .eq("id", bookingId)
    .single();

  if (fetchError || !booking) {
    return { ok: false, code: "NOT_FOUND", message: "Booking not found." };
  }

  // Permission: assigned staff, or manager/owner
  const isAssignedStaff = booking.staff_id === me.id;
  const isManager = ["owner", "manager"].includes(me.system_role);
  const isCrm = ["crm", "csr_head", "csr_staff", "csr"].includes(me.system_role);
  if (!isAssignedStaff && !isManager && !isCrm) {
    return { ok: false, code: "PERMISSION_DENIED", message: "Only assigned staff or managers may auto-complete." };
  }

  // Must be in session
  if (booking.booking_progress_status !== "session_started") {
    if (booking.booking_progress_status === "completed") {
      return { ok: true, bookingId, status: "completed", timestamp: new Date().toISOString() };
    }
    return { ok: false, code: "INVALID_TRANSITION", message: "Session is not currently in progress." };
  }

  if (!booking.session_started_at) {
    return { ok: false, code: "INVALID_TRANSITION", message: "Session start time is missing." };
  }

  // Server-side time validation: service duration must have elapsed
  type ServiceRow = { duration_minutes?: number | null };
  const serviceRow = Array.isArray(booking.services)
    ? (booking.services[0] as ServiceRow | undefined)
    : (booking.services as ServiceRow | null);
  const durationMinutes = serviceRow?.duration_minutes ?? 60;
  const startMs  = new Date(booking.session_started_at).getTime();
  const endMs    = startMs + durationMinutes * 60 * 1000;

  if (Date.now() < endMs) {
    return { ok: false, code: "INVALID_TRANSITION", message: "Service duration has not elapsed yet." };
  }

  const { error: rpcError } = await supabase.rpc("update_booking_progress", {
    p_booking_id: bookingId,
    p_next_status: "completed",
  });

  if (rpcError) {
    logError("staff_progress.auto_complete_failed", { bookingId, actorId: me.id, error: rpcError });
    return { ok: false, code: "DATABASE_ERROR", message: rpcError.message };
  }

  logBusinessEvent("staff_progress.auto_completed", { bookingId, branchId: booking.branch_id, actorId: me.id });
  revalidateStaffAndOperationalSurfaces(booking.branch_id);

  return { ok: true, bookingId, status: "completed", timestamp: new Date().toISOString() };
}

function getInvalidTransitionMessage(
  bookingType: string,
  current: BookingProgressStatus,
  next: BookingProgressStatus
): string {
  if (bookingType === "home_service") {
    if (current === "not_started" && next !== "travel_started") {
      return "You must start travel first.";
    }
    if (current === "travel_started" && next !== "arrived") {
      return "You can only mark arrived after starting travel.";
    }
    if (current === "arrived" && next !== "session_started") {
      return "You can only start the session after arriving.";
    }
    if (current === "session_started" && next !== "completed") {
      return "You can only complete after starting the session.";
    }
  }

  if (bookingType === "in_spa") {
    if (current === "not_started" && next !== "checked_in" && next !== "session_started" && next !== "no_show") {
      return "You may check in, start service directly, or mark no-show.";
    }
    if (current === "checked_in" && next !== "session_started" && next !== "no_show") {
      return "You can start the session or mark no-show.";
    }
    if (current === "session_started" && next !== "completed") {
      return "You can only complete the appointment.";
    }
  }

  if (bookingType === "online") {
    if (current === "not_started" && next !== "session_started") {
      return "You can only start the session.";
    }
    if (current === "session_started" && next !== "completed") {
      return "You can only complete the appointment.";
    }
  }

  if (current === "completed" || current === "no_show") {
    return "This appointment has already been concluded.";
  }

  return "Invalid progress transition.";
}

// ── Weekly view — own bookings + schedule for the next 7 days ─────────────
export async function getMyWeekAction(fromDate: string, toDate: string) {
  const me = await getMyStaffRecord();
  if (!me) return { error: "Unauthorized" };

  const [bookings, schedule, overrides, blocks] = await Promise.all([
    getMyUpcomingBookings(me.id, fromDate, toDate),
    getStaffSchedule(me.id),
    getStaffOverrides(me.id, fromDate),
    getBlockedTimes(me.id, fromDate, toDate),
  ]);

  return { bookings, schedule, overrides, blocks, staff: me };
}

// ── Personal stats for current month ─────────────────────────────────────
export async function getMyStatsAction(year: number, month: number) {
  const me = await getMyStaffRecord();
  if (!me) return { error: "Unauthorized" };
  return getMyMonthlyStats(me.id, year, month);
}

// ── Personal profile details ─────────────────────────────────────────────
export async function getMyProfileAction() {
  const me = await getMyStaffRecord();
  if (!me) return { error: "Unauthorized" };
  return { staff: me };
}
