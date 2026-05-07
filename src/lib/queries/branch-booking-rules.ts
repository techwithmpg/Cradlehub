import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isDevAuthBypassEnabled } from "@/lib/dev-bypass";
import type { BookingType } from "@/types";
import type { Database } from "@/types/supabase";
import {
  DEFAULT_BRANCH_BOOKING_RULES,
  branchBookingRulesSchema,
  type BranchBookingRules,
  type UpdateBranchBookingRulesInput,
} from "@/lib/validations/booking-rules";

type BranchBookingRulesRow =
  Database["public"]["Tables"]["branch_booking_rules"]["Row"];

type ActionResult =
  | { success: true; rules: BranchBookingRules }
  | { success: false; error: string };

type BranchRulesValidationResult =
  | { ok: true; rules: BranchBookingRules }
  | { ok: false; message: string; rules: BranchBookingRules };

type StaffAuthContext = {
  branch_id: string | null;
  system_role: string;
};

function normalizeTime(time: string): string {
  return time.slice(0, 5);
}

function timeToMinutes(time: string): number | null {
  const [hourRaw, minuteRaw] = time.split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);

  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;

  return hour * 60 + minute;
}

function formatTimeForMessage(time: string): string {
  const minutes = timeToMinutes(time);
  if (minutes === null) return time;

  const hour24 = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const hour12 = hour24 % 12 || 12;
  const ampm = hour24 >= 12 ? "PM" : "AM";

  return `${hour12}:${String(minute).padStart(2, "0")} ${ampm}`;
}

