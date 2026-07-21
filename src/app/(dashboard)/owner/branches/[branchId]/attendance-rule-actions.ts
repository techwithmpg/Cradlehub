"use server";

import { revalidatePath } from "next/cache";

import { isSuperAdmin } from "@/lib/auth/super-admin";
import { isDevAuthBypassEnabled } from "@/lib/dev-bypass";
import { branchDateTimeToIsoInTimezone } from "@/lib/attendance/shift-instance";
import { getAttendanceSettings } from "@/lib/attendance/queries";
import { getBranchAttendanceRulesData } from "@/lib/attendance/branch-attendance-rules";
import {
  ATTENDANCE_STAFF_CATEGORIES,
  type AttendanceStaffCategory,
} from "@/lib/attendance/closing-policy";
import {
  validateBranchAttendanceRulesInput,
  validateCategoryAttendanceRuleInput,
} from "@/lib/attendance/closing-policy-validation";
import { logBusinessEvent, logError } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/supabase";

export type SaveBranchAttendanceRulesInput = {
  branchId: string;
  timezone: string;
  attendanceDayBoundary: string;
  lateGraceMinutes: number;
  earlyLeaveThresholdMinutes: number;
  overtimeThresholdMinutes: number;
  duplicateScanWindowSeconds: number;
  activeServiceBlocksClockOut: boolean;
  branchOperatingCloseTime: string;
  crmClosingPolicyEnabled: boolean;
  crmClosingBufferMinutes: number;
  crmManagerEscalationDelayMinutes: number;
  crmHardCutoffDelayMinutes: number;
  effectiveDate: string | null;
  reason: string;
};

export type SaveAttendanceCategoryRuleInput = {
  branchId: string;
  category: AttendanceStaffCategory;
  lateGraceMinutes: number | null;
  earlyLeaveThresholdMinutes: number | null;
  overtimeThresholdMinutes: number | null;
  serviceCleanupBufferMinutes: number | null;
  homeServiceWrapUpBufferMinutes: number | null;
  driverReturnBufferMinutes: number | null;
  finalClientReleaseEnabled: boolean | null;
  portalClosingShiftEnabled: boolean | null;
  activeServiceBlocksClockOut: boolean | null;
  crmClosingPolicyEnabled: boolean | null;
  effectiveDate: string | null;
  reason: string;
};

type OwnerContext = {
  actorStaffId: string | null;
};

async function requireOwnerContext(): Promise<OwnerContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: actor } = await supabase
    .from("staff")
    .select("id, system_role")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (
    actor?.system_role !== "owner" &&
    !isSuperAdmin(user.id) &&
    !isDevAuthBypassEnabled()
  ) {
    return null;
  }
  return { actorStaffId: actor?.id ?? null };
}

async function effectiveFrom(params: {
  branchId: string;
  effectiveDate: string | null;
}): Promise<string> {
  if (!params.effectiveDate) return new Date().toISOString();
  const settings = await getAttendanceSettings(params.branchId);
  return branchDateTimeToIsoInTimezone({
    date: params.effectiveDate,
    time: settings.attendance_day_boundary,
    timezone: settings.timezone,
  });
}

async function branchExists(branchId: string): Promise<boolean> {
  const { data } = await createAdminClient()
    .from("branches")
    .select("id")
    .eq("id", branchId)
    .maybeSingle();
  return Boolean(data);
}

export async function saveBranchAttendanceRulesAction(
  input: SaveBranchAttendanceRulesInput
): Promise<
  | { success: true; message: string; data: Awaited<ReturnType<typeof getBranchAttendanceRulesData>> }
  | { success: false; error: string }
