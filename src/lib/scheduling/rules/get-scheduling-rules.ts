import { createClient } from "@/lib/supabase/server";
import type { SchedulingRules } from "../types";

const DEFAULTS: Omit<SchedulingRules, "id" | "branch_id" | "created_at" | "updated_at"> = {
  min_daily_staff:                    1,
  min_daily_therapists:               1,
  min_daily_csr:                      1,
  min_daily_drivers:                  0,
  min_daily_utility:                  0,
  default_days_off_per_week:          1,
  max_same_role_off_per_day:          2,
  max_therapists_off_per_day:         1,
  protect_weekends:                   true,
  default_break_minutes:              60,
  auto_breaks_enabled:                true,
  max_working_hours_per_day:          8,
  max_services_per_staff_per_day:     null,
  auto_generate_breaks:               true,
  auto_generate_travel_buffers:       true,
  auto_generate_room_reset_buffers:   false,
  room_reset_buffer_minutes:          15,
  home_service_travel_buffer_minutes: 30,
  suggestions_require_manager_approval: true,
};

export async function getSchedulingRules(branchId: string): Promise<SchedulingRules> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("scheduling_rules")
    .select("*")
    .eq("branch_id", branchId)
    .maybeSingle();

  if (!data) {
    const now = new Date().toISOString();
    return {
      id:         "",
      branch_id:  branchId,
      created_at: now,
      updated_at: now,
      ...DEFAULTS,
    };
  }

  return {
    ...data,
    max_working_hours_per_day: Number(data.max_working_hours_per_day),
  } as SchedulingRules;
}
