"use server";

import { revalidatePath } from "next/cache";
import {
  requestAssistanceSchema,
  decideAssistanceSchema,
  cancelAssistanceSchema,
  canDecideAssistance,
  validateAssistanceWindow,
} from "@/lib/assistance/assistance-contract";
import {
  assistanceDb,
  ensureDesignatedStaffHaveNoConflicts,
  requireAssistanceActor,
} from "@/lib/assistance/assistance-server";

type Result = { ok: true; message: string } | { ok: false; message: string };

function enabled(): boolean {
  // Staged OFF until reviewed migration, booking/attendance integration and release approval.
  return process.env.CRADLEHUB_INTERBRANCH_ASSISTANCE_ENABLED === "true";
}

function refresh() {
  revalidatePath("/crm/assistance");
}

export async function requestBranchAssistance(raw: unknown): Promise<Result> {
  if (!enabled()) return { ok: false, message: "Assistance is not enabled for this release." };
  const parsed = requestAssistanceSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Review the requested staff, times and reason." };

  try {
    const actor = await requireAssistanceActor();
    const input = parsed.data;
    const windowError = validateAssistanceWindow(input.startsAt, input.endsAt, new Date());
    if (windowError) return { ok: false, message: windowError };
    if (input.lendingBranchId === actor.branchId)
      return { ok: false, message: "Choose another branch to request assistance from." };

    const db = assistanceDb();
    const { data: lending, error: branchError } = await db.from("branches")
      .select("id").eq("id", input.lendingBranchId).eq("is_active", true).maybeSingle();
    if (branchError || !lending) return { ok: false, message: "The lending branch is unavailable." };

    const { error } = await db.from("branch_assistance_requests").insert({
      requesting_branch_id: actor.branchId,
      lending_branch_id: input.lendingBranchId,
      staff_type: input.staffType,
      staff_count: input.staffCount,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      reason: input.reason,
      requested_by_auth_user_id: actor.authUserId,
    });
    if (error) return { ok: false, message: "The request could not be saved. No transfer occurred." };
    refresh();
    return { ok: true, message: "Assistance request submitted. The lending branch's manager must respond." };
  } catch {
    return { ok: false, message: "You cannot create this request right now." };
  }
}

export async function decideBranchAssistance(raw: unknown): Promise<Result> {
  if (!enabled()) return { ok: false, message: "Assistance is not enabled for this release." };
  const parsed = decideAssistanceSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Review the decision and selected staff." };

  try {
    const actor = await requireAssistanceActor();
    if (!canDecideAssistance(actor.role))
      return { ok: false, message: "A manager must decide which staff can be released." };

    const input = parsed.data;
    const db = assistanceDb();
    const { data: request, error: readError } = await db.from("branch_assistance_requests")
      .select("id,lending_branch_id,status,staff_count,staff_type,starts_at,ends_at")
      .eq("id", input.requestId).maybeSingle();

    if (readError || !request) return { ok: false, message: "Request not found." };
    if (actor.role !== "owner" && request.lending_branch_id !== actor.branchId)
      return { ok: false, message: "Only the lending branch's management can approve this request." };
    if (request.status !== "requested")
      return { ok: false, message: "This request has already been decided." };

    const windowError = validateAssistanceWindow(request.starts_at, request.ends_at, new Date());
    if (windowError) return { ok: false, message: "This request has expired. Ask CSR to submit a new window." };

    const accepted = input.decision === "accept";
    if (accepted) {
      if (input.staffIds.length !== request.staff_count)
        return { ok: false, message: `Select exactly ${request.staff_count} eligible staff.` };
      const conflict = await ensureDesignatedStaffHaveNoConflicts({
        staffIds: input.staffIds,
        lendingBranchId: request.lending_branch_id,
        staffType: request.staff_type,
        startsAt: request.starts_at,
        endsAt: request.ends_at,
        ignoreRequestId: request.id,
      });
      if (conflict) return { ok: false, message: conflict };
    } else if (!input.note || input.note.length < 5) {
      return { ok: false, message: "Please give a short reason for declining." };
    }

    // A conditional status update rejects a second decision on the same request.
    // An accepted request is NOT an activated transfer. Booking + attendance gates
    // must be implemented and verified before staff become operationally available.
    const { data: updated, error: updateError } = await db.from("branch_assistance_requests")
      .update({
        status: accepted ? "accepted_pending_activation" : "declined",
        selected_staff_ids: accepted ? input.staffIds : [],
        decision_note: input.note || null,
        decided_by_auth_user_id: actor.authUserId,
        decided_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.requestId)
      .eq("status", "requested")
      .select("id").maybeSingle();

    if (updateError || !updated)
      return { ok: false, message: "The request changed during review. Refresh and try again." };
    refresh();
    return {
      ok: true,
      message: accepted
        ? "Staff selection recorded. Pending validated booking and attendance activation; do not book them cross-branch yet."
        : "The lending branch declined the request.",
    };
  } catch {
    return { ok: false, message: "The manager decision could not be saved." };
  }
}

export async function cancelBranchAssistance(raw: unknown): Promise<Result> {
  if (!enabled()) return { ok: false, message: "Assistance is not enabled for this release." };
  const parsed = cancelAssistanceSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Invalid request." };

  try {
    const actor = await requireAssistanceActor();
    const db = assistanceDb();
    const { data: request, error } = await db.from("branch_assistance_requests")
      .select("id,requesting_branch_id,status")
      .eq("id", parsed.data.requestId).maybeSingle();
    if (error || !request) return { ok: false, message: "Request not found." };
    if (actor.role !== "owner" && request.requesting_branch_id !== actor.branchId)
      return { ok: false, message: "Only the requesting branch can cancel its request." };
    if (request.status !== "requested")
      return { ok: false, message: "This request has already been decided and cannot be cancelled here." };

    const { data: updated, error: updateError } = await db.from("branch_assistance_requests")
      .update({
        status: "cancelled",
        decided_by_auth_user_id: actor.authUserId,
        decided_at: new Date().toISOString(),
        decision_note: "Cancelled by requesting branch",
        updated_at: new Date().toISOString(),
      })
      .eq("id", request.id).eq("status", "requested")
      .select("id").maybeSingle();
    if (updateError || !updated)
      return { ok: false, message: "The request changed during cancellation. Refresh it." };
    refresh();
    return { ok: true, message: "Request cancelled. No staff transfer occurred." };
  } catch {
    return { ok: false, message: "Unable to cancel this request." };
  }
}
