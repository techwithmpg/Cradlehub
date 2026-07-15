import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { asAttendanceDb } from "@/lib/attendance/db";
import { getAttendanceSettings } from "@/lib/attendance/queries";
import { getAttendanceBranchNow } from "@/lib/attendance/shift-instance";
import {
  ATTENDANCE_STAFF_CATEGORIES,
  ATTENDANCE_STAFF_CATEGORY_LABELS,
  resolveAttendancePolicy,
  resolveAttendanceStaffCategory,
  type AttendanceCategoryRuleValues,
  type AttendanceStaffCategory,
  type ResolvedAttendancePolicy,
} from "@/lib/attendance/closing-policy";
import type { AttendanceSettings } from "@/lib/attendance/types";
import type { Json } from "@/types/supabase";

export type BranchAttendanceCategoryRule = {
  category: AttendanceStaffCategory;
  label: string;
  ruleId: string | null;
  effectiveFrom: string | null;
  effectiveUntil: string | null;
  override: AttendanceCategoryRuleValues;
  resolved: {
    lateGraceMinutes: number;
    earlyLeaveThresholdMinutes: number;
    overtimeThresholdMinutes: number;
    activeServiceBlocksClockOut: boolean;
    crmClosingPolicyEnabled: boolean;
    serviceCleanupBufferMinutes?: number;
    homeServiceWrapUpBufferMinutes?: number;
    driverReturnBufferMinutes?: number;
    finalClientReleaseEnabled?: boolean;
    portalClosingShiftEnabled?: boolean;
  };
};

export type AttendanceRuleHistoryItem = {
  id: string;
  scope: "branch" | "category";
  category: AttendanceStaffCategory | null;
  effectiveFrom: string;
  effectiveUntil: string | null;
  reason: string;
  changedByName: string | null;
  createdAt: string;
  previousValues: Json;
  newValues: Json;
};

export type BranchAttendanceRulesData = {
  settings: AttendanceSettings;
  previewBusinessDate: string;
  closingPreview: ResolvedAttendancePolicy;
  categories: BranchAttendanceCategoryRule[];
  history: AttendanceRuleHistoryItem[];
  affectedClosingScheduleRows: number;
  scheduler: {
    sourceConfigured: true;
    lastRunAt: string | null;
    lastError: string | null;
    recentlyObserved: boolean;
    nextExpectedRunAt: string | null;
  };
};

type CategoryRuleDbRow = {
  id: string;
  staff_category: AttendanceStaffCategory;
  effective_from: string;
  effective_until: string | null;
  late_grace_minutes: number | null;
  early_leave_threshold_minutes: number | null;
  overtime_threshold_minutes: number | null;
  active_service_blocks_clock_out: boolean | null;
  crm_closing_policy_enabled: boolean | null;
  service_cleanup_buffer_minutes: number | null;
  home_service_wrap_up_buffer_minutes: number | null;
  driver_return_buffer_minutes: number | null;
  final_client_release_enabled: boolean | null;
  portal_closing_shift_enabled: boolean | null;
  reason: string;
  created_at: string;
  changed_by_staff?:
    | { full_name: string | null }
    | Array<{ full_name: string | null }>
    | null;
  previous_values?: Json;
};

function first<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function emptyOverride(): AttendanceCategoryRuleValues {
  return {
    late_grace_minutes: null,
    early_leave_threshold_minutes: null,
    overtime_threshold_minutes: null,
    active_service_blocks_clock_out: null,
    crm_closing_policy_enabled: null,
    service_cleanup_buffer_minutes: null,
    home_service_wrap_up_buffer_minutes: null,
    driver_return_buffer_minutes: null,
    final_client_release_enabled: null,
    portal_closing_shift_enabled: null,
  };
}

function nextAttendanceSafetyRun(now: Date): string {
  const schedules = [
    [15, 0],
    [15, 30],
    [16, 0],
    [16, 10],
  ] as const;
  for (let dayOffset = 0; dayOffset <= 1; dayOffset += 1) {
    for (const [hour, minute] of schedules) {
      const candidate = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() + dayOffset,
        hour,
        minute
      ));
      if (candidate.getTime() > now.getTime()) return candidate.toISOString();
    }
  }
  return new Date(now.getTime() + 24 * 60 * 60_000).toISOString();
}

