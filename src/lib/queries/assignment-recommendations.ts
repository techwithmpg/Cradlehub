import { createClient } from "@/lib/supabase/server";
import type {
  RecommendationContext,
  StaffForScoring,
  ScheduleForScoring,
  OverrideForScoring,
  BlockForScoring,
  CheckinForScoring,
  ConflictBooking,
  StaffServiceMapping,
  StaffPreference,
} from "@/lib/assignments/recommendation-engine";

// ── Types ──────────────────────────────────────────────────────────────────────

export type BookingForRecommendation = {
  id: string;
  branch_id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  delivery_type: string | null;
  type: string;
  staff_id: string | null;
  driver_id: string | null;
  service_id: string | null;
};

export type ServiceForRecommendation = {
  id: string;
  name: string;
  duration_minutes: number;
  category_name: string | null;
};

// ── Booking fetch ──────────────────────────────────────────────────────────────

export async function getBookingForRecommendation(
  bookingId: string
): Promise<BookingForRecommendation | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .select(
      "id, branch_id, booking_date, start_time, end_time, delivery_type, type, staff_id, driver_id, service_id"
    )
    .eq("id", bookingId)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    branch_id: data.branch_id,
    booking_date: data.booking_date,
    start_time: data.start_time,
    end_time: data.end_time ?? "",
    delivery_type: data.delivery_type,
    type: data.type,
    staff_id: data.staff_id,
    driver_id: data.driver_id,
    service_id: data.service_id,
  };
}

// ── Service fetch ──────────────────────────────────────────────────────────────

export async function getServiceForRecommendation(
  serviceId: string | null
): Promise<ServiceForRecommendation | null> {
  if (!serviceId) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("services")
    .select("id, name, duration_minutes, service_categories ( name )")
    .eq("id", serviceId)
    .single();

  if (error || !data) return null;

  const categoryName = (() => {
    const rel = data.service_categories;
    if (Array.isArray(rel)) return rel[0]?.name ?? null;
    return rel?.name ?? null;
  })();

  return {
    id: data.id,
    name: data.name,
    duration_minutes: data.duration_minutes,
    category_name: categoryName,
  };
}

// ── Staff list ─────────────────────────────────────────────────────────────────

export async function getBranchStaffForScoring(branchId: string): Promise<StaffForScoring[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("staff")
    .select("id, full_name, staff_type, system_role, tier, is_active, branch_id")
    .eq("branch_id", branchId)
    .eq("is_active", true)
    .order("full_name");

  if (error) throw new Error(error.message);

  return (data ?? []).map((s) => ({
    id: s.id,
    full_name: s.full_name,
    staff_type: s.staff_type ?? null,
    system_role: s.system_role ?? null,
    tier: s.tier ?? null,
    is_active: s.is_active,
    branch_id: s.branch_id,
  }));
}

// ── Staff services ─────────────────────────────────────────────────────────────

export async function getStaffServicesForScoring(
  serviceId: string | null,
  staffIds: string[]
): Promise<StaffServiceMapping[]> {
  if (!serviceId || staffIds.length === 0) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("staff_services")
    .select("staff_id, service_id")
    .eq("service_id", serviceId)
    .in("staff_id", staffIds);

  if (error) throw new Error(error.message);
  return (data ?? []) as StaffServiceMapping[];
}

// ── Staff schedules ────────────────────────────────────────────────────────────

export async function getStaffSchedulesForScoring(
  staffIds: string[],
  dayOfWeek: number
): Promise<ScheduleForScoring[]> {
  if (staffIds.length === 0) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("staff_schedules")
    .select("staff_id, day_of_week, start_time, end_time, is_active, shift_type")
    .eq("day_of_week", dayOfWeek)
    .eq("is_active", true)
    .in("staff_id", staffIds);

  if (error) throw new Error(error.message);
  return (data ?? []) as ScheduleForScoring[];
}

// ── Schedule overrides ─────────────────────────────────────────────────────────

export async function getScheduleOverridesForScoring(
  staffIds: string[],
  date: string
): Promise<OverrideForScoring[]> {
  if (staffIds.length === 0) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("schedule_overrides")
    .select("staff_id, override_date, is_day_off, start_time, end_time")
    .eq("override_date", date)
    .in("staff_id", staffIds);

  if (error) throw new Error(error.message);
  return (data ?? []) as OverrideForScoring[];
}

// ── Blocked times ──────────────────────────────────────────────────────────────

export async function getBlockedTimesForScoring(
  staffIds: string[],
  date: string
): Promise<BlockForScoring[]> {
  if (staffIds.length === 0) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("blocked_times")
    .select("staff_id, block_date, start_time, end_time")
    .eq("block_date", date)
    .in("staff_id", staffIds);

  if (error) throw new Error(error.message);
  return (data ?? []) as BlockForScoring[];
}

// ── Check-ins ──────────────────────────────────────────────────────────────────

