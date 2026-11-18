"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  assignBookingRoomAction,
  assignBookingTherapistAction,
} from "@/app/(dashboard)/crm/bookings/actions";
import { canonicalizeSystemRole } from "@/constants/staff";
import { canAccessCrmWorkspace } from "@/lib/auth/crm-permissions";
import { revalidateOperationalBookingSurfaces } from "@/lib/bookings/revalidate-booking-surfaces";
import { isDevAuthBypassEnabled, getDevBypassLayoutStaff } from "@/lib/dev-bypass";
import { getBranchBusinessDate } from "@/lib/engine/slot-time";
import { assignHomeServiceDriver } from "@/lib/home-service/dispatch-operations";
import { createOrUpdateWorkflowTask } from "@/lib/notifications/workflow-task-store";
import {
  clearOptimizationEvaluationCache,
  evaluateBranchOperationsCached,
} from "@/lib/optimization/client";
import {
  syncCrmOptimizationAlerts,
  type TieredCrmOperationsSummary,
} from "@/lib/optimization/crm-operations-assistant";
import { resolveOwnerFrontDeskBranch } from "@/lib/queries/front-desk-branch";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const evaluateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  syncAlerts: z.boolean().optional(),
});

const applyFixSchema = z.object({
  sourceSnapshotVersion: z.string().min(1).max(160),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  actionType: z.enum([
    "swap_therapist",
    "assign_therapist",
    "reassign_room",
    "assign_room",
    "assign_driver",
    "prioritize_room_turnover",
  ]),
  targetBookingId: z.guid().nullable().optional(),
  proposedStaffId: z.guid().nullable().optional(),
  proposedResourceId: z.guid().nullable().optional(),
  proposedDriverId: z.guid().nullable().optional(),
  confirmCustomerApproval: z.boolean().optional(),
});

async function requireCrmOptimizationActor() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  if (isDevAuthBypassEnabled()) {
    const mock = getDevBypassLayoutStaff();
    return {
      supabase,
      staffId: null as string | null,
      branchId: mock.branch_id,
      role: mock.system_role,
    };
  }

  const { data: me } = await supabase
    .from("staff")
    .select("id, branch_id, system_role")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .is("archived_at", null)
    .is("merged_into_staff_id", null)
    .maybeSingle();

  const role = me ? canonicalizeSystemRole(me.system_role) : null;
  if (!me || !role || !canAccessCrmWorkspace(role)) return null;

  const ownerBranch =
    role === "owner" ? await resolveOwnerFrontDeskBranch(user.id, me.branch_id) : null;
  const branchId = ownerBranch?.id ?? me.branch_id;
  if (!branchId) return null;

  return { supabase, staffId: me.id, branchId, role };
}

export async function evaluateBranchOptimizationAction(rawInput?: unknown): Promise<
  | { success: true; summary: TieredCrmOperationsSummary }
  | { success: false; error: string }
> {
  const parsed = evaluateSchema.safeParse(rawInput ?? {});
  if (!parsed.success) {
    return { success: false, error: "Invalid optimization check input." };
  }

  const actor = await requireCrmOptimizationActor();
  if (!actor) {
    return { success: false, error: "CRM workspace authorization required." };
  }

  try {
    const evaluation = await evaluateBranchOperationsCached({
      branchId: actor.branchId,
      date: parsed.data.date ?? getBranchBusinessDate(),
      bypassCache: Boolean(parsed.data.syncAlerts),
    });
    const summary = await syncCrmOptimizationAlerts({
      evaluation,
      actorStaffId: actor.staffId,
      forceSync: Boolean(parsed.data.syncAlerts),
    });
    return { success: true, summary };
  } catch {
    return {
      success: false,
      error: "Could not run optimization evaluation.",
    };
  }
}

export async function applyRecommendedFixAction(rawInput: unknown): Promise<
  | { success: true; message: string; summary: TieredCrmOperationsSummary }
  | { success: false; error: string }
