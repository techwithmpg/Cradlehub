"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { invalidateCrmWorkspace, invalidateManagerWorkspace } from "@/lib/cache/cache-tags";
import { isDevAuthBypassEnabled } from "@/lib/dev-bypass";
import { isOwner } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const uuid = z.guid("Invalid ID");
const timeStr = z.string().regex(/^\d{2}:\d{2}$/, "Time must be HH:MM");

const weeklyDaySchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    isActive: z.boolean(),
    startTime: timeStr,
    endTime: timeStr,
  })
  .superRefine((day, ctx) => {
    if (day.isActive && day.startTime >= day.endTime) {
      ctx.addIssue({
        code: "custom",
        message: "Start time must be before end time.",
        path: ["endTime"],
      });
    }
  });

const updateWeeklyScheduleSchema = z.object({
  branchId: uuid,
  staffId: uuid,
  days: z.array(weeklyDaySchema).length(7, "Provide all seven days."),
});

type ScheduleActionResult =
  | { ok: true; rowsWritten: number }
  | { ok: false; error: string };

const SCHEDULE_EDIT_ROLES = new Set([
  "owner",
  "manager",
  "assistant_manager",
  "store_manager",
  "crm",
  "csr_head",
]);

async function getScheduleEditContext(branchId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  if (isDevAuthBypassEnabled()) {
    return {
      admin: createAdminClient(),
      actorBranchId: branchId,
      actorRole: "owner",
    };
  }

  const { data: me, error } = await supabase
    .from("staff")
    .select("id, branch_id, system_role")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !me) return null;
  if (!SCHEDULE_EDIT_ROLES.has(me.system_role)) return null;
  if (!isOwner(me.system_role) && me.branch_id !== branchId) return null;

  return {
    admin: createAdminClient(),
    actorBranchId: me.branch_id,
    actorRole: me.system_role,
  };
}

function revalidateSchedulePaths(branchId: string) {
  revalidatePath("/crm/schedule");
  revalidatePath("/crm/staff-availability");
  revalidatePath("/crm/availability");
  revalidatePath("/crm/today");
  revalidatePath("/crm/setup");
  revalidatePath("/manager/schedule");
  revalidatePath("/manager/staff-availability");
  revalidatePath("/staff-portal");
  revalidatePath("/staff-portal/schedule");
  revalidatePath("/book");
  invalidateCrmWorkspace(branchId);
  invalidateManagerWorkspace(branchId);
}

export async function updateCrmStaffWeeklyAvailabilityAction(
  rawInput: unknown
): Promise<ScheduleActionResult> {
  const parsed = updateWeeklyScheduleSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid schedule." };
  }

  const { branchId, staffId, days } = parsed.data;
  const ctx = await getScheduleEditContext(branchId);
  if (!ctx) return { ok: false, error: "Unauthorized" };

  const { data: staff, error: staffError } = await ctx.admin
    .from("staff")
    .select("id, branch_id")
    .eq("id", staffId)
    .maybeSingle();

  if (staffError) return { ok: false, error: staffError.message };
  if (!staff) return { ok: false, error: "Staff member not found." };
  if (staff.branch_id !== branchId) {
    return { ok: false, error: "This staff member does not belong to this branch." };
  }

  const rows = days.map((day) => ({
    staff_id: staffId,
    day_of_week: day.dayOfWeek,
    start_time: day.startTime,
    end_time: day.endTime,
    is_active: day.isActive,
    shift_type: "single",
  }));

  const { error } = await ctx.admin
    .from("staff_schedules")
    .upsert(rows, { onConflict: "staff_id,day_of_week,shift_type" });

  if (error) return { ok: false, error: error.message };

  revalidateSchedulePaths(branchId);
  return { ok: true, rowsWritten: rows.length };
}