export async function getCheckinsForScoring(
  branchId: string,
  date: string
): Promise<CheckinForScoring[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("staff_shift_checkins")
    .select("staff_id, shift_date, status")
    .eq("branch_id", branchId)
    .eq("shift_date", date)
    .neq("status", "voided");

  if (error) throw new Error(error.message);
  return (data ?? []) as CheckinForScoring[];
}

// ── Existing bookings (therapist conflicts) ────────────────────────────────────

export async function getTherapistConflictBookings(
  branchId: string,
  date: string
): Promise<ConflictBooking[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .select("staff_id, start_time, end_time, status")
    .eq("branch_id", branchId)
    .eq("booking_date", date)
    .not("status", "in", '("cancelled","no_show")')
    .not("staff_id", "is", null);

  if (error) throw new Error(error.message);
  return (data ?? []).map((b) => ({
    staff_id: b.staff_id as string,
    start_time: b.start_time,
    end_time: b.end_time ?? b.start_time,
    status: b.status,
  }));
}

// ── Existing bookings (driver conflicts) ───────────────────────────────────────

export async function getDriverConflictBookings(
  branchId: string,
  date: string
): Promise<ConflictBooking[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .select("driver_id, start_time, end_time, status")
    .eq("branch_id", branchId)
    .eq("booking_date", date)
    .not("status", "in", '("cancelled","no_show")')
    .not("driver_id", "is", null);

  if (error) throw new Error(error.message);
  return (data ?? []).map((b) => ({
    staff_id: b.driver_id as string,
    start_time: b.start_time,
    end_time: b.end_time ?? b.start_time,
    status: b.status,
  }));
}

// ── Staff preferences ──────────────────────────────────────────────────────────

export async function getStaffPreferencesForScoring(
  staffIds: string[]
): Promise<StaffPreference[]> {
  if (staffIds.length === 0) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("staff_scheduling_preferences")
    .select("staff_id, can_do_home_service, can_drive, max_services_per_day, max_trips_per_day")
    .in("staff_id", staffIds);

  if (error) {
    // Gracefully return empty if table doesn't exist yet
    if (error.message.includes("does not exist") || error.message.includes("could not find")) {
      return [];
    }
    throw new Error(error.message);
  }

  return (data ?? []).map((p) => ({
    staff_id: p.staff_id,
    can_do_home_service: p.can_do_home_service ?? false,
    can_drive: p.can_drive ?? false,
    max_services_per_day: p.max_services_per_day ?? null,
    max_trips_per_day: p.max_trips_per_day ?? null,
  }));
}

// ── Internal context builder ───────────────────────────────────────────────────

async function buildContextFromBooking(
  booking: BookingForRecommendation,
  conflictType: "therapist" | "driver"
): Promise<RecommendationContext> {
  const { branch_id: branchId, booking_date: date, service_id: serviceId } = booking;
  const dayOfWeek = (() => {
    const [y = "0", m = "1", d = "1"] = date.split("-");
    return new Date(Number(y), Number(m) - 1, Number(d)).getDay();
  })();

  const staffList = await getBranchStaffForScoring(branchId);
  const staffIds = staffList.map((s) => s.id);

  const [
    service,
    staffServices,
    schedules,
    overrides,
    blockedTimes,
    checkins,
    conflictBookings,
    preferences,
  ] = await Promise.all([
    getServiceForRecommendation(serviceId),
    getStaffServicesForScoring(serviceId, staffIds),
    getStaffSchedulesForScoring(staffIds, dayOfWeek),
    getScheduleOverridesForScoring(staffIds, date),
    getBlockedTimesForScoring(staffIds, date),
    getCheckinsForScoring(branchId, date),
    conflictType === "driver"
      ? getDriverConflictBookings(branchId, date)
      : getTherapistConflictBookings(branchId, date),
    getStaffPreferencesForScoring(staffIds),
  ]);

  const isHomeService =
    booking.delivery_type === "home_service" || booking.type === "home_service";

  return {
    bookingDate: date,
    bookingStartTime: booking.start_time,
    bookingEndTime: booking.end_time || booking.start_time,
    isHomeService,
    service: service
      ? {
          id: service.id,
          name: service.name,
          duration_minutes: service.duration_minutes,
          categoryName: service.category_name,
        }
      : null,
    staffList,
    staffServices,
    schedules,
    overrides,
    blockedTimes,
    checkins,
    existingBookings: conflictBookings,
    preferences,
  };
}

// ── Combined context builder ───────────────────────────────────────────────────

export async function buildRecommendationContext(
  bookingId: string
): Promise<RecommendationContext | null> {
  const booking = await getBookingForRecommendation(bookingId);
  if (!booking) return null;
  return buildContextFromBooking(booking, "therapist");
}

// ── Convenience: build driver-specific context ─────────────────────────────────

export async function buildDriverRecommendationContext(
  bookingId: string
): Promise<RecommendationContext | null> {
  const booking = await getBookingForRecommendation(bookingId);
  if (!booking) return null;
  return buildContextFromBooking(booking, "driver");
}
