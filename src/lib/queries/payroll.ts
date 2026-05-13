import { createClient } from "@/lib/supabase/server";

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
