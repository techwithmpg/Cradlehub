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

// ── Resolve authenticated staff record ────────────────────────────────────
async function getMyStaffRecord(): Promise<StaffPortalStaff | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Select only columns guaranteed to exist in every production deployment.
  // staff_type, avatar_url, avatar_path require later migrations — they default to null.
  const { data: me, error: meError } = await supabase
    .from("staff")
    .select("id, full_name, tier, system_role, branch_id")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (meError) {
    console.error("[staff-portal] staff lookup error", {
      userId: user.id,
      message: meError.message,
      code: meError.code,
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

  // Fetch the booking
  const { data: booking, error: fetchError } = await supabase
    .from("bookings")
    .select("id, staff_id, branch_id, type, status, booking_progress_status")
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
  const isManager = ["owner", "manager"].includes(me.system_role);
  const isCsr = ["csr", "csr_head", "csr_staff"].includes(me.system_role);

  // Categorize the requested action
  const therapistActions: BookingProgressStatus[] = [
    "travel_started",
    "arrived",
    "session_started",
    "completed",
  ];
  const csrActions: BookingProgressStatus[] = ["checked_in", "no_show"];
  const isTherapistAction = therapistActions.includes(nextStatus);
  const isCsrAction = csrActions.includes(nextStatus);

  // ── Permission checks ──
  if (isTherapistAction && !isAssignedStaff && !isManager) {
    return {
      ok: false,
      code: "PERMISSION_DENIED",
      message: "Only the assigned therapist can perform this action.",
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
  const bookingType = booking.type as "home_service" | "walkin" | "online";

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

  return {
    ok: true,
    bookingId,
    status: nextStatus,
    timestamp,
  };
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

  if (bookingType === "walkin") {
    if (current === "not_started" && next !== "checked_in" && next !== "no_show") {
      return "Please check in the client or mark no-show.";
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
