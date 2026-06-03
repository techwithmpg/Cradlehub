"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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
  "/staff-portal/profile",
] as const;

const staffSelfProfileSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Full name must be at least 2 characters.")
    .max(100, "Full name must be 100 characters or fewer."),
  nickname: z.preprocess(
    (value) => {
      if (typeof value !== "string") return null;
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    },
    z.string().max(80, "Nickname must be 80 characters or fewer.").nullable()
  ),
});

export type StaffProfileDetailsActionState = {
  success?: boolean;
  error?: string;
  fieldErrors?: {
    fullName?: string[];
    nickname?: string[];
  };
};

function revalidateStaffAndOperationalSurfaces(branchId?: string | null): void {
  for (const path of STAFF_PORTAL_PATHS) {
    revalidatePath(path);
  }
  revalidateOperationalBookingSurfaces(branchId);
}

function isMissingStaffProfileColumnError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("staff.staff_type does not exist") ||
    m.includes('"staff_type" does not exist') ||
    m.includes("staff.avatar_url does not exist") ||
    m.includes('"avatar_url" does not exist') ||
    m.includes("staff.avatar_path does not exist") ||
    m.includes('"avatar_path" does not exist') ||
    m.includes("in the schema cache")
  );
}

// ── Resolve authenticated staff record ────────────────────────────────────
async function getMyStaffRecord(): Promise<StaffPortalStaff | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const primary = await supabase
    .from("staff")
    .select("id, full_name, nickname, tier, system_role, staff_type, branch_id, avatar_url, avatar_path")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  let me = primary.data as StaffPortalStaff | null;
  let meError = primary.error;

  if (primary.error && isMissingStaffProfileColumnError(primary.error.message)) {
    const fallback = await supabase
      .from("staff")
      .select("id, full_name, nickname, tier, system_role, branch_id")
      .eq("auth_user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    me = fallback.data
      ? ({
          ...fallback.data,
          staff_type: null,
          avatar_url: null,
          avatar_path: null,
        } as StaffPortalStaff)
      : null;
    meError = fallback.error;
  }

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

  return me;
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
  const { data: updatedRows, error: updateError } = await createAdminClient()
    .from("staff")
    .update({
      avatar_url: publicUrl,
      avatar_path: filePath,
    })
    .eq("id", me.id)
    .select("id");

  if (updateError) return { error: updateError.message };
  if (!updatedRows || updatedRows.length === 0) {
    return { error: "No staff profile was updated." };
  }

  revalidateStaffAndOperationalSurfaces(me.branch_id);
  revalidatePath("/owner/staff");
  revalidatePath("/manager/staff");
  revalidatePath("/crm/staff");

  return { success: true, avatarUrl: publicUrl };
}

