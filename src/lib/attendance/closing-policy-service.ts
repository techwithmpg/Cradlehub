import "server-only";

import type { AttendanceDb } from "@/lib/attendance/db";
import {
  resolveAttendancePolicy,
  resolveAttendanceStaffCategory,
  type AttendanceCategoryRuleValues,
  type ResolvedAttendancePolicy,
} from "@/lib/attendance/closing-policy";
import type { AttendanceSettings } from "@/lib/attendance/types";

type CategoryRuleRow = AttendanceCategoryRuleValues & {
  id: string;
};

export async function getEffectiveAttendancePolicy(params: {
  db: AttendanceDb;
  settings: AttendanceSettings;
  branchId: string;
  staffType?: string | null;
  systemRole?: string | null;
  shiftType?: string | null;
  businessDate: string;
  scheduledEndAt?: string | null;
  effectiveAt?: string;
}): Promise<ResolvedAttendancePolicy> {
  const effectiveAt = params.effectiveAt ?? new Date().toISOString();
  const category = resolveAttendanceStaffCategory(params);
  const [categoryRule, branchVersion] = await Promise.all([
    params.db
      .from("attendance_staff_category_rules")
      .select(
        "id, late_grace_minutes, early_leave_threshold_minutes, overtime_threshold_minutes, active_service_blocks_clock_out, crm_closing_policy_enabled"
      )
      .eq("branch_id", params.branchId)
      .eq("staff_category", category)
      .lte("effective_from", effectiveAt)
      .or(`effective_until.is.null,effective_until.gt.${effectiveAt}`)
      .order("effective_from", { ascending: false })
      .limit(1)
      .maybeSingle(),
    params.db
      .from("attendance_rule_versions")
      .select("id")
      .eq("branch_id", params.branchId)
      .lte("effective_from", effectiveAt)
      .order("effective_from", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (categoryRule.error) {
    throw new Error(`Attendance category rule could not be loaded: ${categoryRule.error.message}`);
  }
  if (branchVersion.error) {
    throw new Error(`Attendance branch rule version could not be loaded: ${branchVersion.error.message}`);
  }

  const override = categoryRule.data as CategoryRuleRow | null;
  return resolveAttendancePolicy({
    settings: params.settings,
    categoryRule: override,
    systemRole: params.systemRole,
    staffType: params.staffType,
    shiftType: params.shiftType,
    businessDate: params.businessDate,
    scheduledEndAt: params.scheduledEndAt,
    branchRuleVersionId: branchVersion.data?.id ?? null,
    categoryRuleId: override?.id ?? null,
  });
}
