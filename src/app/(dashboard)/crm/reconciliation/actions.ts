"use server";

import { createClient } from "@/lib/supabase/server";
import { isDevAuthBypassEnabled, getDevBypassLayoutStaff } from "@/lib/dev-bypass";
import { getDailyPaymentSummary } from "@/lib/queries/bookings";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const ALLOWED_ROLES = ["owner", "manager", "crm", "csr", "csr_head", "csr_staff"];

async function requireCrmStaff() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  if (isDevAuthBypassEnabled()) {
    const mock = getDevBypassLayoutStaff();
    return { supabase, staffId: null as string | null, branchId: mock.branch_id as string };
  }

  const { data: me } = await supabase
    .from("staff")
    .select("id, branch_id, system_role")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!me || !ALLOWED_ROLES.includes(me.system_role) || !me.branch_id) return null;
  return { supabase, staffId: me.id as string, branchId: me.branch_id as string };
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

  // Load expected totals from payment summary
  const summary = await getDailyPaymentSummary(d.branchId, d.date).catch(() => null);
  const expected = summary?.by_method ?? { cash: 0, gcash: 0, maya: 0, card: 0, pay_on_site: 0, other: 0 };

  const { error } = await ctx.supabase
    .from("daily_cash_reconciliations")
    .upsert(
      {
        branch_id:            d.branchId,
        reconciliation_date:  d.date,
        recorded_by:          ctx.staffId,
        expected_cash:        expected.cash,
        expected_gcash:       expected.gcash,
        expected_maya:        expected.maya,
        expected_card:        expected.card,
        expected_other:       expected.other + expected.pay_on_site,
        actual_cash:          d.actualCash,
        actual_gcash:         d.actualGcash,
        actual_maya:          d.actualMaya,
        actual_card:          d.actualCard,
        actual_other:         d.actualOther,
        notes:                d.notes ?? null,
        status:               d.status,
        updated_at:           new Date().toISOString(),
      },
      { onConflict: "branch_id,reconciliation_date" }
    );

  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/crm/reconciliation");
  return { ok: true as const };
}

export async function approveReconciliationAction(reconciliationId: string) {
  const ctx = await requireCrmStaff();
  if (!ctx) return { ok: false as const, error: "Unauthorized" };

  const { error } = await ctx.supabase
    .from("daily_cash_reconciliations")
    .update({ status: "approved", updated_at: new Date().toISOString() })
    .eq("id", reconciliationId)
    .eq("branch_id", ctx.branchId);

  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/crm/reconciliation");
  return { ok: true as const };
}

export async function getReconciliationsAction(branchId: string, limit = 30) {
  const ctx = await requireCrmStaff();
  if (!ctx) return { ok: false as const, error: "Unauthorized", data: [] };

  const { data, error } = await ctx.supabase
    .from("daily_cash_reconciliations")
    .select("*, staff ( full_name )")
    .eq("branch_id", branchId)
    .order("reconciliation_date", { ascending: false })
    .limit(limit);

  if (error) return { ok: false as const, error: error.message, data: [] };
  return { ok: true as const, data: data ?? [] };
}
