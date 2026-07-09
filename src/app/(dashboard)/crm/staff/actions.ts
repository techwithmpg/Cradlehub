"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canAccessCrmWorkspace } from "@/lib/auth/crm-permissions";
import { revalidateAttendanceSurfaces } from "@/lib/attendance/queries";
import {
  cancelBranchCorrectionRequestForActor,
  reviewBranchCorrectionRequestForActor,
} from "@/lib/staff/branch-correction";
import type { BranchCorrectionReviewResult } from "@/lib/staff/branch-correction-types";
import { createClient } from "@/lib/supabase/server";
import { canonicalizeSystemRole } from "@/constants/staff";

const reviewBranchCorrectionSchema = z.object({
  requestId: z.guid("Invalid request ID"),
  status: z.enum(["approved", "rejected"]),
  reviewerNote: z.string().max(500, "Reviewer note is too long.").optional().nullable(),
});

const requestIdSchema = z.object({
  requestId: z.guid("Invalid request ID"),
});

type ReviewActor = {
  staffId: string;
  authUserId: string;
  systemRole: string;
  branchId: string | null;
};

async function requireReviewActor(): Promise<ReviewActor | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: me, error } = await supabase
    .from("staff")
    .select("id, branch_id, system_role")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !me) return null;

  const systemRole = canonicalizeSystemRole(me.system_role as string);
  if (!canAccessCrmWorkspace(systemRole)) return null;

  return {
    staffId: me.id as string,
    authUserId: user.id,
    systemRole,
    branchId: (me.branch_id as string | null) ?? null,
  };
}

export async function reviewBranchCorrectionRequestAction(
  rawInput: unknown
): Promise<BranchCorrectionReviewResult> {
  const parsed = reviewBranchCorrectionSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: parsed.error.issues[0]?.message ?? "Invalid branch correction review.",
    };
  }

  const actor = await requireReviewActor();
  if (!actor) {
    return {
      ok: false,
      code: "UNAUTHENTICATED",
      message: "CRM access is required to review branch correction requests.",
    };
  }

  const result = await reviewBranchCorrectionRequestForActor({
    actor,
    requestId: parsed.data.requestId,
    status: parsed.data.status,
    reviewerNote: parsed.data.reviewerNote ?? null,
  });

  if (result.ok) {
    revalidatePath("/crm/staff");
    revalidatePath("/owner/staff");
    revalidatePath("/manager/staff");
    revalidateAttendanceSurfaces();
  }

  return result;
}

export async function approveBranchCorrectionRequestAction(
  rawInput: unknown
): Promise<BranchCorrectionReviewResult> {
  const parsed = requestIdSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: parsed.error.issues[0]?.message ?? "Invalid branch correction review.",
    };
  }

  return reviewBranchCorrectionRequestAction({
    requestId: parsed.data.requestId,
    status: "approved",
  });
}

export async function rejectBranchCorrectionRequestAction(
  rawInput: unknown
): Promise<BranchCorrectionReviewResult> {
  const parsed = reviewBranchCorrectionSchema
    .omit({ status: true })
    .safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: parsed.error.issues[0]?.message ?? "Invalid branch correction review.",
    };
  }

  return reviewBranchCorrectionRequestAction({
    requestId: parsed.data.requestId,
    status: "rejected",
    reviewerNote: parsed.data.reviewerNote ?? null,
  });
}

export async function cancelBranchCorrectionRequestAction(
  rawInput: unknown
): Promise<BranchCorrectionReviewResult> {
  const parsed = requestIdSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: parsed.error.issues[0]?.message ?? "Invalid branch correction request.",
    };
  }

  const actor = await requireReviewActor();
  if (!actor) {
    return {
      ok: false,
      code: "UNAUTHENTICATED",
      message: "CRM access is required to cancel branch correction requests.",
    };
  }

  const result = await cancelBranchCorrectionRequestForActor({
    actor,
    requestId: parsed.data.requestId,
  });

  if (result.ok) {
    revalidatePath("/crm/staff");
    revalidatePath("/owner/staff");
    revalidatePath("/manager/staff");
    revalidateAttendanceSurfaces();
  }

  return result;
}
