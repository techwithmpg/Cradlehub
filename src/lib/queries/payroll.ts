import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_PAYROLL_SETTINGS,
  calculatePayrollProgress,
  computeNextPayrollDate,
  formatPayrollDate,
  getCountdownLabel,
  getMonthBounds,
  getPayrollReminderMessage,
  normalizePaymentMethods,
  toIsoDate,
  type PayrollPaymentMethod,
  type PayrollSettings,
  type ReminderPreset,
} from "@/lib/payroll/fixed-monthly";
import { STAFF_TYPE_LABELS, SYSTEM_ROLE_LABELS } from "@/constants/staff-roles";
import { getStaffAdminName } from "@/lib/staff/display-name";

export type PayrollPeriodRow = {
  id: string;
  branch_id: string | null;
  branch_name: string | null;
  period_start: string;
  period_end: string;
  status: string;
  notes: string | null;
  created_by_name: string | null;
  approved_by_name: string | null;
  approved_at: string | null;
  paid_at: string | null;
  created_at: string;
  item_count: number;
  total_net_pay: number;
};

export type PayrollItemRow = {
  id: string;
  staff_id: string;
  staff_name: string;
  branch_id: string | null;
  completed_bookings_count: number;
  home_service_bookings_count: number;
  gross_revenue: number;
  base_pay: number;
  commission_pay: number;
  bonus_pay: number;
  reimbursement_pay: number;
  home_service_allowance_pay: number;
  deduction_amount: number;
  salary_advance_amount: number;
  net_pay: number;
  status: string;
  notes: string | null;
  adjustments: PayrollAdjustmentRow[];
};

export type PayrollAdjustmentRow = {
  id: string;
  adjustment_type: string;
  amount: number;
  reason: string;
  created_by_name: string | null;
  created_at: string;
};

export type StaffPayProfileRow = {
  id: string;
  staff_id: string;
  staff_name: string;
  branch_id: string | null;
  base_pay_amount: number;
  base_pay_type: string;
  commission_percent: number;
  per_service_bonus: number;
  home_service_allowance: number;
  transport_allowance: number;
  is_active: boolean;
  effective_from: string;
  effective_until: string | null;
};

export type PayrollDashboardStaffRow = {
  id: string;
  display_name: string;
  full_name: string | null;
  nickname: string | null;
  role_label: string;
  branch_id: string | null;
  branch_name: string | null;
  avatar_url: string | null;
  monthly_pay: number;
  has_monthly_pay: boolean;
  status: "missing_salary" | "unpaid" | "paid";
  last_paid_label: string;
  current_item_id: string | null;
};

export type PayrollDashboardBranch = {
  id: string;
  name: string;
};

export type PayrollDashboardSummary = {
  nextPayrollDateLabel: string;
  nextPayrollPreviewLabel: string;
  countdownLabel: string;
  totalMonthlyPayroll: number;
  paidStaff: number;
  unpaidStaff: number;
  totalIncludedStaff: number;
  payrollProgress: number;
  reminderMessage: string | null;
};

export type PayrollDashboardData = {
  settings: PayrollSettings;
  payrollMonth: {
    start: string;
    end: string;
  };
  currentPeriodId: string | null;
  summary: PayrollDashboardSummary;
  branches: PayrollDashboardBranch[];
  staffRows: PayrollDashboardStaffRow[];
  history: PayrollPeriodRow[];
};

type PayrollSettingsDbRow = {
  payday_rule: string;
  fixed_day: number;
  weekend_adjustment: string;
  reminder_preset: string;
  custom_reminder_days: number;
  include_inactive_employees: boolean;
  default_payment_status: string;
  allow_status_editing: boolean;
  show_total_payroll: boolean;
  tracking_start_month: number;
  tracking_start_year: number;
  continue_reminders_while_unpaid: boolean;
  enabled_payment_methods: string[] | null;
  show_owner_dashboard_reminder: boolean;
  show_payroll_page_reminder: boolean;
  notify_payroll_due: boolean;
  notify_payroll_fully_paid: boolean;
};

