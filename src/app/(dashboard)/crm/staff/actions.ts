"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canAccessCrmWorkspace } from "@/lib/auth/crm-permissions";
import { revalidateAttendanceSurfaces } from "@/lib/attendance/queries";
import {
  cancelBranchCorrectionRequestForActor,
  getBranchCorrectionImpactForActor,
  rejectBranchCorrectionScanForActor,
  resolveBranchCorrectionRequestForActor,
} from "@/lib/staff/branch-correction";
import { resolveBranchAssignmentIssueForActor } from "@/lib/staff/branch-assignment-resolver";
import type {
  BranchAssignmentResolutionResult,
  BranchCorrectionImpactSummary,
  BranchCorrectionReviewResult,
} from "@/lib/staff/branch-correction-types";
import { createClient } from "@/lib/supabase/server";
import { canonicalizeSystemRole } from "@/constants/staff";

const reviewBranchCorrectionSchema = z.object({
  requestId: z.guid("Invalid request ID"),
  status: z.enum(["approved", "rejected"]),
  reviewerNote: z.string().max(500, "Reviewer note is too long.").optional().nullable(),
});

const resolveBranchCorrectionSchema = z.object({
  requestId: z.guid("Invalid request ID"),
  decisionType: z.enum([
    "temporary_branch_access_shift",
    "temporary_branch_access_day",
    "permanent_branch_transfer",
  ]),
  reason: z.string().trim().max(500, "Reason is too long.").optional().nullable(),
}).superRefine((value, context) => {
  if (value.decisionType === "permanent_branch_transfer" && !value.reason?.trim()) {
    context.addIssue({ code: "custom", path: ["reason"], message: "Enter a short transfer reason." });
  }
});

const rejectBranchCorrectionSchema = z.object({
  requestId: z.guid("Invalid request ID"),
  reason: z.string().trim().min(3, "Enter a short rejection reason.").max(500, "Reason is too long."),
});

const requestIdSchema = z.object({
  requestId: z.guid("Invalid request ID"),
});

const resolveBranchAssignmentIssueSchema = z.object({
  issueId: z.guid("Invalid branch assignment issue ID"),
  resolutionType: z.enum([
    "correct_permanent_primary_branch",
    "grant_temporary_branch_access",
    "confirm_wrong_qr_scan",
    "require_manual_review",
  ]),
  reason: z.string().trim().max(500, "Reason is too long.").optional(),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid effective date.").optional(),
  validFrom: z.string().optional(),
  validUntil: z.string().optional(),
  temporaryScope: z.enum(["shift", "business_day"]).optional(),
}).superRefine((value, context) => {
  if (value.resolutionType === "correct_permanent_primary_branch" && !value.reason?.trim()) {
    context.addIssue({ code: "custom", path: ["reason"], message: "Enter a short transfer reason." });
  }
  if (value.resolutionType === "grant_temporary_branch_access") {
    if (!value.validFrom || !value.validUntil || !value.temporaryScope) {
      context.addIssue({ code: "custom", path: ["validUntil"], message: "Temporary access requires a bounded validity period." });
      return;
    }
    if (!Number.isFinite(Date.parse(value.validFrom)) || !Number.isFinite(Date.parse(value.validUntil))) {
      context.addIssue({ code: "custom", path: ["validUntil"], message: "Temporary access dates are invalid." });
    }
  }
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

function revalidateBranchCorrectionSurfaces(): void {
  for (const path of [
    "/crm/staff",
    "/owner/staff",
    "/manager/staff",
    "/crm/availability",
    "/crm/staff-availability",
    "/manager/staff-availability",
    "/crm/schedule",
    "/manager/schedule",
    "/owner/schedule",
    "/crm/live-operations",
    "/manager/live-operations",
    "/book",
  ]) {
    revalidatePath(path);
  }
  revalidateAttendanceSurfaces({ includeOperationalReadiness: true });
}

export async function getBranchCorrectionImpactAction(rawInput: unknown): Promise<
  | { ok: true; summary: BranchCorrectionImpactSummary }
  | { ok: false; message: string }
> {
  const parsed = requestIdSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, message: "Invalid branch correction request." };
  const actor = await requireReviewActor();
  if (!actor) return { ok: false, message: "CRM access is required to review this request." };
  return getBranchCorrectionImpactForActor({ actor, requestId: parsed.data.requestId });
}

export async function resolveBranchCorrectionRequestAction(
  rawInput: unknown
): Promise<BranchCorrectionReviewResult> {
  const parsed = resolveBranchCorrectionSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: parsed.error.issues[0]?.message ?? "Invalid branch resolution.",
    };
  }
  const actor = await requireReviewActor();
  if (!actor) {
    return { ok: false, code: "UNAUTHENTICATED", message: "CRM access is required to resolve branch corrections." };
  }
  const result = await resolveBranchCorrectionRequestForActor({
    actor,
    input: parsed.data,
  });
  if (result.ok) revalidateBranchCorrectionSurfaces();
  return result;
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

  const result = parsed.data.status === "rejected"
    ? await rejectBranchCorrectionScanForActor({
        actor,
        requestId: parsed.data.requestId,
        reason: parsed.data.reviewerNote?.trim() || "Wrong-branch scan rejected by CRM.",
      })
    : {
        ok: false as const,
        code: "INVALID_INPUT" as const,
        message: "Choose temporary access or permanent transfer from Resolve branch.",
      };

  if (result.ok) {
    revalidateBranchCorrectionSurfaces();
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

  return {
    ok: false,
    code: "INVALID_INPUT",
    message: "Choose temporary access or permanent transfer from Resolve branch.",
  };
}

