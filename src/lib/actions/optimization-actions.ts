"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  assignBookingRoomAction,
  assignBookingTherapistAction,
} from "@/app/(dashboard)/crm/bookings/actions";
import { canonicalizeSystemRole } from "@/constants/staff";
import { canAccessCrmWorkspace } from "@/lib/auth/crm-permissions";
import {
  CLOSED_BOOKING_STATUSES,
  insertBookingAuditEvent,
  isHomeServiceBooking,
} from "@/lib/bookings/crm-booking-operations";
import { revalidateOperationalBookingSurfaces } from "@/lib/bookings/revalidate-booking-surfaces";
import { isDevAuthBypassEnabled, getDevBypassLayoutStaff } from "@/lib/dev-bypass";
import { updateBookingCollectionDisposition } from "@/lib/dispatch/optimizer-bridge";
import { isResourceAvailable } from "@/lib/engine/resource-availability";
import { getBranchBusinessDate } from "@/lib/engine/slot-time";
import { assignHomeServiceDriver } from "@/lib/home-service/dispatch-operations";
import { logBusinessEvent } from "@/lib/logger";
import { createOrUpdateWorkflowTask } from "@/lib/notifications/workflow-task-store";
import {
  broadcastOptimizationOpsUpdated,
  evaluateBranchSummarySafe,
  withBranchOptimizationActionLock,
} from "@/lib/optimization/auto-reevaluate";
import {
  clearOptimizationEvaluationCache,
  evaluateBranchOperationsCached,
} from "@/lib/optimization/client";
import {
  summarizeOptimizationEvaluation,
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
    "reassign_collection_driver",
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

export type ApplyRecommendedFixCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "CONFLICT_ALREADY_RESOLVED"
  | "STALE_SNAPSHOT"
  | "CUSTOMER_APPROVAL_REQUIRED"
  | "EXECUTION_FAILED";

export type ApplyRecommendedFixResult =
  | { success: true; message: string; summary: TieredCrmOperationsSummary }
  | {
      success: false;
      error: string;
      code?: ApplyRecommendedFixCode;
      summary?: TieredCrmOperationsSummary;
    };

export async function evaluateBranchOptimizationAction(rawInput?: unknown): Promise<
  | { success: true; summary: TieredCrmOperationsSummary }
  | { success: false; error: string; summary?: TieredCrmOperationsSummary }
> {
  const parsed = evaluateSchema.safeParse(rawInput ?? {});
  if (!parsed.success) {
    return { success: false, error: "Invalid optimization check input." };
  }

  const actor = await requireCrmOptimizationActor();
  if (!actor) {
    return { success: false, error: "CRM workspace authorization required." };
  }

  const date = parsed.data.date ?? getBranchBusinessDate();
  const safe = await evaluateBranchSummarySafe({
    branchId: actor.branchId,
    date,
    bypassCache: Boolean(parsed.data.syncAlerts),
    syncAlerts: Boolean(parsed.data.syncAlerts),
    actorStaffId: actor.staffId,
  });

  if (!safe.ok) {
    return {
      success: false,
      error: safe.error ?? "Could not run optimization evaluation.",
      summary: safe.summary,
    };
  }

  if (parsed.data.syncAlerts && (safe.summary.syncedTaskCount > 0 || safe.summary.resolvedTaskCount > 0)) {
    void broadcastOptimizationOpsUpdated({
      branchId: actor.branchId,
      date,
      sourceSnapshotVersion: safe.summary.sourceSnapshotVersion,
      reason: "manual_check",
    });
  }

  return { success: true, summary: safe.summary };
}

async function auditOptimizationBookingMutation(params: {
  bookingId: string;
  actorId: string | null;
  actionType: string;
  note: string;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: row } = await admin
      .from("bookings")
      .select("status")
      .eq("id", params.bookingId)
      .maybeSingle();
    if (!row) return;
    await insertBookingAuditEvent({
      admin,
      bookingId: params.bookingId,
      actorId: params.actorId,
      fromStatus: row.status,
      toStatus: row.status,
      result: `optimization.${params.actionType}`,
      note: params.note,
    });
  } catch {
    // Audit logging is best-effort; never fail an already-committed booking mutation.
  }
}