function mapPayrollSettings(row: PayrollSettingsDbRow | null | undefined): PayrollSettings {
  if (!row) return DEFAULT_PAYROLL_SETTINGS;

  return {
    paydayRule: row.payday_rule === "last_day_of_month" ? "last_day_of_month" : "fixed_day",
    fixedDay: Number.isFinite(row.fixed_day) ? row.fixed_day : DEFAULT_PAYROLL_SETTINGS.fixedDay,
    weekendAdjustment:
      row.weekend_adjustment === "none" ? "none" : "prior_business_day",
    reminderPreset: ["none", "1", "2", "3", "5", "7", "custom"].includes(row.reminder_preset)
      ? (row.reminder_preset as ReminderPreset)
      : DEFAULT_PAYROLL_SETTINGS.reminderPreset,
    customReminderDays: row.custom_reminder_days,
    includeInactiveEmployees: row.include_inactive_employees,
    defaultPaymentStatus: "unpaid",
    allowStatusEditing: row.allow_status_editing,
    showTotalPayroll: row.show_total_payroll,
    trackingStartMonth: row.tracking_start_month,
    trackingStartYear: row.tracking_start_year,
    continueRemindersWhileUnpaid: row.continue_reminders_while_unpaid,
    enabledPaymentMethods: normalizePaymentMethods(row.enabled_payment_methods),
    showOwnerDashboardReminder: row.show_owner_dashboard_reminder,
    showPayrollPageReminder: row.show_payroll_page_reminder,
    notifyPayrollDue: row.notify_payroll_due,
    notifyPayrollFullyPaid: row.notify_payroll_fully_paid,
  };
}

export async function getPayrollSettings(): Promise<PayrollSettings> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payroll_settings")
    .select(
      `payday_rule, fixed_day, weekend_adjustment, reminder_preset,
       custom_reminder_days, include_inactive_employees, default_payment_status,
       allow_status_editing, show_total_payroll, tracking_start_month,
       tracking_start_year, continue_reminders_while_unpaid, enabled_payment_methods,
       show_owner_dashboard_reminder, show_payroll_page_reminder,
       notify_payroll_due, notify_payroll_fully_paid`
    )
    .eq("id", "default")
    .maybeSingle();

  if (error) return DEFAULT_PAYROLL_SETTINGS;
  return mapPayrollSettings(data as PayrollSettingsDbRow | null);
}

function roleLabel(row: { staff_type?: string | null; system_role?: string | null }): string {
  const staffType = row.staff_type as keyof typeof STAFF_TYPE_LABELS | null | undefined;
  const systemRole = row.system_role as keyof typeof SYSTEM_ROLE_LABELS | null | undefined;
  if (staffType && STAFF_TYPE_LABELS[staffType]) return STAFF_TYPE_LABELS[staffType];
  if (systemRole && SYSTEM_ROLE_LABELS[systemRole]) return SYSTEM_ROLE_LABELS[systemRole];
  return "Staff";
}

function paymentMethodList(methods: PayrollPaymentMethod[]): string[] {
  return methods.map((method) => method);
}