export async function getBranchAttendanceRulesData(
  branchId: string
): Promise<BranchAttendanceRulesData> {
  const admin = asAttendanceDb(createAdminClient());
  const settings = await getAttendanceSettings(branchId);
  const now = new Date();
  const nowIso = now.toISOString();
  const branchNow = getAttendanceBranchNow(settings, now);

  const [categoryRulesResult, branchHistoryResult, categoryHistoryResult, schedulesResult] =
    await Promise.all([
      admin
        .from("attendance_staff_category_rules")
        .select(
          "id, staff_category, effective_from, effective_until, late_grace_minutes, early_leave_threshold_minutes, overtime_threshold_minutes, active_service_blocks_clock_out, crm_closing_policy_enabled, service_cleanup_buffer_minutes, home_service_wrap_up_buffer_minutes, driver_return_buffer_minutes, final_client_release_enabled, portal_closing_shift_enabled, reason, created_at"
        )
        .eq("branch_id", branchId)
        .lte("effective_from", nowIso)
        .or(`effective_until.is.null,effective_until.gt.${nowIso}`)
        .order("effective_from", { ascending: false }),
      admin
        .from("attendance_rule_versions")
        .select(
          "id, effective_from, rule_values, previous_values, reason, created_at, changed_by_staff:staff!attendance_rule_versions_changed_by_fkey(full_name)"
        )
        .eq("branch_id", branchId)
        .order("created_at", { ascending: false })
        .limit(20),
      admin
        .from("attendance_staff_category_rules")
        .select(
          "id, staff_category, effective_from, effective_until, late_grace_minutes, early_leave_threshold_minutes, overtime_threshold_minutes, active_service_blocks_clock_out, crm_closing_policy_enabled, service_cleanup_buffer_minutes, home_service_wrap_up_buffer_minutes, driver_return_buffer_minutes, final_client_release_enabled, portal_closing_shift_enabled, previous_values, reason, created_at, changed_by_staff:staff!attendance_staff_category_rules_changed_by_fkey(full_name)"
        )
        .eq("branch_id", branchId)
        .order("created_at", { ascending: false })
        .limit(20),
      admin
        .from("staff_schedules")
        .select("id, staff:staff!staff_schedules_staff_id_fkey(branch_id, system_role, staff_type)")
        .eq("shift_type", "closing")
        .eq("is_active", true)
        .eq("staff.branch_id", branchId),
    ]);

  if (categoryRulesResult.error) throw new Error(categoryRulesResult.error.message);
  if (branchHistoryResult.error) throw new Error(branchHistoryResult.error.message);
  if (categoryHistoryResult.error) throw new Error(categoryHistoryResult.error.message);
  if (schedulesResult.error) throw new Error(schedulesResult.error.message);

  const activeCategoryRules = new Map<AttendanceStaffCategory, CategoryRuleDbRow>();
  for (const value of categoryRulesResult.data ?? []) {
    const row = value as unknown as CategoryRuleDbRow;
    if (!activeCategoryRules.has(row.staff_category)) {
      activeCategoryRules.set(row.staff_category, row);
    }
  }

  const categories = ATTENDANCE_STAFF_CATEGORIES.map((category) => {
    const row = activeCategoryRules.get(category);
    const override = row
      ? {
          late_grace_minutes: row.late_grace_minutes,
          early_leave_threshold_minutes: row.early_leave_threshold_minutes,
          overtime_threshold_minutes: row.overtime_threshold_minutes,
          active_service_blocks_clock_out: row.active_service_blocks_clock_out,
          crm_closing_policy_enabled: row.crm_closing_policy_enabled,
          service_cleanup_buffer_minutes: row.service_cleanup_buffer_minutes,
          home_service_wrap_up_buffer_minutes: row.home_service_wrap_up_buffer_minutes,
          driver_return_buffer_minutes: row.driver_return_buffer_minutes,
          final_client_release_enabled: row.final_client_release_enabled,
          portal_closing_shift_enabled: row.portal_closing_shift_enabled,
        }
      : emptyOverride();
    return {
      category,
      label: ATTENDANCE_STAFF_CATEGORY_LABELS[category],
      ruleId: row?.id ?? null,
      effectiveFrom: row?.effective_from ?? null,
      effectiveUntil: row?.effective_until ?? null,
      override,
      resolved: {
        lateGraceMinutes: override.late_grace_minutes ?? settings.late_grace_minutes,
        earlyLeaveThresholdMinutes:
          override.early_leave_threshold_minutes ?? settings.early_leave_threshold_minutes,
        overtimeThresholdMinutes:
          override.overtime_threshold_minutes ?? settings.overtime_threshold_minutes,
        activeServiceBlocksClockOut:
          override.active_service_blocks_clock_out ?? settings.active_service_blocks_clock_out,
        crmClosingPolicyEnabled:
          override.crm_closing_policy_enabled ?? settings.crm_closing_policy_enabled,
        serviceCleanupBufferMinutes: override.service_cleanup_buffer_minutes ?? 15,
        homeServiceWrapUpBufferMinutes:
          override.home_service_wrap_up_buffer_minutes
          ?? override.service_cleanup_buffer_minutes
          ?? 15,
        driverReturnBufferMinutes: override.driver_return_buffer_minutes ?? 0,
        finalClientReleaseEnabled: override.final_client_release_enabled ?? false,
        portalClosingShiftEnabled:
          override.portal_closing_shift_enabled
          ?? ["crm_front_desk", "therapists"].includes(category),
      },
    } satisfies BranchAttendanceCategoryRule;
  });

  const branchHistory: AttendanceRuleHistoryItem[] = (branchHistoryResult.data ?? []).map(
    (value) => {
      const row = value as unknown as {
        id: string;
        effective_from: string;
        reason: string;
        created_at: string;
        changed_by_staff?: { full_name: string | null } | Array<{ full_name: string | null }> | null;
        rule_values: Json;
        previous_values: Json;
      };
      return {
        id: row.id,
        scope: "branch",
        category: null,
        effectiveFrom: row.effective_from,
        effectiveUntil: null,
        reason: row.reason,
        changedByName: first(row.changed_by_staff)?.full_name ?? null,
        createdAt: row.created_at,
        previousValues: row.previous_values,
        newValues: row.rule_values,
      };
    }
  );
  const categoryHistory: AttendanceRuleHistoryItem[] = (categoryHistoryResult.data ?? []).map(
    (value) => {
      const row = value as unknown as CategoryRuleDbRow;
      return {
        id: row.id,
        scope: "category",
        category: row.staff_category,
        effectiveFrom: row.effective_from,
        effectiveUntil: row.effective_until,
        reason: row.reason,
        changedByName: first(row.changed_by_staff)?.full_name ?? null,
        createdAt: row.created_at,
        previousValues: row.previous_values ?? {},
        newValues: {
          late_grace_minutes: row.late_grace_minutes,
          early_leave_threshold_minutes: row.early_leave_threshold_minutes,
          overtime_threshold_minutes: row.overtime_threshold_minutes,
          active_service_blocks_clock_out: row.active_service_blocks_clock_out,
          crm_closing_policy_enabled: row.crm_closing_policy_enabled,
          service_cleanup_buffer_minutes: row.service_cleanup_buffer_minutes,
          home_service_wrap_up_buffer_minutes: row.home_service_wrap_up_buffer_minutes,
          driver_return_buffer_minutes: row.driver_return_buffer_minutes,
          final_client_release_enabled: row.final_client_release_enabled,
          portal_closing_shift_enabled: row.portal_closing_shift_enabled,
        },
      };
    }
  );

  const affectedClosingScheduleRows = (schedulesResult.data ?? []).filter((value) => {
    const relation = (value as unknown as {
      staff?:
        | { branch_id: string | null; system_role: string | null; staff_type: string | null }
        | Array<{ branch_id: string | null; system_role: string | null; staff_type: string | null }>
        | null;
    }).staff;
    const staff = first(relation);
    return (
      staff?.branch_id === branchId &&
      resolveAttendanceStaffCategory({
        systemRole: staff?.system_role,
        staffType: staff?.staff_type,
      }) === "crm_front_desk"
    );
  }).length;

  const crmOverride = categories.find((row) => row.category === "crm_front_desk")?.override;
  const closingPreview = resolveAttendancePolicy({
    settings,
    categoryRule: crmOverride,
    staffType: "csr",
    systemRole: "crm",
    shiftType: "closing",
    businessDate: branchNow.businessDate,
    scheduledEndAt: null,
  });
  const lastRunMs = settings.closing_intervention_last_run_at
    ? new Date(settings.closing_intervention_last_run_at).getTime()
    : NaN;

  return {
    settings,
    previewBusinessDate: branchNow.businessDate,
    closingPreview,
    categories,
    history: [...branchHistory, ...categoryHistory]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 20),
    affectedClosingScheduleRows,
    scheduler: {
      sourceConfigured: true,
      lastRunAt: settings.closing_intervention_last_run_at,
      lastError: settings.closing_intervention_last_error,
      recentlyObserved: Number.isFinite(lastRunMs) && now.getTime() - lastRunMs <= 26 * 60 * 60_000,
      nextExpectedRunAt: nextAttendanceSafetyRun(now),
    },
  };
}
