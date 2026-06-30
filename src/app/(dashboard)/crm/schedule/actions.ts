"use server";

import { z } from "zod";
import { getBranchServicesForManagement } from "@/lib/queries/branches";
import { getBranchStaffAndServiceAssignments } from "@/lib/queries/crm-services";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { resolveSuperAdminContext } from "@/lib/auth/super-admin";
import { isDevAuthBypassEnabled } from "@/lib/dev-bypass";
import { isOwner } from "@/lib/permissions";
import { logError } from "@/lib/logger";
import {
  getCrmStaffNestedService,
  getCrmStaffServiceId,
  toCrmStaffServiceRows,
} from "@/components/features/crm/staff/service-row-adapter";
import type { ServiceLite } from "@/app/(dashboard)/owner/branches/[branchId]/branch-services-panel";
import type { StaffProfileBranch, StaffProfileService } from "@/components/features/crm/staff/edit-staff-profile-types";
import type { StaffMember } from "@/components/features/staff/staff-management-utils";

const uuid = z.guid("Invalid staff ID");
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");

const fullScheduleSchema = z
  .object({
    staffId: uuid,
    startDate: dateString,
    endDate: dateString,
  })
  .refine((input) => input.startDate <= input.endDate, {
    message: "Start date must be before end date.",
    path: ["endDate"],
  });

const staffProfileSchema = z.object({
  staffId: uuid,
});

const SCHEDULE_VIEW_ROLES = new Set([
  "owner",
  "manager",
  "assistant_manager",
  "store_manager",
  "crm",
  "csr_head",
  "csr_staff",
  "csr",
]);

const GROUP_KEY_BY_STAFF_TYPE: Record<string, string> = {
  therapist: "therapist",
  driver: "driver",
  csr: "csr",
  utility: "utility",
  managerial: "managerial",
  nail_tech: "nail_tech",
  salon_head: "nail_tech",
  aesthetician: "aesthetician",
};

type OneOrMany<T> = T | T[] | null;

type StaffProfileRow = {
  id: string;
  full_name: string;
  nickname: string | null;
  avatar_url: string | null;
  staff_type: string | null;
  system_role: string | null;
  branch_id: string | null;
  branches: OneOrMany<{ name: string }>;
};

type ActorStaffRow = {
  id: string;
  branch_id: string | null;
  system_role: string;
};

type ScheduleRow = {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
  shift_type: string | null;
};

type GroupRow = {
  id: string;
};

type GroupRuleRow = {
  id: string;
  day_of_week: number;
  shift_type: string | null;
  start_time: string | null;
  end_time: string | null;
  is_day_off: boolean | null;
  is_active: boolean | null;
};

type OverrideRow = {
  id: string;
  override_date: string;
  is_day_off: boolean;
  start_time: string | null;
  end_time: string | null;
  reason: string | null;
};

type BlockedTimeRow = {
  id: string;
  block_date: string;
  start_time: string;
  end_time: string;
  reason: string | null;
};

type BookingRow = {
  id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: string | null;
  services: OneOrMany<{ name: string }>;
  customers: OneOrMany<{ full_name: string }>;
};

type StaffProfileActionContext = {
  actorBranchId: string | null;
  actorRole: string;
};

export type CrmScheduleStaffProfileData = {
  staffMember: StaffMember;
  branches: StaffProfileBranch[];
  services: StaffProfileService[];
  staffServiceIds: string[];
  serviceAssignmentsError: string | null;
  reviewerSystemRole: string;
};

export type CrmScheduleStaffProfileResult =
  | { ok: true; data: CrmScheduleStaffProfileData }
  | { ok: false; error: string };