/** Fetch the fixed-monthly Owner Payroll dashboard. */
export async function getPayrollDashboardData(today = new Date()): Promise<PayrollDashboardData> {
  const supabase = await createClient();
  const settings = await getPayrollSettings();
  const nextPayrollDate = computeNextPayrollDate(settings, today);
  const payrollMonth = getMonthBounds(nextPayrollDate);

  const periodQuery = supabase
    .from("payroll_periods")
    .select("id, paid_at")
    .eq("period_start", payrollMonth.start)
    .eq("period_end", payrollMonth.end)
    .is("branch_id", null)
    .order("created_at", { ascending: false })
    .limit(1);

  let staffQuery = supabase
    .from("staff")
    .select("id, full_name, nickname, system_role, staff_type, branch_id, avatar_url, is_active, branches(name)")
    .neq("system_role", "owner")
    .order("full_name", { ascending: true });

  if (!settings.includeInactiveEmployees) {
    staffQuery = staffQuery.eq("is_active", true);
  }

  const [periodRes, staffRes, profilesRes, branchesRes, history] = await Promise.all([
    periodQuery,
    staffQuery,
    supabase
      .from("staff_pay_profiles")
      .select("id, staff_id, branch_id, base_pay_amount, base_pay_type, effective_from, is_active")
      .eq("is_active", true)
      .order("effective_from", { ascending: false }),
    supabase
      .from("branches")
      .select("id, name")
      .eq("is_active", true)
      .order("name", { ascending: true }),
    getPayrollPeriods(),
  ]);

  const currentPeriod = periodRes.data?.[0] ?? null;
  const staffRowsRaw = staffRes.data ?? [];
  const staffIds = staffRowsRaw.map((staff) => staff.id);

  const itemsRes = currentPeriod && staffIds.length > 0
    ? await supabase
        .from("payroll_items")
        .select("id, staff_id, net_pay, status, updated_at")
        .eq("payroll_period_id", currentPeriod.id)
        .in("staff_id", staffIds)
        .neq("status", "voided")
    : { data: [] as { id: string; staff_id: string; net_pay: number; status: string; updated_at: string }[] };

  const profileMap = new Map<string, { amount: number; type: string; branchId: string | null }>();
  for (const profile of profilesRes.data ?? []) {
    if (!profileMap.has(profile.staff_id)) {
      profileMap.set(profile.staff_id, {
        amount: Number(profile.base_pay_amount ?? 0),
        type: String(profile.base_pay_type ?? "none"),
        branchId: profile.branch_id ?? null,
      });
    }
  }

  const itemMap = new Map<string, { id: string; status: string; updatedAt: string }>();
  for (const item of itemsRes.data ?? []) {
    itemMap.set(item.staff_id, {
      id: item.id,
      status: item.status,
      updatedAt: item.updated_at,
    });
  }

  const staffRows: PayrollDashboardStaffRow[] = staffRowsRaw.map((staff) => {
    const raw = staff as Record<string, unknown>;
    const profile = profileMap.get(staff.id);
    const hasMonthlyPay = profile?.type === "monthly" && profile.amount > 0;
    const item = itemMap.get(staff.id);
    const isPaid = hasMonthlyPay && item?.status === "paid";
    const status = !hasMonthlyPay ? "missing_salary" : isPaid ? "paid" : "unpaid";
    const branch = raw["branches"] as { name?: string | null } | null;

    return {
      id: staff.id,
      display_name: getStaffAdminName({
        full_name: staff.full_name,
        nickname: (staff as { nickname?: string | null }).nickname ?? null,
      }),
      full_name: staff.full_name,
      nickname: (staff as { nickname?: string | null }).nickname ?? null,
      role_label: roleLabel(staff),
      branch_id: staff.branch_id,
      branch_name: branch?.name ?? null,
      avatar_url: (staff as { avatar_url?: string | null }).avatar_url ?? null,
      monthly_pay: hasMonthlyPay ? profile.amount : 0,
      has_monthly_pay: hasMonthlyPay,
      status,
      last_paid_label: isPaid
        ? new Date(item.updatedAt).toLocaleDateString("en-PH", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : "—",
      current_item_id: item?.id ?? null,
    };
  });

  staffRows.sort((a, b) => {
    const priority = { missing_salary: 0, unpaid: 1, paid: 2 } as const;
    const byStatus = priority[a.status] - priority[b.status];
    if (byStatus !== 0) return byStatus;
    return a.display_name.localeCompare(b.display_name);
  });

  const includedRows = staffRows.filter((row) => row.has_monthly_pay);
  const paidStaff = includedRows.filter((row) => row.status === "paid").length;
  const unpaidStaff = includedRows.length - paidStaff;
  const totalMonthlyPayroll = includedRows.reduce((sum, row) => sum + row.monthly_pay, 0);
  const payrollProgress = calculatePayrollProgress(paidStaff, includedRows.length);
  const reminderMessage = getPayrollReminderMessage({
    settings,
    nextPayrollDate,
    unpaidStaff,
    totalIncludedStaff: includedRows.length,
    today,
  });

  return {
    settings: {
      ...settings,
      enabledPaymentMethods: paymentMethodList(settings.enabledPaymentMethods) as PayrollPaymentMethod[],
    },
    payrollMonth,
    currentPeriodId: currentPeriod?.id ?? null,
    summary: {
      nextPayrollDateLabel: formatPayrollDate(nextPayrollDate),
      nextPayrollPreviewLabel: toIsoDate(nextPayrollDate),
      countdownLabel: getCountdownLabel(nextPayrollDate, today),
      totalMonthlyPayroll,
      paidStaff,
      unpaidStaff,
      totalIncludedStaff: includedRows.length,
      payrollProgress,
      reminderMessage,
    },
    branches: branchesRes.data ?? [],
    staffRows,
    history,
  };
}

/** Fetch payroll periods for the owner (all branches). */
export async function getPayrollPeriods(): Promise<PayrollPeriodRow[]> {
  const supabase = await createClient();
  const { data: periods } = await supabase
    .from("payroll_periods")
    .select(
      `id, branch_id, period_start, period_end, status, notes,
       approved_at, paid_at, created_at,
       branches ( name ),
       created_by_staff:staff!payroll_periods_created_by_fkey ( full_name ),
       approved_by_staff:staff!payroll_periods_approved_by_fkey ( full_name )`
    )
    .order("period_start", { ascending: false })
    .limit(50);

  if (!periods) return [];

  const periodIds = periods.map((p) => p.id);

  // Count items + total net_pay per period
  const { data: summaries } = await supabase
    .from("payroll_items")
    .select("payroll_period_id, net_pay")
    .in("payroll_period_id", periodIds)
    .neq("status", "voided");

  type SummaryMap = Record<string, { count: number; total: number }>;
  const summaryMap: SummaryMap = {};
  for (const s of summaries ?? []) {
    const pid = s.payroll_period_id;
    if (!summaryMap[pid]) summaryMap[pid] = { count: 0, total: 0 };
    summaryMap[pid]!.count++;
    summaryMap[pid]!.total += Number(s.net_pay ?? 0);
  }

  return periods.map((p) => {
    const raw = p as Record<string, unknown>;
    const summary = summaryMap[p.id] ?? { count: 0, total: 0 };
    return {
      id: p.id,
      branch_id: p.branch_id,
      branch_name: (raw["branches"] as { name?: string } | null)?.name ?? null,
      period_start: p.period_start,
      period_end: p.period_end,
      status: p.status,
      notes: p.notes,
      created_by_name:
        (raw["created_by_staff"] as { full_name?: string } | null)?.full_name ?? null,
      approved_by_name:
        (raw["approved_by_staff"] as { full_name?: string } | null)?.full_name ?? null,
      approved_at: p.approved_at,
      paid_at: p.paid_at,
      created_at: p.created_at,
      item_count: summary.count,
      total_net_pay: Math.round(summary.total * 100) / 100,
    };
  });
}

/** Fetch full detail for one payroll period — items + adjustments. */
export async function getPayrollPeriodDetails(periodId: string): Promise<{
  period: PayrollPeriodRow | null;
  items: PayrollItemRow[];
}> {
  const supabase = await createClient();

  const [periodRes, itemsRes] = await Promise.all([
    supabase
      .from("payroll_periods")
      .select(
        `id, branch_id, period_start, period_end, status, notes,
         approved_at, paid_at, created_at,
         branches ( name ),
         created_by_staff:staff!payroll_periods_created_by_fkey ( full_name ),
         approved_by_staff:staff!payroll_periods_approved_by_fkey ( full_name )`
      )
      .eq("id", periodId)
      .maybeSingle(),
    supabase
      .from("payroll_items")
      .select(
        `id, staff_id, branch_id, completed_bookings_count, home_service_bookings_count,
         gross_revenue, base_pay, commission_pay, bonus_pay, reimbursement_pay,
         home_service_allowance_pay, deduction_amount, salary_advance_amount, net_pay,
         status, notes,
         staff!payroll_items_staff_id_fkey ( full_name ),
         payroll_adjustments (
           id, adjustment_type, amount, reason, created_at,
           created_by_staff:staff!payroll_adjustments_created_by_fkey ( full_name )
         )`
      )
      .eq("payroll_period_id", periodId)
      .order("net_pay", { ascending: false }),
  ]);

  if (!periodRes.data) return { period: null, items: [] };

  const p = periodRes.data as Record<string, unknown>;
  const summaryForPeriod: PayrollPeriodRow = {
    id: periodRes.data.id,
    branch_id: periodRes.data.branch_id,
    branch_name: (p["branches"] as { name?: string } | null)?.name ?? null,
    period_start: periodRes.data.period_start,
    period_end: periodRes.data.period_end,
    status: periodRes.data.status,
    notes: periodRes.data.notes,
    created_by_name:
      (p["created_by_staff"] as { full_name?: string } | null)?.full_name ?? null,
    approved_by_name:
      (p["approved_by_staff"] as { full_name?: string } | null)?.full_name ?? null,
    approved_at: periodRes.data.approved_at,
    paid_at: periodRes.data.paid_at,
    created_at: periodRes.data.created_at,
    item_count: itemsRes.data?.length ?? 0,
    total_net_pay:
      Math.round(
        (itemsRes.data ?? [])
          .filter((i) => i.status !== "voided")
          .reduce((sum, i) => sum + Number(i.net_pay ?? 0), 0) * 100
      ) / 100,
  };

  const items: PayrollItemRow[] = (itemsRes.data ?? []).map((item) => {
    const raw = item as Record<string, unknown>;
    const adjustments = (
      (raw["payroll_adjustments"] as Array<Record<string, unknown>>) ?? []
    ).map((adj) => ({
      id: adj["id"] as string,
      adjustment_type: adj["adjustment_type"] as string,
      amount: Number(adj["amount"]),
      reason: adj["reason"] as string,
      created_by_name:
        (adj["created_by_staff"] as { full_name?: string } | null)?.full_name ?? null,
      created_at: adj["created_at"] as string,
    }));

    return {
      id: item.id,
      staff_id: item.staff_id,
      staff_name: (raw["staff"] as { full_name?: string } | null)?.full_name ?? "Unknown",
      branch_id: item.branch_id,
      completed_bookings_count: item.completed_bookings_count,
      home_service_bookings_count: item.home_service_bookings_count,
      gross_revenue: Number(item.gross_revenue),
      base_pay: Number(item.base_pay),
      commission_pay: Number(item.commission_pay),
      bonus_pay: Number(item.bonus_pay),
      reimbursement_pay: Number(item.reimbursement_pay),
      home_service_allowance_pay: Number(item.home_service_allowance_pay),
      deduction_amount: Number(item.deduction_amount),
      salary_advance_amount: Number(item.salary_advance_amount),
      net_pay: Number(item.net_pay),
      status: item.status,
      notes: item.notes,
      adjustments,
    };
  });

  return { period: summaryForPeriod, items };
}

/** Fetch active pay profiles for all staff (owner view). */
export async function getStaffPayProfiles(): Promise<StaffPayProfileRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("staff_pay_profiles")
    .select(
      `id, staff_id, branch_id, base_pay_amount, base_pay_type,
       commission_percent, per_service_bonus, home_service_allowance,
       transport_allowance, is_active, effective_from, effective_until,
       staff!staff_pay_profiles_staff_id_fkey ( full_name )`
    )
    .eq("is_active", true)
    .order("effective_from", { ascending: false });

  return (data ?? []).map((row) => {
    const raw = row as Record<string, unknown>;
    return {
      id: row.id,
      staff_id: row.staff_id,
      staff_name: (raw["staff"] as { full_name?: string } | null)?.full_name ?? "Unknown",
      branch_id: row.branch_id,
      base_pay_amount: Number(row.base_pay_amount),
      base_pay_type: row.base_pay_type,
      commission_percent: Number(row.commission_percent),
      per_service_bonus: Number(row.per_service_bonus),
      home_service_allowance: Number(row.home_service_allowance),
      transport_allowance: Number(row.transport_allowance),
      is_active: row.is_active,
      effective_from: row.effective_from,
      effective_until: row.effective_until,
    };
  });
}

/** Fetch all staff for the pay-profile form (owner picks from this list). */
export async function getStaffForPayrollSetup(): Promise<
  { id: string; full_name: string; branch_id: string; staff_type: string }[]
> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("staff")
    .select("id, full_name, branch_id, staff_type")
    .eq("is_active", true)
    .not("system_role", "in", '("owner")')
    .order("full_name");
  return data ?? [];
}
