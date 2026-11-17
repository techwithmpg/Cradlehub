"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAttendanceActionContext } from "@/lib/attendance/queries";
import { createClient } from "@/lib/supabase/server";
import {
  commitOptimizedDispatchPlan,
  requestDispatchOptimizationPlan,
  updateBookingCollectionDisposition,
  type OptimizerPlanResult,
  type PlannedBookingUpdate,
} from "@/lib/dispatch/optimizer-bridge";

const optimizeInputSchema = z.object({
  planningDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  commit: z.boolean().optional(),
});

const commitInputSchema = z.object({
  snapshotId: z.string().min(1).max(160),
  bookingUpdates: z.array(
    z.object({
      bookingId: z.guid(),
      vehicleJourneyId: z.guid().nullable(),
      deliveryDriverId: z.guid().nullable(),
      collectionDriverId: z.guid().nullable(),
      stopOrder: z.number().int().positive(),
      collectionDecision: z.enum(["required", "not_required", "undecided"]),
      collectionApprovalMetadata: z.object({
        reasonCode: z.string().nullable().optional(),
        source: z.string().nullable().optional(),
        approvedBy: z.string().nullable().optional(),
        approvedAt: z.string().nullable().optional(),
        collectionDriverId: z.guid().nullable().optional(),
      }),
      returnDestination: z
        .object({
          lat: z.number().finite().min(-90).max(90),
          lng: z.number().finite().min(-180).max(180),
          label: z.string().max(200),
        })
        .nullable(),
    })
  ),
});

const collectionInputSchema = z.object({
  bookingId: z.guid(),
  decision: z.enum(["required", "not_required", "undecided"]),
  collectionDriverId: z.guid().nullable().optional(),
  reasonCode: z.string().max(120).nullable().optional(),
  notes: z.string().max(300).nullable().optional(),
});

function isCrmDispatcherRole(role: string): boolean {
  return ["owner", "admin", "manager", "supervisor", "crm"].includes(role.toLowerCase());
}

export async function optimizeBranchDispatchAction(
  rawInput: unknown
): Promise<
  | {
      success: true;
      plan: OptimizerPlanResult;
      committed?: { committedCount: number; notifiedDriverIds: string[] };
      commitError?: string;
    }
  | { success: false; error: string }
> {
  const parsed = optimizeInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: "Invalid planning date or optimization request." };
  }

  const context = await getAttendanceActionContext();
  if (!context || !context.actorStaffId || !isCrmDispatcherRole(context.role)) {
    return { success: false, error: "CRM or Manager authorization is required to optimize routes." };
  }

  const supabase = await createClient();
  const plan = await requestDispatchOptimizationPlan({
    supabase,
    branchId: context.branchId,
    planningDate: parsed.data.planningDate,
  });

  if (!plan.available || !parsed.data.commit) {
    return { success: true, plan };
  }

  if (!plan.response.operational_commitment_allowed && plan.bookingUpdates.length === 0) {
    return {
      success: true,
      plan,
      commitError:
        plan.response.infeasibility_reasons[0] ||
        "Optimizer flagged constraints requiring manual review before commit.",
    };
  }

  const commit = await commitOptimizedDispatchPlan({
    supabase,
    branchId: context.branchId,
    actorStaffId: context.actorStaffId,
    snapshotId: plan.snapshotId,
    bookingUpdates: plan.bookingUpdates,
  });

  if (!commit.ok) {
    return { success: true, plan, commitError: commit.error };
  }

  revalidatePath("/crm/dispatch");
  revalidatePath("/crm/bookings");
  return {
    success: true,
    plan,
    committed: {
      committedCount: commit.committedCount,
      notifiedDriverIds: commit.notifiedDriverIds,
    },
  };
}

export async function commitOptimizedDispatchPlanAction(
  rawInput: unknown
): Promise<
  | { success: true; committedCount: number; notifiedDriverIds: string[] }
  | { success: false; error: string }
> {
  const parsed = commitInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: "Invalid optimization commit payload." };
  }

  const context = await getAttendanceActionContext();
  if (!context || !context.actorStaffId || !isCrmDispatcherRole(context.role)) {
    return { success: false, error: "CRM or Manager authorization is required." };
  }

  const supabase = await createClient();
  const res = await commitOptimizedDispatchPlan({
    supabase,
    branchId: context.branchId,
    actorStaffId: context.actorStaffId,
    snapshotId: parsed.data.snapshotId,
    bookingUpdates: parsed.data.bookingUpdates as PlannedBookingUpdate[],
  });

  if (!res.ok) {
    return { success: false, error: res.error };
  }

  revalidatePath("/crm/dispatch");
  revalidatePath("/crm/bookings");
  return {
    success: true,
    committedCount: res.committedCount,
    notifiedDriverIds: res.notifiedDriverIds,
  };
}

export async function updateBookingCollectionDispositionAction(
  rawInput: unknown
): Promise<{ success: true } | { success: false; error: string }> {
  const parsed = collectionInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: "Invalid therapist collection disposition input." };
  }

  const context = await getAttendanceActionContext();
  if (!context || !context.actorStaffId || !isCrmDispatcherRole(context.role)) {
    return { success: false, error: "CRM or Manager authorization is required." };
  }

  const supabase = await createClient();
  const res = await updateBookingCollectionDisposition({
    supabase,
    branchId: context.branchId,
    actorStaffId: context.actorStaffId,
    bookingId: parsed.data.bookingId,
    decision: parsed.data.decision,
    collectionDriverId: parsed.data.collectionDriverId ?? null,
    reasonCode: parsed.data.reasonCode ?? null,
    notes: parsed.data.notes ?? null,
  });

  if (!res.ok) {
    return { success: false, error: res.error };
  }

  revalidatePath("/crm/dispatch");
  return { success: true };
}