export type StaffFullScheduleData = {
  staff: {
    id: string;
    full_name: string;
    nickname: string | null;
    avatar_url: string | null;
    staff_type: string | null;
    system_role: string | null;
    branch_name: string | null;
  };
  schedules: Array<{
    id: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
    is_active: boolean;
    shift_type: "opening" | "closing" | "single";
  }>;
  groupRules: Array<{
    id: string;
    day_of_week: number;
    shift_type: "opening" | "closing" | "single";
    start_time: string | null;
    end_time: string | null;
    is_day_off: boolean;
    is_active: boolean;
  }>;
  custom_overrides: Array<{
    id: string;
    date: string;
    shift_type: "regular" | "day_off";
    start_time: string | null;
    end_time: string | null;
    reason: string | null;
  }>;
  blocked_times: Array<{
    id: string;
    date: string;
    start_time: string;
    end_time: string;
    reason: string | null;
  }>;
  bookings: Array<{
    id: string;
    date: string;
    start_time: string;
    end_time: string;
    service_name: string;
    customer_name: string | null;
    status: string | null;
  }>;
};

export type StaffFullScheduleResult =
  | { ok: true; data: StaffFullScheduleData }
  | { ok: false; error: string };

function first<T>(value: OneOrMany<T>): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function normalizeShiftType(value: string | null | undefined): "opening" | "closing" | "single" {
  if (value === "opening" || value === "closing") return value;
  return "single";
}

async function getActorContext(
  targetBranchId: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: "You must be logged in to view schedules." };

  if (isDevAuthBypassEnabled()) return { ok: true };

  const superAdmin = await resolveSuperAdminContext(user.id);
  if (superAdmin) {
    if (targetBranchId && superAdmin.branch_id.toLowerCase() !== targetBranchId.toLowerCase()) {
      return { ok: false, error: "You can only view staff schedules for your active branch." };
    }
    return { ok: true };
  }

  const { data: me, error } = await supabase
    .from("staff")
    .select("id, branch_id, system_role")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  const actor = me as ActorStaffRow | null;
  if (!actor) return { ok: false, error: "No active staff record is linked to your account." };
  if (!SCHEDULE_VIEW_ROLES.has(actor.system_role)) {
    return { ok: false, error: "Your role does not have permission to view full schedules." };
  }
  if (!isOwner(actor.system_role)) {
    const actorBranch = actor.branch_id?.toLowerCase() ?? "";
    const targetBranch = targetBranchId?.toLowerCase() ?? "";
    if (!actorBranch || actorBranch !== targetBranch) {
      return { ok: false, error: "You can only view staff schedules for your assigned branch." };
    }
  }

  return { ok: true };
}

async function getStaffProfileActionContext(): Promise<
  | { ok: true; context: StaffProfileActionContext }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: "You must be logged in to edit staff." };

  if (isDevAuthBypassEnabled()) {
    return { ok: true, context: { actorBranchId: null, actorRole: "owner" } };
  }

  const superAdmin = await resolveSuperAdminContext(user.id);
  if (superAdmin) {
    return {
      ok: true,
      context: {
        actorBranchId: superAdmin.branch_id,
        actorRole: "owner",
      },
    };
  }

  const { data: me, error } = await supabase
    .from("staff")
    .select("id, branch_id, system_role")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (error) return { ok: false, error: "Could not verify your staff access." };
  const actor = me as ActorStaffRow | null;
  if (!actor) return { ok: false, error: "No active staff record is linked to your account." };
  if (!SCHEDULE_VIEW_ROLES.has(actor.system_role)) {
    return { ok: false, error: "You do not have permission to edit staff profiles." };
  }

  return {
    ok: true,
    context: {
      actorBranchId: actor.branch_id,
      actorRole: actor.system_role,
    },
  };
}

function normalizeStaffMember(row: StaffMember): StaffMember {
  return {
    ...row,
    nickname: row.nickname ?? null,
    staff_type: row.staff_type ?? "therapist",
    is_head: row.is_head ?? false,
    email: row.email ?? null,
    job_title: row.job_title ?? null,
  };
}

