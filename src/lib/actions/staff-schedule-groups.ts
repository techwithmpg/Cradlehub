"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const uuid = z.guid("Invalid ID");

const upsertGroupRuleSchema = z.object({
  groupId: uuid,
  dayOfWeek: z.number().int().min(0).max(6),
  shiftType: z.enum(["single", "opening", "closing"]).default("single"),
  startTime: z.union([z.string().regex(/^\d{2}:\d{2}$/, "Time must be HH:MM"), z.null()]).optional(),
  endTime: z.union([z.string().regex(/^\d{2}:\d{2}$/, "Time must be HH:MM"), z.null()]).optional(),
  isDayOff: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export type UpsertGroupRuleInput = z.infer<typeof upsertGroupRuleSchema>;

export async function upsertStaffGroupScheduleRuleAction(
  input: UpsertGroupRuleInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const parsed = upsertGroupRuleSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
    }

    const supabase = await createClient();

    const { error } = await supabase
      .from("staff_group_schedule_rules")
      .upsert(
        {
          group_id: parsed.data.groupId,
          day_of_week: parsed.data.dayOfWeek,
          shift_type: parsed.data.shiftType,
          start_time: parsed.data.isDayOff ? null : parsed.data.startTime ?? null,
          end_time: parsed.data.isDayOff ? null : parsed.data.endTime ?? null,
          is_day_off: parsed.data.isDayOff,
          is_active: parsed.data.isActive,
        },
        { onConflict: "group_id,day_of_week,shift_type" }
      );

    if (error) {
      console.error("[upsertStaffGroupScheduleRuleAction] failed", error);
      return { success: false, error: error.message };
    }

    revalidatePath("/crm/staff-availability");
    revalidatePath("/crm/availability");
    return { success: true };
  } catch (err) {
    console.error("[upsertStaffGroupScheduleRuleAction] exception", err);
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

const deleteGroupRuleSchema = z.object({
  groupId: uuid,
  dayOfWeek: z.number().int().min(0).max(6),
  shiftType: z.enum(["single", "opening", "closing"]).default("single"),
});

export type DeleteGroupRuleInput = z.infer<typeof deleteGroupRuleSchema>;

export async function deleteStaffGroupScheduleRuleAction(
  input: DeleteGroupRuleInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const parsed = deleteGroupRuleSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
    }

    const supabase = await createClient();

    const { error } = await supabase
      .from("staff_group_schedule_rules")
      .delete()
      .eq("group_id", parsed.data.groupId)
      .eq("day_of_week", parsed.data.dayOfWeek)
      .eq("shift_type", parsed.data.shiftType);

    if (error) {
      console.error("[deleteStaffGroupScheduleRuleAction] failed", error);
      return { success: false, error: error.message };
    }

    revalidatePath("/crm/staff-availability");
    revalidatePath("/crm/availability");
    return { success: true };
  } catch (err) {
    console.error("[deleteStaffGroupScheduleRuleAction] exception", err);
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

const applyGroupSchema = z.object({
  groupId: uuid,
  staffIds: z.array(uuid).optional(),
  mode: z.enum(["preview", "apply"]).default("preview"),
});

export type ApplyGroupInput = z.infer<typeof applyGroupSchema>;

export async function applyGroupScheduleToStaffAction(
  input: ApplyGroupInput
): Promise<{ success: boolean; error?: string; affected?: number; preview?: Array<{ staffId: string; staffName: string; dayOfWeek: number; startTime: string; endTime: string }> }> {
  try {
    const parsed = applyGroupSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
    }

    const admin = createAdminClient();

    // Resolve group info
    const { data: group, error: groupError } = await admin
      .from("staff_schedule_groups")
      .select("branch_id, group_key")
      .eq("id", parsed.data.groupId)
      .single();

    if (groupError || !group) {
      return { success: false, error: groupError?.message ?? "Group not found" };
    }

    // Fetch group rules
    const { data: rules, error: rulesError } = await admin
      .from("staff_group_schedule_rules")
      .select("*")
      .eq("group_id", parsed.data.groupId)
      .eq("is_active", true)
      .eq("is_day_off", false);

    if (rulesError) {
      return { success: false, error: rulesError.message };
    }

    if (!rules || rules.length === 0) {
      return { success: false, error: "No active group rules to apply" };
    }

    // Resolve target staff
    let staffIds = parsed.data.staffIds;
    if (!staffIds || staffIds.length === 0) {
      const { data: staffRows, error: staffError } = await admin
        .from("staff")
        .select("id")
        .eq("branch_id", group.branch_id)
        .eq("is_active", true);

      if (staffError) {
        return { success: false, error: staffError.message };
      }

      staffIds = (staffRows ?? []).map((s) => s.id);
    }

    if (parsed.data.mode === "preview") {
      const { data: staffNames } = await admin
        .from("staff")
        .select("id, full_name")
        .in("id", staffIds)
        .eq("branch_id", group.branch_id);

      const nameMap = new Map((staffNames ?? []).map((s) => [s.id, s.full_name]));
      const preview = rules.flatMap((rule) =>
        staffIds!.map((sid) => ({
          staffId: sid,
          staffName: nameMap.get(sid) ?? sid,
          dayOfWeek: rule.day_of_week,
          startTime: rule.start_time ?? "09:00",
          endTime: rule.end_time ?? "18:00",
        }))
      );

      return { success: true, affected: preview.length, preview: preview.slice(0, 50) };
    }

    // Apply mode: upsert individual staff_schedules
    const upserts = rules.flatMap((rule) =>
      staffIds!.map((sid) => ({
        staff_id: sid,
        day_of_week: rule.day_of_week,
        shift_type: rule.shift_type,
        start_time: rule.start_time ?? "09:00",
        end_time: rule.end_time ?? "18:00",
        is_active: true,
      }))
    );

    const { error: upsertError } = await admin
      .from("staff_schedules")
      .upsert(upserts, { onConflict: "staff_id,day_of_week,shift_type" });

    if (upsertError) {
      console.error("[applyGroupScheduleToStaffAction] upsert failed", upsertError);
      return { success: false, error: upsertError.message };
    }

    revalidatePath("/crm/staff-availability");
    revalidatePath("/crm/availability");
    return { success: true, affected: upserts.length };
  } catch (err) {
    console.error("[applyGroupScheduleToStaffAction] exception", err);
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