> {
  const parsed = applyFixSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: "Invalid recommendation parameters." };
  }

  const actor = await requireCrmOptimizationActor();
  if (!actor) {
    return { success: false, error: "CRM workspace authorization required." };
  }

  try {
    const date = parsed.data.date ?? getBranchBusinessDate();
    // Always re-evaluate fresh snapshot and enforce exact allowlist match regardless of snapshot version
    const freshEval = await evaluateBranchOperationsCached({
      branchId: actor.branchId,
      date,
      bypassCache: true,
    });

    const actionAuthorizedInPlan = freshEval.conflicts_and_opportunities.some((c) =>
      c.recommended_actions.some(
        (a) =>
          a.verified_feasible &&
          a.action_type === parsed.data.actionType &&
          a.target_booking_id === (parsed.data.targetBookingId ?? null) &&
          a.proposed_staff_id === (parsed.data.proposedStaffId ?? null) &&
          a.proposed_resource_id === (parsed.data.proposedResourceId ?? null) &&
          a.proposed_driver_id === (parsed.data.proposedDriverId ?? null)
      )
    );
    if (!actionAuthorizedInPlan) {
      return {
        success: false,
        error:
          "Operational schedule changed or action is not verified feasible. Refresh and review the latest options.",
      };
    }

    let appliedMessage = "Applied recommendation.";
    const bookingId = parsed.data.targetBookingId ?? null;

  if (
    (parsed.data.actionType === "swap_therapist" ||
      parsed.data.actionType === "assign_therapist") &&
    bookingId &&
    parsed.data.proposedStaffId
  ) {
    if (parsed.data.actionType === "swap_therapist" && !parsed.data.confirmCustomerApproval) {
      const { data: bookingRow } = await createAdminClient()
        .from("bookings")
        .select("metadata")
        .eq("id", bookingId)
        .eq("branch_id", actor.branchId)
        .maybeSingle();
      const meta =
        bookingRow?.metadata && typeof bookingRow.metadata === "object" && !Array.isArray(bookingRow.metadata)
          ? (bookingRow.metadata as Record<string, unknown>)
          : {};
      const prov =
        meta._therapist_provenance && typeof meta._therapist_provenance === "object"
          ? (meta._therapist_provenance as Record<string, unknown>)
          : {};
      if (prov.therapist_selection_source === "customer_selected") {
        return {
          success: false,
          error: "Customer requested the original therapist. Confirm guest approval before swapping.",
        };
      }
    }

    const res = await assignBookingTherapistAction({
      bookingId,
      staffId: parsed.data.proposedStaffId,
      overrideReason: "workload_balance",
    });
    if (!res.success) {
      return { success: false, error: res.error ?? "Therapist reassignment failed." };
    }
    if (parsed.data.proposedResourceId) {
      const roomRes = await assignBookingRoomAction({
        bookingId,
        resourceId: parsed.data.proposedResourceId,
      });
      if (!roomRes.success) {
        clearOptimizationEvaluationCache();
        revalidateOperationalBookingSurfaces(actor.branchId);
        return {
          success: false,
          error:
            roomRes.error ??
            "Therapist updated, but the proposed room assignment could not be completed.",
        };
      }
    }
    appliedMessage = "Therapist assignment updated safely.";
  } else if (
    (parsed.data.actionType === "reassign_room" ||
      parsed.data.actionType === "assign_room") &&
    bookingId &&
    parsed.data.proposedResourceId
  ) {
    const res = await assignBookingRoomAction({
      bookingId,
      resourceId: parsed.data.proposedResourceId,
    });
    if (!res.success) {
      return { success: false, error: res.error ?? "Room assignment failed." };
    }
    appliedMessage = "Room assignment updated safely.";
  } else if (
    parsed.data.actionType === "assign_driver" &&
    bookingId &&
    parsed.data.proposedDriverId
  ) {
    const drvRes = await assignHomeServiceDriver(
      actor.supabase,
      {
        staffId: actor.staffId ?? "00000000-0000-0000-0000-000000000000",
        branchId: actor.branchId,
        role: actor.role,
        allowOwnerCrossBranch: true,
      },
      { bookingId, driverId: parsed.data.proposedDriverId }
    );
    if (!drvRes.ok) {
      return {
        success: false,
        error: drvRes.message || "Driver assignment could not be completed.",
      };
    }
    appliedMessage = "Driver assignment updated safely.";
  } else if (
    parsed.data.actionType === "prioritize_room_turnover" &&
    parsed.data.proposedResourceId
  ) {
    const { data: branchRoom } = await createAdminClient()
      .from("branch_resources")
      .select("id")
      .eq("id", parsed.data.proposedResourceId)
      .eq("branch_id", actor.branchId)
      .eq("is_active", true)
      .maybeSingle();
    if (!branchRoom) {
      return {
        success: false,
        error: "Proposed room is inactive or does not belong to this branch.",
      };
    }
    await createOrUpdateWorkflowTask({
      branchId: actor.branchId,
      workspaceScope: "utility",
      taskType: "room_turnover",
      title: "Priority Room Turnover Needed",
      body: "An upcoming confirmed appointment needs this room next. Please prioritize sanitization.",
      entityType: "branch_resource",
      entityId: parsed.data.proposedResourceId,
      actionHref: "/utility",
      priority: "critical",
      dedupeKey: `room_turnover:${actor.branchId}:${parsed.data.proposedResourceId}`,
    });
    appliedMessage = "Utility crew alerted to prioritize room turnover.";
  } else {
    return { success: false, error: "Unsupported or incomplete optimization action." };
  }

  clearOptimizationEvaluationCache();
  revalidateOperationalBookingSurfaces(actor.branchId);
  revalidatePath("/crm/dispatch");
  revalidatePath("/crm/schedule");

  const nextEval = await evaluateBranchOperationsCached({
    branchId: actor.branchId,
    date,
    bypassCache: true,
  });
  const summary = await syncCrmOptimizationAlerts({
    evaluation: nextEval,
    actorStaffId: actor.staffId,
    forceSync: true,
  });

  return { success: true, message: appliedMessage, summary };
  } catch {
    return { success: false, error: "Could not apply recommended operational fix." };
  }
}