export async function getCrmScheduleStaffProfileAction(
  rawInput: unknown
): Promise<CrmScheduleStaffProfileResult> {
  const parsed = staffProfileSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: "Staff profile could not be loaded." };
  }

  const { staffId } = parsed.data;
  const admin = createAdminClient();

  try {
    const actorResult = await getStaffProfileActionContext();
    if (!actorResult.ok) return actorResult;

    const { data: staffData, error: staffError } = await admin
      .from("staff")
      .select("*, branches(id, name)")
      .eq("id", staffId)
      .maybeSingle();

    if (staffError) {
      console.error("[crm/schedule] staff profile lookup failed", {
        staffId,
        code: staffError.code,
        message: staffError.message,
      });
      return { ok: false, error: "Staff profile could not be loaded." };
    }

    const staffMember = staffData as unknown as StaffMember | null;
    if (!staffMember) return { ok: false, error: "Staff member not found." };

    const actor = actorResult.context;
    if (!isOwner(actor.actorRole)) {
      const actorBranch = actor.actorBranchId?.toLowerCase() ?? "";
      const staffBranch = staffMember.branch_id?.toLowerCase() ?? "";
      if (!actorBranch || actorBranch !== staffBranch) {
        return { ok: false, error: "You can only edit staff in your assigned branch." };
      }
    }

    if (!staffMember.branch_id) {
      return { ok: false, error: "This staff member is not linked to a branch." };
    }

    const services = (await getBranchServicesForManagement(staffMember.branch_id)) as ServiceLite[];
    const eligibleServices = services.filter(
      (service) =>
        service.is_active &&
        getCrmStaffNestedService(service) !== null &&
        getCrmStaffServiceId(service) !== null
    );
    const serviceIds = Array.from(
      new Set(
        eligibleServices
          .map(getCrmStaffServiceId)
          .filter((serviceId): serviceId is string => serviceId !== null)
      )
    );

    let staffServiceIds: string[] = [];
    let serviceAssignmentsError: string | null = null;

    if (serviceIds.length > 0) {
      try {
        const assignments = await getBranchStaffAndServiceAssignments(
          staffMember.branch_id,
          serviceIds
        );
        staffServiceIds = assignments.assignments
          .filter((assignment) => assignment.staff_id === staffId)
          .map((assignment) => assignment.service_id);
      } catch (error) {
        console.error("[crm/schedule] staff service assignment lookup failed", {
          staffId,
          error: error instanceof Error ? error.message : String(error),
        });
        serviceAssignmentsError =
          "Service assignments could not be loaded. Please refresh and try again.";
      }
    }

    const branchName = first(staffMember.branches)?.name ?? "Assigned branch";

    return {
      ok: true,
      data: {
        staffMember: normalizeStaffMember(staffMember),
        branches: [{ id: staffMember.branch_id, name: branchName }],
        services: toCrmStaffServiceRows(eligibleServices) as StaffProfileService[],
        staffServiceIds,
        serviceAssignmentsError,
        reviewerSystemRole: actor.actorRole,
      },
    };
  } catch (error) {
    logError("Failed to load CRM schedule staff profile", {
      error,
      action: "crm.schedule.staffProfile",
      staffId,
    });
    return { ok: false, error: "Staff profile could not be loaded." };
  }
}

