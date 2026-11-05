import { z } from "zod";
import {
  canApproveAssistance,
  validAssistanceWindow,
  type AssistanceRequest,
} from "@/lib/staff/interbranch-assistance-contract";

export const assistanceSubmitSchema = z.object({
  requestingBranchId: z.string().uuid(),
  lendingBranchId: z.string().uuid(),
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
  requestId: z.string().uuid(),
  decision: z.enum(["approve", "decline", "cancel"]),
  staffIds: z.array(z.string().uuid()).max(20).default([]),
  reason: z.string().trim().max(200).default(""),
});

export function canSubmitAssistance(role: string): boolean {
  return ["owner", "manager", "assistant_manager", "store_manager", "crm"].includes(role);
}

export function canReviewAssistance(
  actor: { role: string; branchId: string | null },
  request: Pick<AssistanceRequest, "requestingBranchId" | "lendingBranchId">,
): boolean {
  return canApproveAssistance(actor, {
    ...request,
    id: "",
    role: "therapist",
    count: 1,
    visitType: "in_spa",
    window: { startAt: "2026-11-05T00:00:00+08:00", endAt: "2026-11-05T01:00:00+08:00" },
    status: "requested",
  });
}

export function canCancelAssistance(
  actor: { role: string; branchId: string | null },
  request: { requestingBranchId: string; status: string },
): boolean {
  return request.status === "requested" &&
    canSubmitAssistance(actor.role) &&
    (actor.role === "owner" || actor.branchId === request.requestingBranchId);
}
