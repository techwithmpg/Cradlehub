"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canAdjustStaffSchedule, isOwner } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isDevAuthBypassEnabled } from "@/lib/dev-bypass";
import type { Database } from "@/types/supabase";

const uuid = z.guid("Invalid ID");
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");
const timeStr = z.string().regex(/^\d{2}:\d{2}$/, "Time must be HH:MM");

const adjustmentSchema = z
  .object({
    staffId: uuid,
    branchId: uuid,
    date: dateStr,
    adjustmentType: z.enum([
      "working_hours",
      "day_off",
      "blocked_time",
      "remove_override",
      "remove_block",
    ]),
    startTime: timeStr.optional(),
    endTime: timeStr.optional(),
    blockId: uuid.optional(),
    reason: z.string().trim().max(200).optional(),
  })
  .superRefine((input, ctx) => {
    if (["working_hours", "blocked_time"].includes(input.adjustmentType)) {
      if (!input.startTime || !input.endTime) {
        ctx.addIssue({
          code: "custom",
          message: "Start and end time are required.",
          path: ["startTime"],
        });
        return;
      }
      if (input.startTime >= input.endTime) {
        ctx.addIssue({
          code: "custom",
          message: "Start time must be before end time.",
          path: ["endTime"],
        });
      }
    }

    if (input.adjustmentType === "remove_block" && !input.blockId) {
      ctx.addIssue({
        code: "custom",
        message: "Select a blocked time to remove.",
        path: ["blockId"],
      });
    }
  });

export type StaffScheduleAdjustmentInput = z.infer<typeof adjustmentSchema>;

type AdjustmentResult = {
  success: boolean;
  title?: string;
  description?: string;
  error?: string;
};

type ActorContext = {
  actorId: string | null;
  actorRole: string;
  actorBranchId: string | null;
};

type StaffBranchRow = Pick<
  Database["public"]["Tables"]["staff"]["Row"],
  "id" | "branch_id" | "full_name" | "nickname"
>;

type ScheduleOverrideInsert = Database["public"]["Tables"]["schedule_overrides"]["Insert"];
type BlockedTimeInsert = Database["public"]["Tables"]["blocked_times"]["Insert"];

async function getActorContext(): Promise<ActorContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  if (isDevAuthBypassEnabled()) {
    return { actorId: null, actorRole: "owner", actorBranchId: null };
  }

  const { data: me, error } = await supabase
    .from("staff")
    .select("id, branch_id, system_role")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !me) return null;

  return {
    actorId: me.id,
    actorRole: me.system_role,
    actorBranchId: me.branch_id,
  };
}

function revalidateScheduleSurfaces() {
  revalidatePath("/manager/schedule");
  revalidatePath("/crm/schedule");
  revalidatePath("/manager/bookings");
  revalidatePath("/crm/bookings");
  revalidatePath("/manager");
  revalidatePath("/crm");
  revalidatePath("/manager/staff-availability");
  revalidatePath("/crm/staff-availability");
  revalidatePath("/staff-portal");
  revalidatePath("/staff-portal/schedule");
  revalidatePath("/book");
}

function displayName(staff: StaffBranchRow): string {
  return staff.nickname ? `${staff.full_name} (${staff.nickname})` : staff.full_name;
}