export async function getStaffFullScheduleAction(
  rawInput: unknown
): Promise<StaffFullScheduleResult> {
  const parsed = fullScheduleSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid schedule range." };
  }

  const { staffId, startDate, endDate } = parsed.data;
  const admin = createAdminClient();

  try {
    const { data: staffData, error: staffError } = await admin
      .from("staff")
      .select("id, full_name, nickname, avatar_url, staff_type, system_role, branch_id, branches(name)")
      .eq("id", staffId)
      .maybeSingle();

    if (staffError) return { ok: false, error: staffError.message };
    const staff = staffData as StaffProfileRow | null;
    if (!staff) return { ok: false, error: "Staff member not found." };

    const actor = await getActorContext(staff.branch_id);
    if (!actor.ok) return actor;

    const groupKey = staff.staff_type ? GROUP_KEY_BY_STAFF_TYPE[staff.staff_type] : undefined;
    const groupResult =
      groupKey && staff.branch_id
        ? await admin
            .from("staff_schedule_groups")
            .select("id")
            .eq("branch_id", staff.branch_id)
            .eq("group_key", groupKey)
            .eq("is_active", true)
            .maybeSingle()
        : { data: null, error: null };

    const groupId = (groupResult.data as GroupRow | null)?.id ?? null;

    const [schedulesResult, overridesResult, blockedResult, bookingsResult, groupRulesResult] =
      await Promise.all([
        admin
          .from("staff_schedules")
          .select("id, day_of_week, start_time, end_time, is_active, shift_type")
          .eq("staff_id", staffId)
          .order("day_of_week")
          .order("shift_type"),
        admin
          .from("schedule_overrides")
          .select("id, override_date, is_day_off, start_time, end_time, reason")
          .eq("staff_id", staffId)
          .gte("override_date", startDate)
          .lte("override_date", endDate)
          .order("override_date"),
        admin
          .from("blocked_times")
          .select("id, block_date, start_time, end_time, reason")
          .eq("staff_id", staffId)
          .gte("block_date", startDate)
          .lte("block_date", endDate)
          .order("block_date")
          .order("start_time"),
        admin
          .from("bookings")
          .select("id, booking_date, start_time, end_time, status, services(name), customers(full_name)")
          .eq("staff_id", staffId)
          .gte("booking_date", startDate)
          .lte("booking_date", endDate)
          .not("status", "in", '("cancelled","no_show")')
          .order("booking_date")
          .order("start_time"),
        groupId
          ? admin
              .from("staff_group_schedule_rules")
              .select("id, day_of_week, shift_type, start_time, end_time, is_day_off, is_active")
              .eq("group_id", groupId)
              .eq("is_active", true)
              .order("day_of_week")
              .order("shift_type")
          : Promise.resolve({ data: [], error: null }),
      ]);

    const firstError =
      schedulesResult.error ??
      overridesResult.error ??
      blockedResult.error ??
      bookingsResult.error ??
      groupRulesResult.error ??
      groupResult.error ??
      null;

    if (firstError) return { ok: false, error: firstError.message };

    const branch = first(staff.branches);
    const schedules = ((schedulesResult.data ?? []) as ScheduleRow[]).map((row) => ({
      id: row.id,
      day_of_week: row.day_of_week,
      start_time: row.start_time,
      end_time: row.end_time,
      is_active: row.is_active,
      shift_type: normalizeShiftType(row.shift_type),
    }));

    const groupRules = ((groupRulesResult.data ?? []) as GroupRuleRow[]).map((row) => ({
      id: row.id,
      day_of_week: row.day_of_week,
      shift_type: normalizeShiftType(row.shift_type),
      start_time: row.start_time,
      end_time: row.end_time,
      is_day_off: row.is_day_off ?? false,
      is_active: row.is_active ?? false,
    }));

    const custom_overrides = ((overridesResult.data ?? []) as OverrideRow[]).map((row) => ({
      id: row.id,
      date: row.override_date,
      shift_type: row.is_day_off ? ("day_off" as const) : ("regular" as const),
      start_time: row.start_time,
      end_time: row.end_time,
      reason: row.reason,
    }));

    const blocked_times = ((blockedResult.data ?? []) as BlockedTimeRow[]).map((row) => ({
      id: row.id,
      date: row.block_date,
      start_time: row.start_time,
      end_time: row.end_time,
      reason: row.reason,
    }));

    const bookings = ((bookingsResult.data ?? []) as BookingRow[]).map((row) => ({
      id: row.id,
      date: row.booking_date,
      start_time: row.start_time,
      end_time: row.end_time,
      service_name: first(row.services)?.name ?? "Appointment",
      customer_name: first(row.customers)?.full_name ?? null,
      status: row.status,
    }));

    return {
      ok: true,
      data: {
        staff: {
          id: staff.id,
          full_name: staff.full_name,
          nickname: staff.nickname,
          avatar_url: staff.avatar_url,
          staff_type: staff.staff_type,
          system_role: staff.system_role,
          branch_name: branch?.name ?? null,
        },
        schedules,
        groupRules,
        custom_overrides,
        blocked_times,
        bookings,
      },
    };
  } catch (error) {
    logError("Failed to load staff full schedule", {
      error,
      action: "crm.schedule.fullSchedule",
      staffId,
      startDate,
      endDate,
    });
    return { ok: false, error: "Could not load the full schedule." };
  }
}
