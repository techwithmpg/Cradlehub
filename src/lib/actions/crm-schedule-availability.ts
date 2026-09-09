"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isDevAuthBypassEnabled } from "@/lib/dev-bypass";
import { canonicalizeSystemRole } from "@/constants/staff";
import { canAdjustStaffSchedule, isOwner } from "@/lib/permissions";
import {
  scheduleMutationUuidSchema,
  replaceStaffWeeklySchedule,
  replaceStaffWeeklyWindowSchedule,
  upsertScheduleOverride,
  deleteScheduleOverride,
  createBlockedTime,
  deleteBlockedTime,
  type ScheduleMutationActor,
  type WeeklyScheduleMutationResult,
  type ScheduleOverrideMutationResult,
  type DeleteScheduleOverrideResult,
  type BlockedTimeMutationResult,
  type DeleteBlockedTimeResult,
} from "@/lib/schedule/schedule-mutations";
import {
  genericScheduleActionFailure,
  type ScheduleActionFailure,
} from "@/lib/actions/schedule-mutation-errors";
import type { SavedStaffScheduleRow } from "@/lib/schedule/staff-schedule-write";

type ScheduleActionResult =
  | {
      ok: true;
      rowsWritten: number;
      savedRows: SavedStaffScheduleRow[];
    }
  | ScheduleActionFailure;

type ScheduleEditContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  actor: ScheduleMutationActor;
};

type ScheduleEditContextResult = { ok: true; context: ScheduleEditContext } | { ok: false };

const PERMISSION_ERROR = "You do not have permission to update this staff schedule.";

const branchInputSchema = z.object({
  branchId: scheduleMutationUuidSchema,
});

function readBranchId(rawInput: unknown): string | null {
  const parsed = branchInputSchema.safeParse(rawInput);
  return parsed.success ? parsed.data.branchId : null;
}

async function getScheduleEditContext(branchId: string): Promise<ScheduleEditContextResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false };
  }

  if (isDevAuthBypassEnabled()) {
    return {
      ok: true,
      context: {
        supabase,
        actor: {
          staffId: null,
          branchId,
          role: "owner",
        },
      },
    };
  }

  const { data: me, error } = await supabase
    .from("staff")
    .select("id, branch_id, system_role")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !me) {
    return { ok: false };
  }

  const actorRole = canonicalizeSystemRole(me.system_role);

  if (!canAdjustStaffSchedule(actorRole)) {
    return { ok: false };
  }

  if (!isOwner(actorRole)) {
    const actorBranch = (me.branch_id ?? "").toLowerCase();
    const requestedBranch = branchId.toLowerCase();

    if (!actorBranch || actorBranch !== requestedBranch) {
      return { ok: false };
    }
  }

  return {
    ok: true,
    context: {
      supabase,
      actor: {
        staffId: me.id,
        branchId: me.branch_id,
        role: actorRole,
      },
    },
  };
}

function toWebWeeklyResult(result: WeeklyScheduleMutationResult): ScheduleActionResult {
  if (result.ok) {
    return result;
  }

  return genericScheduleActionFailure(result.code, result.message, result.operationId);
}

export async function updateCrmStaffWeeklyAvailabilityAction(
  rawInput: unknown
): Promise<ScheduleActionResult> {
  const branchId = readBranchId(rawInput);

  if (!branchId) {
    return genericScheduleActionFailure("INVALID_INPUT", "Invalid schedule.");
  }

  const contextResult = await getScheduleEditContext(branchId);

  if (!contextResult.ok) {
    return genericScheduleActionFailure("UNAUTHORIZED", PERMISSION_ERROR);
  }

  return toWebWeeklyResult(
    await replaceStaffWeeklySchedule(
      contextResult.context.supabase,
      contextResult.context.actor,
      rawInput
    )
  );
}

export async function updateCrmStaffWeeklyWindowScheduleAction(
  rawInput: unknown
): Promise<ScheduleActionResult> {
  const branchId = readBranchId(rawInput);

  if (!branchId) {
    return genericScheduleActionFailure("INVALID_INPUT", "Invalid schedule.");
  }

  const contextResult = await getScheduleEditContext(branchId);

  if (!contextResult.ok) {
    return genericScheduleActionFailure("UNAUTHORIZED", PERMISSION_ERROR);
  }

  return toWebWeeklyResult(
    await replaceStaffWeeklyWindowSchedule(
      contextResult.context.supabase,
      contextResult.context.actor,
      rawInput
    )
  );
}

export async function upsertCrmScheduleOverrideAction(
  rawInput: unknown
): Promise<ScheduleOverrideMutationResult> {
  const branchId = readBranchId(rawInput);

  if (!branchId) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: "Invalid day override.",
    };
  }

  const contextResult = await getScheduleEditContext(branchId);

  if (!contextResult.ok) {
    return {
      ok: false,
      code: "UNAUTHORIZED",
      message: PERMISSION_ERROR,
    };
  }

  return upsertScheduleOverride(
    contextResult.context.supabase,
    contextResult.context.actor,
    rawInput
  );
}

export async function deleteCrmScheduleOverrideAction(
  rawInput: unknown
): Promise<DeleteScheduleOverrideResult> {
  const branchId = readBranchId(rawInput);

  if (!branchId) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: "Invalid day override.",
    };
  }

  const contextResult = await getScheduleEditContext(branchId);

  if (!contextResult.ok) {
    return {
      ok: false,
      code: "UNAUTHORIZED",
      message: PERMISSION_ERROR,
    };
  }

  return deleteScheduleOverride(
    contextResult.context.supabase,
    contextResult.context.actor,
    rawInput
  );
}

export async function createCrmBlockedTimeAction(
  rawInput: unknown
): Promise<BlockedTimeMutationResult> {
  const branchId = readBranchId(rawInput);

  if (!branchId) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: "Invalid blocked time.",
    };
  }

  const contextResult = await getScheduleEditContext(branchId);

  if (!contextResult.ok) {
    return {
      ok: false,
      code: "UNAUTHORIZED",
      message: PERMISSION_ERROR,
    };
  }

  return createBlockedTime(contextResult.context.supabase, contextResult.context.actor, rawInput);
}

export async function deleteCrmBlockedTimeAction(
  rawInput: unknown
): Promise<DeleteBlockedTimeResult> {
  const branchId = readBranchId(rawInput);

  if (!branchId) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: "Invalid blocked time.",
    };
  }

  const contextResult = await getScheduleEditContext(branchId);

  if (!contextResult.ok) {
    return {
      ok: false,
      code: "UNAUTHORIZED",
      message: PERMISSION_ERROR,
    };
  }

  return deleteBlockedTime(contextResult.context.supabase, contextResult.context.actor, rawInput);
}