export async function rejectBranchCorrectionRequestAction(
  rawInput: unknown
): Promise<BranchCorrectionReviewResult> {
  const parsed = rejectBranchCorrectionSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: parsed.error.issues[0]?.message ?? "Invalid branch correction review.",
    };
  }

  const actor = await requireReviewActor();
  if (!actor) {
    return { ok: false, code: "UNAUTHENTICATED", message: "CRM access is required to reject branch corrections." };
  }
  const result = await rejectBranchCorrectionScanForActor({
    actor,
    requestId: parsed.data.requestId,
    reason: parsed.data.reason,
  });
  if (result.ok) revalidateBranchCorrectionSurfaces();
  return result;
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
    revalidateBranchCorrectionSurfaces();
  }

  return result;
}
export async function resolveBranchAssignmentIssueAction(
  rawInput: unknown
): Promise<BranchAssignmentResolutionResult> {
  const parsed = resolveBranchAssignmentIssueSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: parsed.error.issues[0]?.message ?? "Invalid branch assignment resolution.",
    };
  }

  const actor = await requireReviewActor();
  if (!actor) {
    return {
      ok: false,
      code: "UNAUTHENTICATED",
      message: "CRM access is required to resolve branch assignment issues.",
    };
  }

  const input = parsed.data;
  const defaultReason = input.resolutionType === "confirm_wrong_qr_scan"
    ? "Confirmed as a wrong-branch QR scan by CRM."
    : input.resolutionType === "grant_temporary_branch_access"
      ? "Temporary cross-branch coverage approved by CRM."
      : "Sent for manager review by CRM.";

  const result = await resolveBranchAssignmentIssueForActor({
    actor,
    input: {
      issueId: input.issueId,
      resolutionType: input.resolutionType,
      reason: input.reason?.trim() || defaultReason,
      effectiveDate: input.effectiveDate ?? null,
      validFrom: input.validFrom ?? null,
      validUntil: input.validUntil ?? null,
      selectedRepairs: input.resolutionType === "grant_temporary_branch_access"
        ? { temporary_scope: input.temporaryScope }
        : {},
    },
  });

  if (!result.ok) return result;

  revalidateBranchCorrectionSurfaces();
  if (result.nextAction !== "rescan_required" || /scan again/i.test(result.message)) {
    return result;
  }

  return {
    ...result,
    message: `${result.message} The original Attendance scan was not replayed; ask the staff member to scan again.`,
  };
}
