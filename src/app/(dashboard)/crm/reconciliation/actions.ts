"use server";

import { createClient } from "@/lib/supabase/server";
import { isDevAuthBypassEnabled, getDevBypassLayoutStaff } from "@/lib/dev-bypass";
import { getPostedReconciliationExpected } from "@/lib/cash-flow/reconciliation-expected";
import { createNotification, resolveNotificationsForEntity } from "@/lib/notifications/create";
import { getNotificationTargetPath } from "@/lib/notifications/notification-targets";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canonicalizeSystemRole } from "@/constants/staff";
import { canAccessCrmWorkspace } from "@/lib/auth/crm-permissions";
import { getFrontDeskContext } from "@/lib/queries/crm-context";

async function requireCrmStaff() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  if (isDevAuthBypassEnabled()) {
    const mock = getDevBypassLayoutStaff();
    return { supabase, staffId: null as string | null, branchId: mock.branch_id as string, role: canonicalizeSystemRole(mock.system_role) };
  }

  const { data: me } = await supabase
    .from("staff")
    .select("id, branch_id, system_role")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  const role = me ? canonicalizeSystemRole(me.system_role) : null;
  if (!me || !role || !canAccessCrmWorkspace(role) || (role !== "owner" && !me.branch_id)) return null;
  const frontDesk = await getFrontDeskContext();
  return { supabase, staffId: me.id as string, branchId: frontDesk.branchId, role };
}

const upsertSchema = z.object({
  branchId:           z.string().uuid(),
  date:               z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  actualCash:         z.coerce.number().min(0).default(0),
  actualGcash:        z.coerce.number().min(0).default(0),
  actualMaya:         z.coerce.number().min(0).default(0),
  actualCard:         z.coerce.number().min(0).default(0),
  actualOther:        z.coerce.number().min(0).default(0),
  notes:              z.string().max(1000).optional(),
  status:             z.enum(["draft", "submitted"]).default("draft"),
});

export async function upsertReconciliationAction(rawInput: unknown) {
  const ctx = await requireCrmStaff();
  if (!ctx) return { ok: false as const, error: "Unauthorized" };

  const parsed = upsertSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const d = parsed.data;
  if (d.branchId !== ctx.branchId) {
    return { ok: false as const, error: "Selected branch changed. Refresh before saving reconciliation." };
  }

  let expected;
  try {
    expected = await getPostedReconciliationExpected(d.branchId, d.date, ctx.supabase);
  } catch {
    return { ok: false as const, error: "Posted financial movements could not be loaded. Reconciliation was not saved." };
  }

  const values = {
        branch_id:            d.branchId,
        reconciliation_date:  d.date,
        recorded_by:          ctx.staffId,
        expected_cash:        expected.cash,
        expected_gcash:       expected.gcash,
        expected_maya:        expected.maya,
        expected_card:        expected.card,
        expected_other:       expected.other,
        actual_cash:          d.actualCash,
        actual_gcash:         d.actualGcash,
        actual_maya:          d.actualMaya,
        actual_card:          d.actualCard,
        actual_other:         d.actualOther,
        notes:                d.notes ?? null,
        status:               d.status,
        updated_at:           new Date().toISOString(),
  };

  const { data: existing, error: lookupError } = await ctx.supabase
    .from("daily_cash_reconciliations")
    .select("id, status")
    .eq("branch_id", d.branchId)
    .eq("reconciliation_date", d.date)
    .maybeSingle();
  if (lookupError) {
    return { ok: false as const, error: "Could not check reconciliation state." };
  }
  if (existing?.status === "approved") {
    return { ok: false as const, error: "Approved reconciliations cannot be edited." };
  }

  const { data: reconciliation, error } = existing
    ? await ctx.supabase
        .from("daily_cash_reconciliations")
        .update(values)
        .eq("id", existing.id)
        .neq("status", "approved")
        .select("id")
        .maybeSingle()
    : await ctx.supabase
        .from("daily_cash_reconciliations")
        .insert(values)
        .select("id")
        .maybeSingle();

  if (error || !reconciliation) {
    return { ok: false as const, error: error?.message ?? "Reconciliation state changed; refresh before saving." };
  }

  if (d.status === "submitted") {
    const dateLabel = d.date;
    await createNotification({
      branchId: d.branchId,
      targetWorkspace: "manager",
      type: "reconciliation_submitted",
      title: "Daily reconciliation submitted",
      body: `Cash reconciliation for ${dateLabel} has been submitted for review.`,
      entityType: "reconciliation",
      entityId: reconciliation.id,
      actionHref: getNotificationTargetPath({ workspace: "manager", entityType: "reconciliation", entityId: reconciliation.id }),
      priority: "normal",
      requiresAction: true,
    });
    await createNotification({
      targetWorkspace: "owner",
      type: "reconciliation_submitted",
      title: "Daily reconciliation submitted",
      body: `Cash reconciliation for ${dateLabel} (branch ${d.branchId.slice(0, 8)}…) has been submitted.`,
      entityType: "reconciliation",
      entityId: reconciliation.id,
      actionHref: getNotificationTargetPath({ workspace: "owner", entityType: "reconciliation", entityId: reconciliation.id }),
      priority: "low",
      requiresAction: false,
    });
  }

  revalidatePath("/crm/reconciliation");
  return { ok: true as const };
}

export async function approveReconciliationAction(reconciliationId: string) {
  const ctx = await requireCrmStaff();
  if (!ctx) return { ok: false as const, error: "Unauthorized" };
  if (ctx.role !== "owner" && ctx.role !== "manager") {
    return { ok: false as const, error: "Only an owner or manager can approve reconciliation." };
  }

  const { data: updatedRows, error } = await ctx.supabase
    .from("daily_cash_reconciliations")
    .update({ status: "approved", updated_at: new Date().toISOString() })
    .eq("id", reconciliationId)
    .eq("branch_id", ctx.branchId)
    .eq("status", "submitted")
    .select("id");

  if (error) return { ok: false as const, error: error.message };
  if (!updatedRows || updatedRows.length === 0) {
    return {
      ok: false as const,
      error: "Reconciliation record could not be approved. It may belong to a different branch or no longer exist.",
    };
  }

  await resolveNotificationsForEntity("reconciliation", reconciliationId);

  revalidatePath("/crm/reconciliation");
  return { ok: true as const };
}

export async function getReconciliationsAction(branchId: string, limit = 30) {
  const ctx = await requireCrmStaff();
  if (!ctx) return { ok: false as const, error: "Unauthorized", data: [] };
  if (branchId !== ctx.branchId) {
    return { ok: false as const, error: "Selected branch changed. Refresh before loading reconciliation.", data: [] };
  }

  const { data, error } = await ctx.supabase
    .from("daily_cash_reconciliations")
    .select("*, staff ( full_name )")
    .eq("branch_id", branchId)
    .order("reconciliation_date", { ascending: false })
    .limit(limit);

  if (error) return { ok: false as const, error: error.message, data: [] };
  return { ok: true as const, data: data ?? [] };
}
