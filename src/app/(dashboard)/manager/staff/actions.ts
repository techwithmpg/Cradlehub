"use server";

import { createClient } from "@/lib/supabase/server";
import {
  setScheduleSchema,
  createOverrideSchema,
  createBlockedTimeSchema,
} from "@/lib/validations/staff";
import { revalidatePath } from "next/cache";

async function getManagerContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: me } = await supabase
    .from("staff")
    .select("id, branch_id, system_role")
    .eq("auth_user_id", user.id)
    .single();
  if (!me || !["manager", "owner"].includes(me.system_role)) return null;
  return { supabase, me };
}

export async function setStaffScheduleAction(rawInput: unknown) {
  const parsed = setScheduleSchema.safeParse(rawInput);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message };

  const ctx = await getManagerContext();
  if (!ctx) return { success: false, error: "Unauthorized" };

  const { error } = await ctx.supabase
    .from("staff_schedules")
    .upsert(
      {
        staff_id:    parsed.data.staffId,
        day_of_week: parsed.data.dayOfWeek,
        start_time:  parsed.data.startTime,
        end_time:    parsed.data.endTime,
        is_active:   parsed.data.isActive,
      },
      { onConflict: "staff_id,day_of_week" }
    );

  if (error) return { success: false, error: error.message };
  revalidatePath("/manager/staff");
  return { success: true };
}

export async function createScheduleOverrideAction(rawInput: unknown) {
  const parsed = createOverrideSchema.safeParse(rawInput);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message };

  const ctx = await getManagerContext();
  if (!ctx) return { success: false, error: "Unauthorized" };

  const { error } = await ctx.supabase
    .from("schedule_overrides")
    .upsert(
      {
        staff_id:      parsed.data.staffId,
        override_date: parsed.data.overrideDate,
        is_day_off:    parsed.data.isDayOff,
        start_time:    parsed.data.startTime ?? null,
        end_time:      parsed.data.endTime   ?? null,
        reason:        parsed.data.reason    ?? null,
        created_by:    ctx.me.id,
      },
      { onConflict: "staff_id,override_date" }
    );

  if (error) return { success: false, error: error.message };
  revalidatePath("/manager/staff");
  return { success: true };
}

export async function createBlockedTimeAction(rawInput: unknown) {
  const parsed = createBlockedTimeSchema.safeParse(rawInput);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message };

  const ctx = await getManagerContext();
  if (!ctx) return { success: false, error: "Unauthorized" };

  const { error } = await ctx.supabase
    .from("blocked_times")
    .insert({
      staff_id:   parsed.data.staffId,
      block_date: parsed.data.blockDate,
      start_time: parsed.data.startTime,
      end_time:   parsed.data.endTime,
      reason:     parsed.data.reason,
      created_by: ctx.me.id,
    });

  if (error) return { success: false, error: error.message };
  revalidatePath("/manager/staff");
  return { success: true };
}
