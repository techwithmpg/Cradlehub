"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_PAYROLL_SETTINGS,
  computeNextPayrollDate,
  getMonthBounds,
  normalizePaymentMethods,
  type PayrollPaymentMethod,
  type PayrollSettings,
} from "@/lib/payroll/fixed-monthly";
import { getPayrollSettings } from "@/lib/queries/payroll";

type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

type OwnerContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  me: {
    id: string;
    branch_id: string | null;
    system_role: string | null;
  };
};

async function requireOwner(): Promise<OwnerContext | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: me } = await supabase
    .from("staff")
    .select("id, branch_id, system_role")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!me) return { error: "No active staff record" };
  if (me.system_role !== "owner") return { error: "Owner access required" };
  return { supabase, me };
}

function normalizeSettings(input: PayrollSettings): PayrollSettings {
  const fixedDay = Math.min(Math.max(Math.round(Number(input.fixedDay) || 30), 1), 31);
  const customReminderDays = Math.min(
    Math.max(Math.round(Number(input.customReminderDays) || 0), 0),
    31
  );
  const enabledPaymentMethods = normalizePaymentMethods(input.enabledPaymentMethods);

  return {
    paydayRule: input.paydayRule === "last_day_of_month" ? "last_day_of_month" : "fixed_day",
    fixedDay,
    weekendAdjustment: input.weekendAdjustment === "none" ? "none" : "prior_business_day",
    reminderPreset: ["none", "1", "2", "3", "5", "7", "custom"].includes(input.reminderPreset)
      ? input.reminderPreset
      : DEFAULT_PAYROLL_SETTINGS.reminderPreset,
    customReminderDays,
    includeInactiveEmployees: Boolean(input.includeInactiveEmployees),
    defaultPaymentStatus: "unpaid",
    allowStatusEditing: Boolean(input.allowStatusEditing),
    showTotalPayroll: Boolean(input.showTotalPayroll),
    trackingStartMonth: Math.min(Math.max(Math.round(Number(input.trackingStartMonth) || 1), 1), 12),
    trackingStartYear: Math.min(
      Math.max(Math.round(Number(input.trackingStartYear) || new Date().getFullYear()), 2020),
      2100
    ),
    continueRemindersWhileUnpaid: Boolean(input.continueRemindersWhileUnpaid),
    enabledPaymentMethods,
    showOwnerDashboardReminder: Boolean(input.showOwnerDashboardReminder),
    showPayrollPageReminder: Boolean(input.showPayrollPageReminder),
    notifyPayrollDue: Boolean(input.notifyPayrollDue),
    notifyPayrollFullyPaid: Boolean(input.notifyPayrollFullyPaid),
  };
}

async function getOrCreateCurrentPeriod(ctx: OwnerContext): Promise<ActionResult<{ id: string; start: string; end: string }>> {
  const settings = await getPayrollSettings();
  const month = getMonthBounds(computeNextPayrollDate(settings));

  const { data: existing, error: existingError } = await ctx.supabase
    .from("payroll_periods")
    .select("id")
    .eq("period_start", month.start)
    .eq("period_end", month.end)
    .is("branch_id", null)
    .order("created_at", { ascending: false })
    .limit(1);

  if (existingError) return { ok: false, error: existingError.message };
  const periodId = existing?.[0]?.id;
  if (periodId) return { ok: true, data: { id: periodId, start: month.start, end: month.end } };

  const { data: created, error: createError } = await ctx.supabase
    .from("payroll_periods")
    .insert({
      branch_id: null,
      period_start: month.start,
      period_end: month.end,
      status: "draft",
      created_by: ctx.me.id,
      notes: "Fixed monthly payroll snapshot",
    })
    .select("id")
    .single();

  if (createError) return { ok: false, error: createError.message };
  return { ok: true, data: { id: created.id, start: month.start, end: month.end } };
}

