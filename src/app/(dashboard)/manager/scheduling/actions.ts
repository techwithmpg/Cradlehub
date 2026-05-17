"use server";

import { createClient } from "@/lib/supabase/server";
import { isDevAuthBypassEnabled } from "@/lib/dev-bypass";
import { revalidatePath } from "next/cache";
import { logBusinessEvent } from "@/lib/logger";
import {
  SchedulingRulesUpsertSchema,
  ApproveSuggestionSchema,
  RejectSuggestionSchema,
  EvaluateHealthInputSchema,
  GenerateSuggestionsInputSchema,
} from "@/lib/scheduling/schemas";
import { getSchedulingRules } from "@/lib/scheduling/rules/get-scheduling-rules";
import { generateScheduleSuggestions } from "@/lib/scheduling/rules/generate-schedule-suggestions";
import { applyApprovedSuggestion } from "@/lib/scheduling/rules/apply-approved-suggestion";
import {
  notifyStaffSuggestionApproved,
  notifyStaffSuggestionRejected,
} from "@/lib/scheduling/rules/notify-affected-staff";
import type { ScheduleSuggestion } from "@/lib/scheduling/types";

// ── Auth helper ───────────────────────────────────────────────
async function requireManager() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  if (isDevAuthBypassEnabled()) {
    return {
      supabase,
      me: { id: "dev", branch_id: "00000000-0000-0000-0000-000000000000", system_role: "manager" },
    };
  }

  const { data: me } = await supabase
    .from("staff")
    .select("id, branch_id, system_role")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!me || !["manager", "owner"].includes(me.system_role)) return null;
  return { supabase, me };
}

// ── Upsert scheduling rules ───────────────────────────────────
export async function upsertSchedulingRulesAction(rawInput: unknown) {
  const parsed = SchedulingRulesUpsertSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const ctx = await requireManager();
  if (!ctx) return { success: false, error: "Unauthorized" };

  const branchId = ctx.me.branch_id;

  const { error } = await ctx.supabase.from("scheduling_rules").upsert(
    { branch_id: branchId, ...parsed.data },
    { onConflict: "branch_id" },
  );

  if (error) return { success: false, error: error.message };

  revalidatePath("/manager/settings");
  revalidatePath("/manager");
  logBusinessEvent("scheduling.rules_updated", { branchId, actorId: ctx.me.id, workspace: ctx.me.system_role });
  return { success: true };
}

// ── Get scheduling rules (server action for client components) ─
export async function getSchedulingRulesAction() {
  const ctx = await requireManager();
  if (!ctx) return { success: false as const, error: "Unauthorized" };

  const rules = await getSchedulingRules(ctx.me.branch_id);
  return { success: true as const, data: rules };
}

// ── Evaluate schedule health for a date ──────────────────────
export async function evaluateScheduleHealthAction(rawInput: unknown) {
  const parsed = EvaluateHealthInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const ctx = await requireManager();
  if (!ctx) return { success: false, error: "Unauthorized" };

  // Verify the branch matches the manager's branch (owners can pass any)
  const branchId =
    ctx.me.system_role === "owner" ? parsed.data.branch_id : ctx.me.branch_id;

  const { data: healthRow } = await ctx.supabase
    .from("schedule_health_checks")
    .select("*")
    .eq("branch_id", branchId)
    .eq("check_date", parsed.data.date)
    .maybeSingle();

  return { success: true, data: healthRow };
}

// ── Generate suggestions ──────────────────────────────────────
export async function generateSuggestionsAction(rawInput: unknown) {
  const parsed = GenerateSuggestionsInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const ctx = await requireManager();
  if (!ctx) return { success: false, error: "Unauthorized" };

  const branchId =
    ctx.me.system_role === "owner" ? parsed.data.branch_id : ctx.me.branch_id;

  const result = await generateScheduleSuggestions(
    branchId,
    parsed.data.date,
    parsed.data.dry_run,
  );

  revalidatePath("/manager");
  revalidatePath("/manager/scheduling");
  return { success: true, data: result };
}

// ── List pending suggestions ──────────────────────────────────
export async function listPendingSuggestionsAction(date?: string) {
  const ctx = await requireManager();
  if (!ctx) return { success: false as const, error: "Unauthorized" };

  let query = ctx.supabase
    .from("schedule_suggestions")
    .select("*, staff:staff_id(full_name, nickname, system_role)")
    .eq("branch_id", ctx.me.branch_id)
    .eq("status", "pending")
    .order("priority", { ascending: false })
    .order("target_date", { ascending: true });

  if (date) query = query.eq("target_date", date);

  const { data, error } = await query;
  if (error) return { success: false as const, error: error.message };

  return { success: true as const, data: data ?? [] };
}

// ── Approve a suggestion ──────────────────────────────────────
export async function approveSuggestionAction(rawInput: unknown) {
  const parsed = ApproveSuggestionSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const ctx = await requireManager();
  if (!ctx) return { success: false, error: "Unauthorized" };

  const { error } = await ctx.supabase
    .from("schedule_suggestions")
    .update({
      status:      "approved",
      approved_by: parsed.data.approved_by,
      approved_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.suggestion_id)
    .eq("branch_id", ctx.me.branch_id)
    .eq("status", "pending");

  if (error) return { success: false, error: error.message };

  // Fetch the updated suggestion to notify staff
  const { data: suggestion } = await ctx.supabase
    .from("schedule_suggestions")
    .select("*")
    .eq("id", parsed.data.suggestion_id)
    .maybeSingle();

  if (suggestion) {
    await notifyStaffSuggestionApproved(suggestion as ScheduleSuggestion, ctx.me.branch_id);

    // Auto-apply immediately
    await applyApprovedSuggestion(parsed.data.suggestion_id, ctx.me.branch_id);
  }

  revalidatePath("/manager");
  revalidatePath("/manager/scheduling");
  revalidatePath("/staff-portal/schedule");
  logBusinessEvent("scheduling.suggestion_approved", {
    suggestionId: parsed.data.suggestion_id,
    branchId: ctx.me.branch_id,
    actorId: ctx.me.id,
    workspace: ctx.me.system_role,
  });
  return { success: true };
}

// ── Reject a suggestion ───────────────────────────────────────
export async function rejectSuggestionAction(rawInput: unknown) {
  const parsed = RejectSuggestionSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const ctx = await requireManager();
  if (!ctx) return { success: false, error: "Unauthorized" };

  const { error } = await ctx.supabase
    .from("schedule_suggestions")
    .update({
      status:      "rejected",
      rejected_by: parsed.data.rejected_by,
      rejected_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.suggestion_id)
    .eq("branch_id", ctx.me.branch_id)
    .eq("status", "pending");

  if (error) return { success: false, error: error.message };

  const { data: suggestion } = await ctx.supabase
    .from("schedule_suggestions")
    .select("*")
    .eq("id", parsed.data.suggestion_id)
    .maybeSingle();

  if (suggestion) {
    await notifyStaffSuggestionRejected(suggestion as ScheduleSuggestion, ctx.me.branch_id);
  }

  revalidatePath("/manager");
  revalidatePath("/manager/scheduling");
  logBusinessEvent("scheduling.suggestion_rejected", {
    suggestionId: parsed.data.suggestion_id,
    branchId: ctx.me.branch_id,
    actorId: ctx.me.id,
    workspace: ctx.me.system_role,
  });
  return { success: true };
}