export async function applyRecommendedFixAction(
  rawInput: unknown
): Promise<ApplyRecommendedFixResult> {
  const parsed = applyFixSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      code: "VALIDATION_ERROR",
      error: "Invalid recommendation parameters.",
    };
  }

  const actor = await requireCrmOptimizationActor();
  if (!actor) {
    return {
      success: false,
      code: "UNAUTHORIZED",
      error: "CRM workspace authorization required.",
    };
  }

  const date = parsed.data.date ?? getBranchBusinessDate();

  return withBranchOptimizationActionLock(actor.branchId, async (): Promise<ApplyRecommendedFixResult> => {
    try {
      const startedAtMs = Date.now();
      // Always re-evaluate fresh snapshot and enforce exact allowlist match under per-branch lock.
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
        const snapshotMoved =
          parsed.data.sourceSnapshotVersion !== freshEval.source_snapshot_version;
        const freshSummary = snapshotMoved
          ? await syncCrmOptimizationAlerts({
              evaluation: freshEval,
              actorStaffId: actor.staffId,
              forceSync: true,
              evaluationStartedAtMs: startedAtMs,
            })
          : summarizeOptimizationEvaluation(freshEval);

        return {
          success: false,
          code: snapshotMoved ? "CONFLICT_ALREADY_RESOLVED" : "STALE_SNAPSHOT",
          error: snapshotMoved
            ? "Already updated by another desk or booking change. Showing the latest schedule."
            : "Operational schedule changed or action is not verified feasible. Refresh and review the latest options.",
          summary: freshSummary,
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
        const admin = createAdminClient();
        const { data: bookingRow } = await admin
          .from("bookings")
          .select(
            "id, branch_id, staff_id, resource_id, booking_date, start_time, end_time, status, type, delivery_type, metadata, therapist_selection_source"
          )
          .eq("id", bookingId)
          .eq("branch_id", actor.branchId)
          .maybeSingle();

        const previousStaffId =
          (bookingRow as { staff_id?: string | null } | null)?.staff_id ?? null;
        const previousResourceId =
          (bookingRow as { resource_id?: string | null } | null)?.resource_id ?? null;

        // Cross-instance concurrency protection: if another serverless instance already
        // applied the exact proposed therapist (+ room), return CONFLICT_ALREADY_RESOLVED.
        if (
          previousStaffId === parsed.data.proposedStaffId &&
          (!parsed.data.proposedResourceId ||
            previousResourceId === parsed.data.proposedResourceId)
        ) {
          return {
            success: false,
            code: "CONFLICT_ALREADY_RESOLVED",
            error:
              "Already updated by another desk or booking change. Showing the latest schedule.",
            summary: summarizeOptimizationEvaluation(freshEval),
          };
        }

        if (parsed.data.actionType === "swap_therapist" && !parsed.data.confirmCustomerApproval) {
          const meta =
            bookingRow?.metadata &&
            typeof bookingRow.metadata === "object" &&
            !Array.isArray(bookingRow.metadata)
              ? (bookingRow.metadata as Record<string, unknown>)
              : {};
          const prov =
            meta._therapist_provenance && typeof meta._therapist_provenance === "object"
              ? (meta._therapist_provenance as Record<string, unknown>)
              : {};
          const dbSelectionSource = (
            bookingRow as { therapist_selection_source?: string | null } | null
          )?.therapist_selection_source;
          if (
            dbSelectionSource === "customer_selected" ||
            prov.therapist_selection_source === "customer_selected"
          ) {
            return {
              success: false,
              code: "CUSTOMER_APPROVAL_REQUIRED",
              error:
                "Customer requested the original therapist. Confirm guest approval before swapping.",
              summary: summarizeOptimizationEvaluation(freshEval),
            };
          }
        }

        if (parsed.data.proposedResourceId) {
          const bookingForRoom = bookingRow as {
            status?: string | null;
            type?: string | null;
            delivery_type?: string | null;
            booking_date?: string | null;
            start_time?: string | null;
            end_time?: string | null;
          } | null;
          if (!bookingForRoom) {
            return {
              success: false,
              code: "EXECUTION_FAILED",
              error: "Target booking could not be loaded for room verification.",
            };
          }
          if (CLOSED_BOOKING_STATUSES.has(String(bookingForRoom.status ?? ""))) {
            return {
              success: false,
              code: "EXECUTION_FAILED",
              error: "This booking can no longer be assigned a room.",
            };
          }
          if (
            isHomeServiceBooking({
              type: bookingForRoom.type ?? null,
              delivery_type: bookingForRoom.delivery_type ?? null,
            })
          ) {
            return {
              success: false,
              code: "EXECUTION_FAILED",
              error: "Room assignment does not apply to home-service bookings.",
            };
          }
          const { data: targetResource } = await admin
            .from("branch_resources")
            .select("id, branch_id, is_active")
            .eq("id", parsed.data.proposedResourceId)
            .maybeSingle();
          if (
            !targetResource ||
            targetResource.branch_id !== actor.branchId ||
            !targetResource.is_active
          ) {
            return {
              success: false,
              code: "EXECUTION_FAILED",
              error: "Proposed room is not active for this branch.",
            };
          }
          if (bookingForRoom.booking_date && bookingForRoom.start_time) {
            const roomAvailable = await isResourceAvailable({
              resourceId: parsed.data.proposedResourceId,
              date: bookingForRoom.booking_date,
              startTime: bookingForRoom.start_time,
              endTime: bookingForRoom.end_time ?? bookingForRoom.start_time,
              excludeBookingId: bookingId,
            });
            if (!roomAvailable) {
              return {
                success: false,
                code: "EXECUTION_FAILED",
                error: "The proposed room is no longer available for this time window.",
              };
            }
          }
        }

        const res = await assignBookingTherapistAction({
          bookingId,
          staffId: parsed.data.proposedStaffId,
          overrideReason:
            parsed.data.actionType === "swap_therapist" ? "workload_balance" : undefined,
        });
        if (!res.success) {
          return {
            success: false,
            code: "EXECUTION_FAILED",
            error: res.error ?? "Therapist reassignment failed.",
          };
        }
        if (parsed.data.proposedResourceId) {
          const roomRes = await assignBookingRoomAction({
            bookingId,
            resourceId: parsed.data.proposedResourceId,
          });
          if (!roomRes.success) {
            // Compensate therapist assignment so multi-field action never leaves a partial commit
            if (previousStaffId) {
              await assignBookingTherapistAction({
                bookingId,
                staffId: previousStaffId,
                overrideReason: "workload_balance",
              }).catch(() => undefined);
            } else {
              await admin
                .from("bookings")
                .update({ staff_id: null as unknown as string | undefined })
                .eq("id", bookingId)
                .eq("branch_id", actor.branchId);
            }
            clearOptimizationEvaluationCache();
            revalidateOperationalBookingSurfaces(actor.branchId);
            const failStartedAtMs = Date.now();
            const failEval = await evaluateBranchOperationsCached({
              branchId: actor.branchId,
              date,
              bypassCache: true,
            });
            const failSummary = await syncCrmOptimizationAlerts({
              evaluation: failEval,
              actorStaffId: actor.staffId,
              forceSync: true,
              evaluationStartedAtMs: failStartedAtMs,
            });
            void broadcastOptimizationOpsUpdated({
              branchId: actor.branchId,
              date: failEval.date,
              sourceSnapshotVersion: failEval.source_snapshot_version,
              reason: "room_assignment_rolled_back",
            });
            return {
              success: false,
              code: "EXECUTION_FAILED",
              error:
                roomRes.error ??
                "Proposed room became unavailable; therapist assignment was restored.",
              summary: failSummary,
            };
          }
        }
        await auditOptimizationBookingMutation({
          bookingId,
          actorId: actor.staffId,
          actionType: parsed.data.actionType,
          note: `Operations Assistant applied ${parsed.data.actionType} (${parsed.data.proposedStaffId})${
            parsed.data.confirmCustomerApproval ? " with confirmed guest approval" : ""
          }${
            parsed.data.proposedResourceId ? ` and room (${parsed.data.proposedResourceId})` : ""
          }.`,
        });
        appliedMessage = "Therapist assignment updated safely.";
      } else if (
        (parsed.data.actionType === "reassign_room" ||
          parsed.data.actionType === "assign_room") &&
        bookingId &&
        parsed.data.proposedResourceId
      ) {
        const admin = createAdminClient();
        const { data: bookingRow } = await admin
          .from("bookings")
          .select("id, resource_id")
          .eq("id", bookingId)
          .eq("branch_id", actor.branchId)
          .maybeSingle();
        if (
          (bookingRow as { resource_id?: string | null } | null)?.resource_id ===
          parsed.data.proposedResourceId
        ) {
          return {
            success: false,
            code: "CONFLICT_ALREADY_RESOLVED",
            error:
              "Already updated by another desk or booking change. Showing the latest schedule.",
            summary: summarizeOptimizationEvaluation(freshEval),
          };
        }
        const res = await assignBookingRoomAction({
          bookingId,
          resourceId: parsed.data.proposedResourceId,
        });
        if (!res.success) {
          return {
            success: false,
            code: "EXECUTION_FAILED",
            error: res.error ?? "Room assignment failed.",
          };
        }
        await auditOptimizationBookingMutation({
          bookingId,
          actorId: actor.staffId,
          actionType: parsed.data.actionType,
          note: `Operations Assistant applied ${parsed.data.actionType} (${parsed.data.proposedResourceId}).`,
        });
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
            code: "EXECUTION_FAILED",
            error: drvRes.message || "Driver assignment could not be completed.",
          };
        }
        await auditOptimizationBookingMutation({
          bookingId,
          actorId: actor.staffId,
          actionType: parsed.data.actionType,
          note: `Operations Assistant assigned driver (${parsed.data.proposedDriverId}).`,
        });
        appliedMessage = "Driver assignment updated safely.";
      } else if (
        parsed.data.actionType === "reassign_collection_driver" &&
        bookingId &&
        parsed.data.proposedDriverId
      ) {
        if (!actor.staffId) {
          return {
            success: false,
            code: "UNAUTHORIZED",
            error: "Staff profile required to reassign collection driver.",
          };
        }
        const colRes = await updateBookingCollectionDisposition({
          supabase: actor.supabase,
          branchId: actor.branchId,
          actorStaffId: actor.staffId,
          bookingId,
          decision: "required",
          collectionDriverId: parsed.data.proposedDriverId,
          reasonCode: "OPTIMIZER_COLLECTION_REASSIGNMENT",
          notes: "Assigned via CRM Operations Assistant.",
        });
        if (!colRes.ok) {
          return {
            success: false,
            code: "EXECUTION_FAILED",
            error: colRes.error || "Collection driver reassignment failed.",
          };
        }
        await auditOptimizationBookingMutation({
          bookingId,
          actorId: actor.staffId,
          actionType: parsed.data.actionType,
          note: `Operations Assistant reassigned collection driver (${parsed.data.proposedDriverId}).`,
        });
        appliedMessage = "Collection driver updated safely.";
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
            code: "EXECUTION_FAILED",
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
        return {
          success: false,
          code: "VALIDATION_ERROR",
          error: "Unsupported or incomplete optimization action.",
        };
      }

      logBusinessEvent("optimization.recommended_fix_applied", {
        branchId: actor.branchId,
        date,
        actorStaffId: actor.staffId,
        actionType: parsed.data.actionType,
        targetBookingId: bookingId,
        proposedStaffId: parsed.data.proposedStaffId ?? null,
        proposedResourceId: parsed.data.proposedResourceId ?? null,
        proposedDriverId: parsed.data.proposedDriverId ?? null,
      });

      clearOptimizationEvaluationCache();
      revalidateOperationalBookingSurfaces(actor.branchId);
      revalidatePath("/crm/today");
      revalidatePath("/crm/bookings");
      revalidatePath("/crm/dispatch");
      revalidatePath("/crm/schedule");

      const postMutationEvalStartedAtMs = Date.now();
      const nextEval = await evaluateBranchOperationsCached({
        branchId: actor.branchId,
        date,
        bypassCache: true,
      });
      const summary = await syncCrmOptimizationAlerts({
        evaluation: nextEval,
        actorStaffId: actor.staffId,
        forceSync: true,
        evaluationStartedAtMs: postMutationEvalStartedAtMs,
      });

      void broadcastOptimizationOpsUpdated({
        branchId: actor.branchId,
        date: nextEval.date,
        sourceSnapshotVersion: nextEval.source_snapshot_version,
        reason: `applied:${parsed.data.actionType}`,
      });

      return { success: true, message: appliedMessage, summary };
    } catch {
      return {
        success: false,
        code: "EXECUTION_FAILED",
        error: "Could not apply recommended operational fix.",
      };
    }
  });
}