async function getMonthlyProfile(
  ctx: OwnerContext,
  staffId: string
): Promise<ActionResult<{ branchId: string | null; amount: number }>> {
  const { data: staff, error: staffError } = await ctx.supabase
    .from("staff")
    .select("id, branch_id, system_role")
    .eq("id", staffId)
    .maybeSingle();

  if (staffError) return { ok: false, error: staffError.message };
  if (!staff) return { ok: false, error: "Staff member not found" };
  if (staff.system_role === "owner") return { ok: false, error: "Owner payroll is not managed here" };

  const { data: profile, error: profileError } = await ctx.supabase
    .from("staff_pay_profiles")
    .select("base_pay_amount, base_pay_type")
    .eq("staff_id", staffId)
    .eq("is_active", true)
    .order("effective_from", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (profileError) return { ok: false, error: profileError.message };
  if (!profile || profile.base_pay_type !== "monthly" || Number(profile.base_pay_amount) <= 0) {
    return { ok: false, error: "Set a monthly pay amount before marking this staff member paid" };
  }

  return {
    ok: true,
    data: {
      branchId: staff.branch_id,
      amount: Number(profile.base_pay_amount),
    },
  };
}

export async function updatePayrollSettingsAction(
  input: PayrollSettings
): Promise<ActionResult<PayrollSettings>> {
  const ctx = await requireOwner();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const settings = normalizeSettings(input);
  const { error } = await ctx.supabase
    .from("payroll_settings")
    .upsert({
      id: "default",
      payday_rule: settings.paydayRule,
      fixed_day: settings.fixedDay,
      weekend_adjustment: settings.weekendAdjustment,
      reminder_preset: settings.reminderPreset,
      custom_reminder_days: settings.customReminderDays,
      include_inactive_employees: settings.includeInactiveEmployees,
      default_payment_status: settings.defaultPaymentStatus,
      allow_status_editing: settings.allowStatusEditing,
      show_total_payroll: settings.showTotalPayroll,
      tracking_start_month: settings.trackingStartMonth,
      tracking_start_year: settings.trackingStartYear,
      continue_reminders_while_unpaid: settings.continueRemindersWhileUnpaid,
      enabled_payment_methods: settings.enabledPaymentMethods as PayrollPaymentMethod[],
      show_owner_dashboard_reminder: settings.showOwnerDashboardReminder,
      show_payroll_page_reminder: settings.showPayrollPageReminder,
      notify_payroll_due: settings.notifyPayrollDue,
      notify_payroll_fully_paid: settings.notifyPayrollFullyPaid,
      updated_by: ctx.me.id,
    });

  if (error) return { ok: false, error: error.message };
  revalidatePath("/owner/payroll");
  return { ok: true, data: settings };
}

export async function saveMonthlyPayAction(input: {
  staffId: string;
  amount: number;
}): Promise<ActionResult<void>> {
  const ctx = await requireOwner();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const amount = Math.round(Number(input.amount) * 100) / 100;
  if (!input.staffId) return { ok: false, error: "Choose a staff member" };
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: "Monthly amount must be greater than zero" };
  }

  const { data: staff, error: staffError } = await ctx.supabase
    .from("staff")
    .select("id, branch_id, system_role")
    .eq("id", input.staffId)
    .maybeSingle();

  if (staffError) return { ok: false, error: staffError.message };
  if (!staff) return { ok: false, error: "Staff member not found" };
  if (staff.system_role === "owner") return { ok: false, error: "Owner payroll is not managed here" };

  await ctx.supabase
    .from("staff_pay_profiles")
    .update({ is_active: false, effective_until: new Date().toISOString().slice(0, 10) })
    .eq("staff_id", input.staffId)
    .eq("is_active", true);

  const { error } = await ctx.supabase
    .from("staff_pay_profiles")
    .insert({
      staff_id: input.staffId,
      branch_id: staff.branch_id,
      base_pay_amount: amount,
      base_pay_type: "monthly",
      commission_percent: 0,
      per_service_bonus: 0,
      home_service_allowance: 0,
      transport_allowance: 0,
      effective_from: new Date().toISOString().slice(0, 10),
      effective_until: null,
      is_active: true,
    });

  if (error) return { ok: false, error: error.message };

  const period = await getOrCreateCurrentPeriod(ctx);
  if (period.ok) {
    const { data: item } = await ctx.supabase
      .from("payroll_items")
      .select("id, status")
      .eq("payroll_period_id", period.data.id)
      .eq("staff_id", input.staffId)
      .neq("status", "voided")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (item && item.status !== "paid") {
      await ctx.supabase
        .from("payroll_items")
        .update({
          base_pay: amount,
          net_pay: amount,
          metadata: {
            payroll_model: "fixed_monthly",
            salary_snapshot: amount,
            updated_from_monthly_setup_at: new Date().toISOString(),
          },
        })
        .eq("id", item.id);
    }
  }

  revalidatePath("/owner/payroll");
  return { ok: true, data: undefined };
}