function formatTime(value: string): string {
  const [rawHour, rawMinute] = value.split(":").map(Number);
  const hour = rawHour ?? 0;
  const minute = rawMinute ?? 0;
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${displayHour}:${String(minute).padStart(2, "0")} ${period}`;
}

export async function adjustStaffScheduleAction(
  rawInput: unknown
): Promise<AdjustmentResult> {
  const parsed = adjustmentSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid adjustment." };
  }

  const actor = await getActorContext();
  if (!actor || !canAdjustStaffSchedule(actor.actorRole)) {
    return { success: false, error: "You do not have permission to adjust staff schedules." };
  }

  const input = parsed.data;
  if (!isOwner(actor.actorRole) && actor.actorBranchId !== input.branchId) {
    return { success: false, error: "You can only adjust schedules for your assigned branch." };
  }

  const admin = createAdminClient();
  const { data: staff, error: staffError } = await admin
    .from("staff")
    .select("id, branch_id, full_name, nickname")
    .eq("id", input.staffId)
    .maybeSingle();

  if (staffError) return { success: false, error: staffError.message };
  if (!staff) return { success: false, error: "Staff member not found." };
  if (staff.branch_id !== input.branchId) {
    return { success: false, error: "This staff member does not belong to the selected branch." };
  }

  const staffName = displayName(staff as StaffBranchRow);

  if (input.adjustmentType === "working_hours") {
    const payload: ScheduleOverrideInsert = {
      staff_id: input.staffId,
      override_date: input.date,
      is_day_off: false,
      start_time: input.startTime!,
      end_time: input.endTime!,
      reason: input.reason || null,
      created_by: actor.actorId,
    };

    const { error } = await admin
      .from("schedule_overrides")
      .upsert(payload, { onConflict: "staff_id,override_date" });

    if (error) return { success: false, error: error.message };
    revalidateScheduleSurfaces();
    return {
      success: true,
      title: "Schedule adjusted",
      description: `${staffName} is now available from ${formatTime(input.startTime!)} to ${formatTime(input.endTime!)}.`,
    };
  }

  if (input.adjustmentType === "day_off") {
    const payload: ScheduleOverrideInsert = {
      staff_id: input.staffId,
      override_date: input.date,
      is_day_off: true,
      start_time: null,
      end_time: null,
      reason: input.reason || null,
      created_by: actor.actorId,
    };

    const { error } = await admin
      .from("schedule_overrides")
      .upsert(payload, { onConflict: "staff_id,override_date" });

    if (error) return { success: false, error: error.message };
    revalidateScheduleSurfaces();
    return {
      success: true,
      title: "Day off saved",
      description: `${staffName} will not receive bookings on this date.`,
    };
  }

  if (input.adjustmentType === "blocked_time") {
    const payload: BlockedTimeInsert = {
      staff_id: input.staffId,
      block_date: input.date,
      start_time: input.startTime!,
      end_time: input.endTime!,
      reason: input.reason || "other",
      created_by: actor.actorId,
    };

    const { error } = await admin.from("blocked_times").insert(payload);
    if (error) return { success: false, error: error.message };
    revalidateScheduleSurfaces();
    return {
      success: true,
      title: "Blocked time added",
      description: `${staffName} is unavailable from ${formatTime(input.startTime!)} to ${formatTime(input.endTime!)}.`,
    };
  }

  if (input.adjustmentType === "remove_override") {
    const { error } = await admin
      .from("schedule_overrides")
      .delete()
      .eq("staff_id", input.staffId)
      .eq("override_date", input.date);

    if (error) return { success: false, error: error.message };
    revalidateScheduleSurfaces();
    return {
      success: true,
      title: "Override removed",
      description: `${staffName} now follows the normal weekly schedule.`,
    };
  }

  const { data: block, error: blockError } = await admin
    .from("blocked_times")
    .select("id, staff_id, block_date")
    .eq("id", input.blockId!)
    .maybeSingle();

  if (blockError) return { success: false, error: blockError.message };
  if (!block || block.staff_id !== input.staffId) {
    return { success: false, error: "Blocked time not found for this staff member." };
  }
  if (block.block_date !== input.date) {
    return { success: false, error: "Blocked time does not match the selected date." };
  }

  const { error } = await admin
    .from("blocked_times")
    .delete()
    .eq("id", input.blockId!)
    .eq("staff_id", input.staffId);

  if (error) return { success: false, error: error.message };
  revalidateScheduleSurfaces();
  return {
    success: true,
    title: "Blocked time removed",
    description: `${staffName} can be booked again during that window if the schedule allows it.`,
  };
}
