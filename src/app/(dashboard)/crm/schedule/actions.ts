"use server";

import { z } from "zod";
import { getBranchAssignableServices } from "@/lib/services/service-catalog";
import { getBranchStaffAndServiceAssignments } from "@/lib/queries/crm-services";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { resolveSuperAdminContext } from "@/lib/auth/super-admin";
import { canAccessCrmWorkspace } from "@/lib/auth/crm-permissions";
import { canonicalizeSystemRole } from "@/constants/staff";
import { isDevAuthBypassEnabled } from "@/lib/dev-bypass";
import { isOwner } from "@/lib/permissions";
import { logError } from "@/lib/logger";
import {
  getStaffFullSchedule,
  type StaffFullScheduleData,
} from "@/lib/schedule/staff-full-schedule";

export type { StaffFullScheduleData } from "@/lib/schedule/staff-full-schedule";
import {
  getCrmStaffNestedService,
  getCrmStaffServiceId,
  toCrmStaffServiceRows,
} from "@/components/features/crm/staff/service-row-adapter";
import type { ServiceLite } from "@/app/(dashboard)/owner/branches/[branchId]/branch-services-panel";
import type {
  StaffProfileBranch,
  StaffProfileService,
} from "@/components/features/crm/staff/edit-staff-profile-types";
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

type OneOrMany<T> = T | T[] | null;

type ActorStaffRow = {
  id: string;
  branch_id: string | null;
  system_role: string;
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

export type StaffFullScheduleResult =
  | { ok: true; data: StaffFullScheduleData }
  | { ok: false; error: string };

function first<T>(value: OneOrMany<T>): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
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
  const actorRole = canonicalizeSystemRole(actor.system_role);
  if (!canAccessCrmWorkspace(actorRole)) {
    return { ok: false, error: "Your role does not have permission to view full schedules." };
  }
  if (!isOwner(actorRole)) {
    const actorBranch = actor.branch_id?.toLowerCase() ?? "";
    const targetBranch = targetBranchId?.toLowerCase() ?? "";
    if (!actorBranch || actorBranch !== targetBranch) {
      return { ok: false, error: "You can only view staff schedules for your assigned branch." };
    }
  }

  return { ok: true };
}

async function getStaffProfileActionContext(): Promise<
  { ok: true; context: StaffProfileActionContext } | { ok: false; error: string }
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
  const actorRole = canonicalizeSystemRole(actor.system_role);
  if (!canAccessCrmWorkspace(actorRole)) {
    return { ok: false, error: "You do not have permission to edit staff profiles." };
  }

  return {
    ok: true,
    context: {
      actorBranchId: actor.branch_id,
      actorRole,
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

    const services = (await getBranchAssignableServices(staffMember.branch_id)) as ServiceLite[];
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
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid schedule range.",
    };
  }

  const { staffId, startDate, endDate } = parsed.data;
  const admin = createAdminClient();

  try {
    const { data: targetStaff, error: targetStaffError } = await admin
      .from("staff")
      .select("id, branch_id")
      .eq("id", staffId)
      .maybeSingle();

    if (targetStaffError) {
      return { ok: false, error: targetStaffError.message };
    }

    if (!targetStaff) {
      return { ok: false, error: "Staff member not found." };
    }

    const actor = await getActorContext(targetStaff.branch_id);

    if (!actor.ok) {
      return actor;
    }

    if (!targetStaff.branch_id) {
      return {
        ok: false,
        error: "This staff member is not linked to a branch.",
      };
    }

    const data = await getStaffFullSchedule({
      supabase: admin,
      branchId: targetStaff.branch_id,
      staffId,
      startDate,
      endDate,
    });

    if (!data) {
      return { ok: false, error: "Staff member not found." };
    }

    return { ok: true, data };
  } catch (error) {
    logError("Failed to load staff full schedule", {
      error,
      action: "crm.schedule.fullSchedule",
      staffId,
      startDate,
      endDate,
    });

    return {
      ok: false,
      error: "Could not load the full schedule.",
    };
  }
}
