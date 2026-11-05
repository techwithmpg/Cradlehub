import { z } from "zod";

// CradleHub has PostgreSQL UUID branch IDs with non-RFC version/variant bits.
// z.guid() validates the canonical 8-4-4-4-12 hex shape without rejecting those IDs.
import { validAssistanceWindow } from "@/lib/staff/interbranch-assistance-contract";

export const assistanceSubmitSchema = z.object({
  requestingBranchId: z.guid(),
  lendingBranchId: z.guid(),
  role: z.enum(["therapist", "nail_tech", "aesthetician"]),
  count: z.number().int().min(1).max(20),
  visitType: z.enum(["in_spa", "home_service"]),
  startAt: z.string(),
  endAt: z.string(),
  notes: z.string().trim().max(200).default(""),
}).superRefine((value, ctx) => {
  if (value.requestingBranchId === value.lendingBranchId) {
    ctx.addIssue({ code: "custom", path: ["lendingBranchId"], message: "Choose another branch." });
  }
  const window = { startAt: value.startAt, endAt: value.endAt };
  if (!validAssistanceWindow(window) ||
      Date.parse(value.endAt) - Date.parse(value.startAt) > 24 * 60 * 60 * 1000) {
    ctx.addIssue({ code: "custom", path: ["endAt"], message: "Choose a valid assistance period (up to 24 hours)." });
  }
});

export const assistanceDecisionSchema = z.object({
  requestId: z.guid(),
  decision: z.enum(["approve", "decline", "cancel"]),
  staffIds: z.array(z.guid()).max(20).default([]),
  reason: z.string().trim().max(200).default(""),
});

export function canSubmitAssistance(role: string): boolean {
  // Only branch-scoped CRM staff initiate and coordinate assistance.
  return role === "crm";
}

export function canReviewAssistance(
  actor: { role: string; branchId: string | null },
  request: { requestingBranchId: string; lendingBranchId: string },
): boolean {
  // The receiving CSR requests; the lending branch CSR decides.
  // No manager/owner escalation or cross-branch approval bypass.
  return actor.role === "crm" && actor.branchId !== null &&
    actor.branchId === request.lendingBranchId &&
    request.requestingBranchId !== request.lendingBranchId;
}

export function canCancelAssistance(
  actor: { role: string; branchId: string | null },
  request: { requestingBranchId: string; status: string },
): boolean {
  return request.status === "requested" &&
    canSubmitAssistance(actor.role) &&
    actor.branchId !== null && actor.branchId === request.requestingBranchId;
}
