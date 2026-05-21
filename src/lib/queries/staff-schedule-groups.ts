import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";

type GroupRow = Database["public"]["Tables"]["staff_schedule_groups"]["Row"];
type RuleRow = Database["public"]["Tables"]["staff_group_schedule_rules"]["Row"];

export type StaffScheduleGroup = GroupRow;

export type StaffGroupScheduleRule = RuleRow;

export async function getStaffScheduleGroups(branchId: string): Promise<StaffScheduleGroup[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("staff_schedule_groups")
    .select("*")
    .eq("branch_id", branchId)
    .eq("is_active", true)
    .order("group_name");

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getStaffGroupScheduleRules(groupId: string): Promise<StaffGroupScheduleRule[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("staff_group_schedule_rules")
    .select("*")
    .eq("group_id", groupId)
    .eq("is_active", true)
    .order("day_of_week")
    .order("shift_type");

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getStaffGroupScheduleRulesByBranch(
  branchId: string
): Promise<Record<string, StaffGroupScheduleRule[]>> {
  const groups = await getStaffScheduleGroups(branchId);
  const result: Record<string, StaffGroupScheduleRule[]> = {};

  await Promise.all(
    groups.map(async (group) => {
      const rules = await getStaffGroupScheduleRules(group.id);
      result[group.group_key] = rules;
    })
  );

  return result;
}

export type ScheduleSetupOverview = {
  groups: StaffScheduleGroup[];
  rulesByGroup: Record<string, StaffGroupScheduleRule[]>;
};

export async function getScheduleSetupOverview(branchId: string): Promise<ScheduleSetupOverview> {
  const groups = await getStaffScheduleGroups(branchId);
  const rulesByGroup: Record<string, StaffGroupScheduleRule[]> = {};

  await Promise.all(
    groups.map(async (group) => {
      const rules = await getStaffGroupScheduleRules(group.id);
      rulesByGroup[group.group_key] = rules;
    })
  );

  return { groups, rulesByGroup };
}