> {
  const owner = await requireOwnerContext();
  if (!owner) return { success: false, error: "Unauthorized" };
  if (!input.branchId || !(await branchExists(input.branchId))) {
    return { success: false, error: "Branch was not found." };
  }
  const validationError = validateBranchAttendanceRulesInput(input);
  if (validationError) return { success: false, error: validationError };

  const ruleValues = {
    timezone: input.timezone.trim(),
    attendance_day_boundary: input.attendanceDayBoundary,
    late_grace_minutes: input.lateGraceMinutes,
    early_leave_threshold_minutes: input.earlyLeaveThresholdMinutes,
    overtime_threshold_minutes: input.overtimeThresholdMinutes,
    duplicate_scan_window_seconds: input.duplicateScanWindowSeconds,
    active_service_blocks_clock_out: input.activeServiceBlocksClockOut,
    branch_operating_close_time: input.branchOperatingCloseTime,
    crm_closing_policy_enabled: input.crmClosingPolicyEnabled,
    crm_closing_buffer_minutes: input.crmClosingBufferMinutes,
    crm_manager_escalation_delay_minutes: input.crmManagerEscalationDelayMinutes,
    crm_hard_cutoff_delay_minutes: input.crmHardCutoffDelayMinutes,
  };

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .rpc("save_attendance_branch_rule_version", {
        p_branch_id: input.branchId,
        p_actor_staff_id: owner.actorStaffId as string,
        p_effective_from: await effectiveFrom(input),
        p_rule_values: ruleValues as Json,
        p_reason: input.reason.trim(),
      })
      .maybeSingle();
    if (error || !data?.success) {
      logError("attendance.branch_rules.save_failed", {
        branchId: input.branchId,
        error,
        code: data?.code,
      });
      return { success: false, error: data?.message ?? "Attendance rules could not be saved." };
    }
    revalidatePath(`/owner/branches/${input.branchId}`);
    logBusinessEvent("attendance.branch_rules.saved", {
      branchId: input.branchId,
      ruleVersionId: data.rule_version_id,
      effectiveDate: input.effectiveDate,
    });
    return {
      success: true,
      message: "Attendance rules saved.",
      data: await getBranchAttendanceRulesData(input.branchId),
    };
  } catch (error) {
    logError("attendance.branch_rules.save_failed", { branchId: input.branchId, error });
    return { success: false, error: "Attendance rules could not be saved." };
  }
}

export async function saveAttendanceCategoryRuleAction(
  input: SaveAttendanceCategoryRuleInput
): Promise<
  | { success: true; message: string; data: Awaited<ReturnType<typeof getBranchAttendanceRulesData>> }
  | { success: false; error: string }
> {
  const owner = await requireOwnerContext();
  if (!owner) return { success: false, error: "Unauthorized" };
  if (!input.branchId || !(await branchExists(input.branchId))) {
    return { success: false, error: "Branch was not found." };
  }
  if (!ATTENDANCE_STAFF_CATEGORIES.includes(input.category)) {
    return { success: false, error: "Staff category is invalid." };
  }
  const validationError = validateCategoryAttendanceRuleInput(input);
  if (validationError) return { success: false, error: validationError };

  const ruleValues = {
    late_grace_minutes: input.lateGraceMinutes,
    early_leave_threshold_minutes: input.earlyLeaveThresholdMinutes,
    overtime_threshold_minutes: input.overtimeThresholdMinutes,
    active_service_blocks_clock_out: input.activeServiceBlocksClockOut,
    crm_closing_policy_enabled: input.crmClosingPolicyEnabled,
    service_cleanup_buffer_minutes: input.serviceCleanupBufferMinutes,
    home_service_wrap_up_buffer_minutes: input.homeServiceWrapUpBufferMinutes,
    driver_return_buffer_minutes: input.driverReturnBufferMinutes,
    final_client_release_enabled: input.finalClientReleaseEnabled,
    portal_closing_shift_enabled: input.portalClosingShiftEnabled,
  };
  try {
    const { data, error } = await createAdminClient()
      .rpc("save_attendance_category_rule", {
        p_branch_id: input.branchId,
        p_actor_staff_id: owner.actorStaffId as string,
        p_staff_category: input.category,
        p_effective_from: await effectiveFrom(input),
        p_rule_values: ruleValues as Json,
        p_reason: input.reason.trim(),
      })
      .maybeSingle();
    if (error || !data?.success) {
      logError("attendance.category_rule.save_failed", {
        branchId: input.branchId,
        category: input.category,
        error,
        code: data?.code,
      });
      return { success: false, error: data?.message ?? "Category override could not be saved." };
    }
    revalidatePath(`/owner/branches/${input.branchId}`);
    logBusinessEvent("attendance.category_rule.saved", {
      branchId: input.branchId,
      category: input.category,
      categoryRuleId: data.category_rule_id,
      effectiveDate: input.effectiveDate,
    });
    return {
      success: true,
      message: "Category override saved.",
      data: await getBranchAttendanceRulesData(input.branchId),
    };
  } catch (error) {
    logError("attendance.category_rule.save_failed", {
      branchId: input.branchId,
      category: input.category,
      error,
    });
    return { success: false, error: "Category override could not be saved." };
  }
}