export async function markStaffPayrollPaidAction(staffId: string): Promise<ActionResult<void>> {
  const ctx = await requireOwner();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const settings = await getPayrollSettings();
  if (!settings.allowStatusEditing) return { ok: false, error: "Payment status editing is disabled" };

  const profile = await getMonthlyProfile(ctx, staffId);
  if (!profile.ok) return { ok: false, error: profile.error };

  const period = await getOrCreateCurrentPeriod(ctx);
  if (!period.ok) return { ok: false, error: period.error };

  const { data: existing, error: existingError } = await ctx.supabase
    .from("payroll_items")
    .select("id")
    .eq("payroll_period_id", period.data.id)
    .eq("staff_id", staffId)
    .neq("status", "voided")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) return { ok: false, error: existingError.message };

  const snapshot = {
    payroll_model: "fixed_monthly",
    salary_snapshot: profile.data.amount,
    paid_at: new Date().toISOString(),
  };

  if (existing) {
    const { error } = await ctx.supabase
      .from("payroll_items")
      .update({
        status: "paid",
        base_pay: profile.data.amount,
        net_pay: profile.data.amount,
        metadata: snapshot,
      })
      .eq("id", existing.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await ctx.supabase.from("payroll_items").insert({
      payroll_period_id: period.data.id,
      staff_id: staffId,
      branch_id: profile.data.branchId,
      completed_bookings_count: 0,
      home_service_bookings_count: 0,
      gross_revenue: 0,
      base_pay: profile.data.amount,
      commission_pay: 0,
      bonus_pay: 0,
      reimbursement_pay: 0,
      home_service_allowance_pay: 0,
      deduction_amount: 0,
      salary_advance_amount: 0,
      net_pay: profile.data.amount,
      status: "paid",
      metadata: snapshot,
    });
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/owner/payroll");
  return { ok: true, data: undefined };
}

export async function markStaffPayrollUnpaidAction(staffId: string): Promise<ActionResult<void>> {
  const ctx = await requireOwner();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const settings = await getPayrollSettings();
  if (!settings.allowStatusEditing) return { ok: false, error: "Payment status editing is disabled" };

  const period = await getOrCreateCurrentPeriod(ctx);
  if (!period.ok) return { ok: false, error: period.error };

  const { data: existing, error: existingError } = await ctx.supabase
    .from("payroll_items")
    .select("id")
    .eq("payroll_period_id", period.data.id)
    .eq("staff_id", staffId)
    .eq("status", "paid")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) return { ok: false, error: existingError.message };
  if (!existing) return { ok: true, data: undefined };

  const { error } = await ctx.supabase
    .from("payroll_items")
    .update({
      status: "draft",
      metadata: {
        payroll_model: "fixed_monthly",
        marked_unpaid_at: new Date().toISOString(),
      },
    })
    .eq("id", existing.id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/owner/payroll");
  return { ok: true, data: undefined };
}