// ── Update own staff profile details ─────────────────────────────────────
export async function updateMyProfileDetailsAction(
  _previousState: StaffProfileDetailsActionState,
  formData: FormData
): Promise<StaffProfileDetailsActionState> {
  const parsed = staffSelfProfileSchema.safeParse({
    fullName: formData.get("fullName"),
    nickname: formData.get("nickname"),
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return {
      success: false,
      error: "Please check the highlighted fields.",
      fieldErrors: {
        fullName: fieldErrors.fullName,
        nickname: fieldErrors.nickname,
      },
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Unauthorized" };

  const me = await getMyStaffRecord();
  if (!me) return { success: false, error: "Unauthorized" };

  const { fullName, nickname } = parsed.data;
  const { data: updatedRows, error } = await createAdminClient()
    .from("staff")
    .update({
      full_name: fullName,
      nickname,
    })
    .eq("id", me.id)
    .eq("auth_user_id", user.id)
    .select("id");

  if (error) return { success: false, error: error.message };
  if (!updatedRows || updatedRows.length === 0) {
    return { success: false, error: "No staff profile was updated." };
  }

  logBusinessEvent("staff_profile.self_updated", {
    actorId: me.id,
    branchId: me.branch_id,
  });

  revalidateStaffAndOperationalSurfaces(me.branch_id);
  revalidatePath("/owner/staff");
  revalidatePath("/manager/staff");
  revalidatePath("/crm/staff");

  return { success: true };
}

// ── Service Progress — all today's active + completed bookings ───────────
export type ServiceProgressResult =
  | { error: string }
  | {
      active: StaffPortalBooking[];
      completed: StaffPortalBooking[];
      staff: StaffPortalStaff;
    };

export async function getMyServiceProgressAction(date: string): Promise<ServiceProgressResult> {
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

  const runQuery = async (select: string) =>
    supabase
      .from("bookings")
      .select(select)
      .eq("staff_id", me.id)
      .eq("booking_date", date)
      .neq("status", "cancelled")
      .order("start_time");

  let { data, error } = await runQuery(selectWithResource);

  if (error && /column bookings\.resource_id does not exist/i.test(error.message)) {
    const fallback = await runQuery(selectWithoutResource);
    data = fallback.data;
    error = fallback.error;
  }

  if (error) return { error: error.message };

  try {
    const allBookings = await attachBranchResources(
      supabase,
      (data ?? []) as unknown as Array<StaffPortalBooking & { resource_id?: string | null }>
    );

    const bookings = allBookings as unknown as StaffPortalBooking[];
    const active = bookings.filter(
      (b) => b.status !== "completed" && b.status !== "no_show"
    );
    const completed = bookings.filter(
      (b) => b.status === "completed" || b.status === "no_show"
    );

    return { active, completed, staff: me };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Unable to load service progress",
    };
  }
}

// ── Today's schedule (shift) info ────────────────────────────────────────
export type TodayScheduleInfo = {
  day_of_week: number;
  start_time: string;
  end_time: string;
  shift_type: string;
};

export type TodayOverrideInfo = {
  override_date: string;
  is_day_off: boolean;
  start_time: string | null;
  end_time: string | null;
};

export type TodayScheduleResult =
  | { error: string }
  | { todaySchedule: TodayScheduleInfo | null; todayOverride: TodayOverrideInfo | null };

export async function getMyTodayScheduleAction(date: string): Promise<TodayScheduleResult> {
  const me = await getMyStaffRecord();
  if (!me) return { error: "Unauthorized" };

  const parts = date.split("-").map(Number);
  const y = parts[0] ?? 0;
  const m = (parts[1] ?? 1) - 1;
  const d = parts[2] ?? 1;
  const todayDow = new Date(y, m, d).getDay();

  const [scheduleRows, overrideRows] = await Promise.all([
    getStaffSchedule(me.id).catch((): Awaited<ReturnType<typeof getStaffSchedule>> => []),
    getStaffOverrides(me.id, date).catch((): Awaited<ReturnType<typeof getStaffOverrides>> => []),
  ]);

  const todayScheduleRow = scheduleRows.find((r) => r.day_of_week === todayDow);
  const todayOverrideRow = overrideRows.find((o) => o.override_date === date);

  return {
    todaySchedule: todayScheduleRow
      ? {
          day_of_week: todayScheduleRow.day_of_week,
          start_time: todayScheduleRow.start_time,
          end_time: todayScheduleRow.end_time,
          shift_type: todayScheduleRow.shift_type ?? "single",
        }
      : null,
    todayOverride: todayOverrideRow
      ? {
          override_date: todayOverrideRow.override_date,
          is_day_off: todayOverrideRow.is_day_off,
          start_time: todayOverrideRow.start_time ?? null,
          end_time: todayOverrideRow.end_time ?? null,
        }
      : null,
  };
}

// ── Monthly schedule stats for basic (non-therapist) staff ─────────────────
export type MonthlyScheduleStats = {
  workingDays: number;
  daysOff: number;
  noShiftDays: number;
  hoursScheduled: number;
  avgDailyHours: number;
  daysInMonth: number;
};

export type MonthlyScheduleStatsResult =
  | { error: string }
  | MonthlyScheduleStats;

export async function getMyMonthlyScheduleStatsAction(
  year: number,
  month: number
): Promise<MonthlyScheduleStatsResult> {
  const me = await getMyStaffRecord();
  if (!me) return { error: "Unauthorized" };

  const daysInMonth = new Date(year, month, 0).getDate();
  const yStr = String(year);
  const mStr = String(month).padStart(2, "0");
  const monthStart = `${yStr}-${mStr}-01`;
  const monthEnd = `${yStr}-${mStr}-${String(daysInMonth).padStart(2, "0")}`;

  const [scheduleRows, allOverrides] = await Promise.all([
    getStaffSchedule(me.id).catch((): Awaited<ReturnType<typeof getStaffSchedule>> => []),
    getStaffOverrides(me.id, monthStart).catch((): Awaited<ReturnType<typeof getStaffOverrides>> => []),
  ]);

  const overrides = allOverrides.filter(
    (o) => o.override_date >= monthStart && o.override_date <= monthEnd
  );
  const overrideByDate: Record<string, typeof overrides[number]> = {};
  for (const o of overrides) overrideByDate[o.override_date] = o;

  const schedByDow: Partial<Record<number, typeof scheduleRows[number]>> = {};
  for (const row of scheduleRows) schedByDow[row.day_of_week] = row;

  let workingDays = 0;
  let daysOff = 0;
  let totalMinutes = 0;

  for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
    const dateStr = `${yStr}-${mStr}-${String(dayNum).padStart(2, "0")}`;
    const dow = new Date(year, month - 1, dayNum).getDay();
    const override = overrideByDate[dateStr];

    if (override) {
      if (override.is_day_off) {
        daysOff++;
      } else {
        workingDays++;
        const st = override.start_time;
        const et = override.end_time;
        if (st && et) {
          const [sh, sm] = st.split(":").map(Number);
          const [eh, em] = et.split(":").map(Number);
          totalMinutes += ((eh ?? 0) * 60 + (em ?? 0)) - ((sh ?? 0) * 60 + (sm ?? 0));
        }
      }
    } else {
      const schedRow = schedByDow[dow];
      if (schedRow) {
        workingDays++;
        const [sh, sm] = schedRow.start_time.split(":").map(Number);
        const [eh, em] = schedRow.end_time.split(":").map(Number);
        totalMinutes += ((eh ?? 0) * 60 + (em ?? 0)) - ((sh ?? 0) * 60 + (sm ?? 0));
      }
    }
  }

  const hoursScheduled = Math.round((totalMinutes / 60) * 10) / 10;
  const avgDailyHours =
    workingDays > 0 ? Math.round((hoursScheduled / workingDays) * 10) / 10 : 0;

  return {
    workingDays,
    daysOff,
    noShiftDays: daysInMonth - workingDays - daysOff,
    hoursScheduled,
    avgDailyHours,
    daysInMonth,
  };
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
