import "server-only";

import { canonicalizeSystemRole } from "@/constants/staff";
import { BRANCH_TIMEZONE, addDaysToYmd, getBranchTime } from "@/lib/engine/slot-time";
import { getResolvedStaffSchedulesForDate } from "@/lib/queries/resolved-staff-schedules";
import { scheduleCoversLocalMinute } from "@/lib/notifications/pending-booking-policy";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Fail-closed roster eligibility for pending booking reminders.
 * A scheduled CSR is NOT necessarily present at the desk; live attendance or
 * a separately approved duty-handover signal is needed to prove presence.
 * Missing/invalid schedules never authorize off-hours push.
 */
export async function getOnDutyCrmStaffIds(input: {
  branchId: string;
  now?: Date;
  admin?: ReturnType<typeof createAdminClient>;
}): Promise<Set<string>> {
  const admin = input.admin ?? createAdminClient();
  const { data, error } = await admin
    .from("staff")
    .select("id, staff_type, system_role")
    .eq("branch_id", input.branchId)
    .eq("is_active", true);
  if (error) throw new Error("Unable to resolve CRM duty staff.");

  const staff = (data ?? []).filter(
    (member) => canonicalizeSystemRole(member.system_role) === "crm"
  );
  if (staff.length === 0) return new Set();

  const { ymd, minutesIntoDay } = getBranchTime(input.now ?? new Date(), BRANCH_TIMEZONE);
  const previousDate = addDaysToYmd(ymd, -1);
  const [today, yesterday] = await Promise.all([
    getResolvedStaffSchedulesForDate({
      supabase: admin,
      branchId: input.branchId,
      date: ymd,
      staff,
    }),
    getResolvedStaffSchedulesForDate({
      supabase: admin,
      branchId: input.branchId,
      date: previousDate,
      staff,
    }),
  ]);

  return new Set(
    staff
      .filter(
        (member) =>
          scheduleCoversLocalMinute(today.get(member.id), minutesIntoDay) ||
          scheduleCoversLocalMinute(yesterday.get(member.id), minutesIntoDay, true)
      )
      .map((member) => member.id)
  );
}