function dateFromYmd(date: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const parsed = new Date(`${date}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isMissingRulesTableError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("branch_booking_rules") &&
    (lower.includes("does not exist") ||
      lower.includes("schema cache") ||
      lower.includes("could not find"))
  );
}

function mapRowToRules(row: BranchBookingRulesRow): BranchBookingRules {
  return {
    id: row.id,
    branchId: row.branch_id,
    inSpaStartTime: normalizeTime(row.in_spa_start_time),
    inSpaEndTime: normalizeTime(row.in_spa_end_time),
    homeServiceEnabled: row.home_service_enabled,
    homeServiceStartTime: normalizeTime(row.home_service_start_time),
    homeServiceEndTime: normalizeTime(row.home_service_end_time),
    travelBufferMins: row.travel_buffer_mins,
    maxAdvanceBookingDays: row.max_advance_booking_days,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getDefaultBranchBookingRules(branchId: string): BranchBookingRules {
  return {
    branchId,
    ...DEFAULT_BRANCH_BOOKING_RULES,
  };
}

export async function getBranchBookingRules(
  branchId: string
): Promise<BranchBookingRules | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("branch_booking_rules")
    .select("*")
    .eq("branch_id", branchId)
    .maybeSingle();

  if (error) {
    if (isMissingRulesTableError(error.message)) return null;
    throw new Error(error.message);
  }

  return data ? mapRowToRules(data) : null;
}

export async function getBranchBookingRulesOrDefault(
  branchId: string
): Promise<BranchBookingRules> {
  const rules = await getBranchBookingRules(branchId);
  return rules ?? getDefaultBranchBookingRules(branchId);
}

async function canManageBranchRules(branchId: string): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return false;
  if (isDevAuthBypassEnabled()) return true;

  const { data: me } = await supabase
    .from("staff")
    .select("branch_id, system_role")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  const staff = (me ?? null) as StaffAuthContext | null;
  if (!staff) return false;
  if (staff.system_role === "owner") return true;

  return staff.system_role === "manager" && staff.branch_id === branchId;
}

export async function updateBranchBookingRules(
  rawInput: unknown
): Promise<ActionResult> {
  const parsed = branchBookingRulesSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Please check the booking rules.",
    };
  }

  const input: UpdateBranchBookingRulesInput = parsed.data;
  const allowed = await canManageBranchRules(input.branchId);
  if (!allowed) return { success: false, error: "Unauthorized" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("branch_booking_rules")
    .upsert(
      {
        branch_id: input.branchId,
        in_spa_start_time: input.inSpaStartTime,
        in_spa_end_time: input.inSpaEndTime,
        home_service_enabled: input.homeServiceEnabled,
        home_service_start_time: input.homeServiceStartTime,
        home_service_end_time: input.homeServiceEndTime,
        travel_buffer_mins: input.travelBufferMins,
        max_advance_booking_days: input.maxAdvanceBookingDays,
      },
      { onConflict: "branch_id" }
    )
    .select("*")
    .single();

  if (error || !data) {
    if (error && isMissingRulesTableError(error.message)) {
      return {
        success: false,
        error: "Booking rules table is not available yet. Run the latest Supabase migration first.",
      };
    }

    return {
      success: false,
      error: error?.message ?? "Could not save booking rules.",
    };
  }

  revalidatePath(`/owner/branches/${input.branchId}`);
  revalidatePath("/owner/branches");
  revalidatePath("/book");

  return { success: true, rules: mapRowToRules(data) };
}

export function isBookingTimeAllowedByRules({
  bookingType,
  startTime,
  rules,
}: {
  bookingType: BookingType;
  startTime: string;
  rules: BranchBookingRules;
}): boolean {
  const slotMinutes = timeToMinutes(startTime);
  if (slotMinutes === null) return false;

  if (bookingType === "home_service") {
    if (!rules.homeServiceEnabled) return false;

    const startMinutes = timeToMinutes(rules.homeServiceStartTime);
    const endMinutes = timeToMinutes(rules.homeServiceEndTime);
    return (
      startMinutes !== null &&
      endMinutes !== null &&
      slotMinutes >= startMinutes &&
      slotMinutes <= endMinutes
    );
  }

  const startMinutes = timeToMinutes(rules.inSpaStartTime);
  const endMinutes = timeToMinutes(rules.inSpaEndTime);
  return (
    startMinutes !== null &&
    endMinutes !== null &&
    slotMinutes >= startMinutes &&
    slotMinutes <= endMinutes
  );
}

export function isBookingDateAllowedByRules({
  date,
  rules,
}: {
  date: string;
  rules: BranchBookingRules;
}): boolean {
  const requested = dateFromYmd(date);
  if (!requested) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const maxDate = new Date(today);
  maxDate.setDate(maxDate.getDate() + rules.maxAdvanceBookingDays);

  return requested >= today && requested <= maxDate;
}

export async function validateBookingAgainstBranchRules({
  branchId,
  bookingType,
  date,
  startTime,
}: {
  branchId: string;
  bookingType: BookingType;
  date: string;
  startTime: string;
}): Promise<BranchRulesValidationResult> {
  const rules = await getBranchBookingRulesOrDefault(branchId);
  const isHomeService = bookingType === "home_service";

  if (isHomeService && !rules.homeServiceEnabled) {
    return {
      ok: false,
      rules,
      message: "Home service is not available for this branch. Please choose in-spa or another branch.",
    };
  }

  if (!isBookingDateAllowedByRules({ date, rules })) {
    return {
      ok: false,
      rules,
      message: `Bookings for this branch can be made up to ${rules.maxAdvanceBookingDays} days in advance.`,
    };
  }

  if (!isBookingTimeAllowedByRules({ bookingType, startTime, rules })) {
    const start = isHomeService
      ? rules.homeServiceStartTime
      : rules.inSpaStartTime;
    const end = isHomeService ? rules.homeServiceEndTime : rules.inSpaEndTime;
    const label = isHomeService ? "Home service" : "In-spa";

    return {
      ok: false,
      rules,
      message: `${label} appointments at this branch are available from ${formatTimeForMessage(start)} to ${formatTimeForMessage(end)}.`,
    };
  }

  return { ok: true, rules };
}
