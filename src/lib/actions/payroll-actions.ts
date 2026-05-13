"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  calculateBasePay,
  calculateCommission,
  calculateHomeServiceAllowance,
  calculateServiceBonus,
} from "@/lib/payroll/calculations";
import type { PayProfile } from "@/lib/payroll/calculations";

type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

// ── Auth helper ───────────────────────────────────────────────────────────────

async function requireOwner() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" as const };

  const { data: me } = await supabase
    .from("staff")
    .select("id, branch_id, system_role")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!me) return { error: "No active staff record" as const };
  if (me.system_role !== "owner") return { error: "Owner access required" as const };
  return { supabase, me };
}

// ─────────────────────────────────────────────────────────────────────────────
// PAY PROFILES
// ─────────────────────────────────────────────────────────────────────────────

export type UpsertPayProfileInput = {
  staffId: string;
  branchId?: string | null;
  basePayAmount: number;
  basePayType: "none" | "daily" | "weekly" | "monthly";
  commissionPercent: number;
  perServiceBonus: number;
  homeServiceAllowance: number;
  transportAllowance: number;
  effectiveFrom: string;
  effectiveUntil?: string | null;
};

/** Create or replace the active pay profile for a staff member. */
export async function upsertStaffPayProfileAction(
  input: UpsertPayProfileInput
): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireOwner();
  if ("error" in ctx) return { ok: false, error: ctx.error as string };
  const { supabase } = ctx;

  // Deactivate existing profiles for this staff member
  await supabase
    .from("staff_pay_profiles")
    .update({ is_active: false })
    .eq("staff_id", input.staffId)
    .eq("is_active", true);

  const { data, error } = await supabase
    .from("staff_pay_profiles")
    .insert({
      staff_id: input.staffId,
      branch_id: input.branchId ?? null,
      base_pay_amount: input.basePayAmount,
      base_pay_type: input.basePayType,
      commission_percent: input.commissionPercent,
      per_service_bonus: input.perServiceBonus,
      home_service_allowance: input.homeServiceAllowance,
      transport_allowance: input.transportAllowance,
      effective_from: input.effectiveFrom,
      effective_until: input.effectiveUntil ?? null,
      is_active: true,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath("/owner/payroll");
  return { ok: true, data: { id: data.id as string } };
}

// ─────────────────────────────────────────────────────────────────────────────
// PAYROLL PERIODS
// ─────────────────────────────────────────────────────────────────────────────

export type CreatePayrollPeriodInput = {
  branchId?: string | null;
  periodStart: string;
  periodEnd: string;
  notes?: string | null;
};

/** Create a new payroll period in draft status. */
export async function createPayrollPeriodAction(
  input: CreatePayrollPeriodInput
): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireOwner();
  if ("error" in ctx) return { ok: false, error: ctx.error as string };
  const { supabase, me } = ctx;

  if (input.periodEnd < input.periodStart) {
    return { ok: false, error: "Period end must be on or after period start" };
  }

  const { data, error } = await supabase
    .from("payroll_periods")
    .insert({
      branch_id: input.branchId ?? null,
      period_start: input.periodStart,
      period_end: input.periodEnd,
      status: "draft",
      created_by: me.id as string,
      notes: input.notes ?? null,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath("/owner/payroll");
  return { ok: true, data: { id: data.id as string } };
}

// ─────────────────────────────────────────────────────────────────────────────
// PAYROLL ITEM GENERATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate payroll_items for a period from completed bookings.
 * Replaces any existing draft items for this period.
 * Period must be in 'draft' status.
 */
export async function generatePayrollItemsAction(
  periodId: string
): Promise<ActionResult<{ itemsGenerated: number }>> {
  const ctx = await requireOwner();
  if ("error" in ctx) return { ok: false, error: ctx.error as string };
  const { supabase } = ctx;

  // Load period
  const { data: period, error: periodErr } = await supabase
    .from("payroll_periods")
    .select("id, branch_id, period_start, period_end, status")
    .eq("id", periodId)
    .maybeSingle();

  if (periodErr) return { ok: false, error: periodErr.message };
  if (!period) return { ok: false, error: "Payroll period not found" };
  if (period.status !== "draft") {
    return { ok: false, error: "Only draft periods can be regenerated" };
  }

  // Fetch completed bookings in the period for the branch
  let query = supabase
    .from("bookings")
    .select("id, staff_id, branch_id, amount_paid, delivery_type, status")
    .gte("booking_date", period.period_start)
    .lte("booking_date", period.period_end)
    .eq("status", "completed");

  if (period.branch_id) {
    query = query.eq("branch_id", period.branch_id);
  }

  const { data: bookings, error: bookErr } = await query;
  if (bookErr) return { ok: false, error: bookErr.message };

  if (!bookings || bookings.length === 0) {
    // Delete any stale draft items and return
    await supabase.from("payroll_items").delete().eq("payroll_period_id", periodId).eq("status", "draft");
    revalidatePath("/owner/payroll");
    return { ok: true, data: { itemsGenerated: 0 } };
  }

  // Aggregate per staff member
  type StaffBucket = {
    staffId: string;
    branchId: string | null;
    completedCount: number;
    homeServiceCount: number;
    grossRevenue: number;
    bookingIds: string[];
  };
  const buckets = new Map<string, StaffBucket>();

  for (const b of bookings) {
    if (!b.staff_id) continue;
    let bucket = buckets.get(b.staff_id);
    if (!bucket) {
      bucket = {
        staffId: b.staff_id,
        branchId: (b as { branch_id?: string | null }).branch_id ?? null,
        completedCount: 0,
        homeServiceCount: 0,
        grossRevenue: 0,
        bookingIds: [],
      };
      buckets.set(b.staff_id, bucket);
    }
    bucket.completedCount++;
    bucket.grossRevenue += Number(b.amount_paid ?? 0);
    bucket.bookingIds.push(b.id);
    if (b.delivery_type === "home_service") {
      bucket.homeServiceCount++;
    }
  }

  // Load pay profiles for all staff in period (active profiles effective by period_start)
  const staffIds = [...buckets.keys()];
  const { data: profiles } = await supabase
    .from("staff_pay_profiles")
    .select("staff_id, base_pay_amount, base_pay_type, commission_percent, per_service_bonus, home_service_allowance, transport_allowance")
    .in("staff_id", staffIds)
    .eq("is_active", true)
    .lte("effective_from", period.period_end);

  const profileMap = new Map<string, PayProfile>();
  for (const p of profiles ?? []) {
    // Keep last-inserted (most recent effective_from wins — already sorted by DB default)
    if (!profileMap.has(p.staff_id)) {
      profileMap.set(p.staff_id, {
        base_pay_amount: Number(p.base_pay_amount),
        base_pay_type: p.base_pay_type as PayProfile["base_pay_type"],
        commission_percent: Number(p.commission_percent),
        per_service_bonus: Number(p.per_service_bonus),
        home_service_allowance: Number(p.home_service_allowance),
        transport_allowance: Number(p.transport_allowance),
      });
    }
  }

  const defaultProfile: PayProfile = {
    base_pay_amount: 0,
    base_pay_type: "none",
    commission_percent: 0,
    per_service_bonus: 0,
    home_service_allowance: 0,
    transport_allowance: 0,
  };

  // Delete existing draft items for this period
  await supabase
    .from("payroll_items")
    .delete()
    .eq("payroll_period_id", periodId)
    .eq("status", "draft");

  // Build upsert rows
  const rows = [...buckets.values()].map((bucket) => {
    const profile = profileMap.get(bucket.staffId) ?? defaultProfile;
    const basePay = calculateBasePay(profile, period.period_start, period.period_end);
    const commissionPay = calculateCommission(bucket.grossRevenue, profile.commission_percent);
    const serviceBonusPay = calculateServiceBonus(bucket.completedCount, profile.per_service_bonus);
    const hsAllowance = calculateHomeServiceAllowance(
      bucket.homeServiceCount,
      profile.home_service_allowance
    );
    const netPay = Math.round(
      (basePay + commissionPay + serviceBonusPay + hsAllowance) * 100
    ) / 100;

    return {
      payroll_period_id: periodId,
      staff_id: bucket.staffId,
      branch_id: bucket.branchId ?? (period.branch_id ?? null),
      completed_bookings_count: bucket.completedCount,
      home_service_bookings_count: bucket.homeServiceCount,
      gross_revenue: Math.round(bucket.grossRevenue * 100) / 100,
      base_pay: basePay,
      commission_pay: commissionPay,
      bonus_pay: serviceBonusPay,
      reimbursement_pay: 0,
      home_service_allowance_pay: hsAllowance,
      deduction_amount: 0,
      salary_advance_amount: 0,
      net_pay: netPay,
      status: "draft",
      metadata: {
        profile_snapshot: profile,
        booking_ids: bucket.bookingIds,
        generated_at: new Date().toISOString(),
      },
    };
  });

  if (rows.length === 0) {
    revalidatePath("/owner/payroll");
    return { ok: true, data: { itemsGenerated: 0 } };
  }

  const { error: insertErr } = await supabase.from("payroll_items").insert(rows);
  if (insertErr) return { ok: false, error: insertErr.message };

  // Advance period status to locked
  await supabase
    .from("payroll_periods")
    .update({ status: "locked" })
    .eq("id", periodId);

  revalidatePath("/owner/payroll");
  return { ok: true, data: { itemsGenerated: rows.length } };
}

// ─────────────────────────────────────────────────────────────────────────────
// ADJUSTMENTS
// ─────────────────────────────────────────────────────────────────────────────

export type AddAdjustmentInput = {
  payrollItemId: string;
  adjustmentType: "bonus" | "deduction" | "reimbursement" | "salary_advance" | "correction";
  amount: number;
  reason: string;
};

/** Add a bonus, deduction, or other adjustment to a payroll item and recalculate net_pay. */
export async function addPayrollAdjustmentAction(
  input: AddAdjustmentInput
): Promise<ActionResult<void>> {
  if (!input.reason?.trim()) return { ok: false, error: "Reason is required" };
  if (input.amount === 0) return { ok: false, error: "Amount cannot be zero" };

  const ctx = await requireOwner();
  if ("error" in ctx) return { ok: false, error: ctx.error as string };
  const { supabase, me } = ctx;

  // Load item
  const { data: item, error: itemErr } = await supabase
    .from("payroll_items")
    .select("id, payroll_period_id, status, base_pay, commission_pay, bonus_pay, reimbursement_pay, home_service_allowance_pay, deduction_amount, salary_advance_amount")
    .eq("id", input.payrollItemId)
    .maybeSingle();

  if (itemErr) return { ok: false, error: itemErr.message };
  if (!item) return { ok: false, error: "Payroll item not found" };
  if (item.status === "paid" || item.status === "voided") {
    return { ok: false, error: "Cannot adjust a paid or voided item" };
  }

  // Insert adjustment
  const { error: adjErr } = await supabase.from("payroll_adjustments").insert({
    payroll_item_id: input.payrollItemId,
    adjustment_type: input.adjustmentType,
    amount: Math.abs(input.amount),
    reason: input.reason.trim(),
    created_by: me.id as string,
  });
  if (adjErr) return { ok: false, error: adjErr.message };

  // Recalculate net_pay from all adjustments
  const { data: allAdj } = await supabase
    .from("payroll_adjustments")
    .select("adjustment_type, amount")
    .eq("payroll_item_id", input.payrollItemId);

  let bonusDelta = 0;
  let reimbDelta = 0;
  let deductDelta = 0;
  let advanceDelta = 0;
  let correctionDelta = 0;

  for (const adj of allAdj ?? []) {
    const amt = Number(adj.amount);
    switch (adj.adjustment_type) {
      case "bonus":       bonusDelta   += amt; break;
      case "reimbursement": reimbDelta += amt; break;
      case "deduction":   deductDelta  += amt; break;
      case "salary_advance": advanceDelta += amt; break;
      case "correction":  correctionDelta += input.amount < 0 ? -amt : amt; break;
    }
  }

  const baseBonusPay = Number(item.bonus_pay);
  const newBonusPay = Math.round((baseBonusPay + bonusDelta) * 100) / 100;
  const newReimbPay = Math.round(reimbDelta * 100) / 100;
  const newDeduction = Math.round(deductDelta * 100) / 100;
  const newAdvance = Math.round(advanceDelta * 100) / 100;

  const netPay = Math.round(
    (
      Number(item.base_pay) +
      Number(item.commission_pay) +
      newBonusPay +
      newReimbPay +
      Number(item.home_service_allowance_pay) +
      correctionDelta -
      newDeduction -
      newAdvance
    ) * 100
  ) / 100;

  await supabase
    .from("payroll_items")
    .update({
      bonus_pay: newBonusPay,
      reimbursement_pay: newReimbPay,
      deduction_amount: newDeduction,
      salary_advance_amount: newAdvance,
      net_pay: netPay,
    })
    .eq("id", input.payrollItemId);

  revalidatePath("/owner/payroll");
  return { ok: true, data: undefined };
}

// ─────────────────────────────────────────────────────────────────────────────
// PERIOD LIFECYCLE
// ─────────────────────────────────────────────────────────────────────────────

/** Approve a locked payroll period. */
export async function approvePayrollPeriodAction(
  periodId: string
): Promise<ActionResult<void>> {
  const ctx = await requireOwner();
  if ("error" in ctx) return { ok: false, error: ctx.error as string };
  const { supabase, me } = ctx;

  const { data: period } = await supabase
    .from("payroll_periods")
    .select("id, status")
    .eq("id", periodId)
    .maybeSingle();

  if (!period) return { ok: false, error: "Period not found" };
  if (period.status !== "locked") {
    return { ok: false, error: "Only locked periods can be approved" };
  }

  const { error } = await supabase
    .from("payroll_periods")
    .update({
      status: "approved",
      approved_by: me.id as string,
      approved_at: new Date().toISOString(),
    })
    .eq("id", periodId);

  if (error) return { ok: false, error: error.message };

  // Mark all draft items as approved
  await supabase
    .from("payroll_items")
    .update({ status: "approved" })
    .eq("payroll_period_id", periodId)
    .eq("status", "draft");

  revalidatePath("/owner/payroll");
  return { ok: true, data: undefined };
}

/** Mark an approved payroll period as paid. */
export async function markPayrollPeriodPaidAction(
  periodId: string
): Promise<ActionResult<void>> {
  const ctx = await requireOwner();
  if ("error" in ctx) return { ok: false, error: ctx.error as string };
  const { supabase } = ctx;

  const { data: period } = await supabase
    .from("payroll_periods")
    .select("id, status")
    .eq("id", periodId)
    .maybeSingle();

  if (!period) return { ok: false, error: "Period not found" };
  if (period.status !== "approved") {
    return { ok: false, error: "Only approved periods can be marked paid" };
  }

  const { error } = await supabase
    .from("payroll_periods")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", periodId);

  if (error) return { ok: false, error: error.message };

  await supabase
    .from("payroll_items")
    .update({ status: "paid" })
    .eq("payroll_period_id", periodId)
    .eq("status", "approved");

  revalidatePath("/owner/payroll");
  return { ok: true, data: undefined };
}

/** Cancel a draft or locked period. */
export async function cancelPayrollPeriodAction(
  periodId: string
): Promise<ActionResult<void>> {
  const ctx = await requireOwner();
  if ("error" in ctx) return { ok: false, error: ctx.error as string };
  const { supabase } = ctx;

  const { data: period } = await supabase
    .from("payroll_periods")
    .select("id, status")
    .eq("id", periodId)
    .maybeSingle();

  if (!period) return { ok: false, error: "Period not found" };
  if (!["draft", "locked"].includes(period.status)) {
    return { ok: false, error: "Only draft or locked periods can be cancelled" };
  }

  const { error } = await supabase
    .from("payroll_periods")
    .update({ status: "cancelled" })
    .eq("id", periodId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/owner/payroll");
  return { ok: true, data: undefined };
}
