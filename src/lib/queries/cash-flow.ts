import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getFrontDeskContext } from "@/lib/queries/crm-context";
import { addDaysToYmd, getBranchBusinessDate } from "@/lib/engine/slot-time";
import {
  buildCashFlowDay,
  validateCashFlowRange,
  type CashFlowBookingRow,
  type CashFlowRange,
  type CashFlowWorkspaceData,
} from "@/lib/cash-flow/read-model";

/** Authenticate at the boundary; callers cannot supply a branch or a privileged client. */
export async function getCashFlowWorkspace(range?: CashFlowRange): Promise<CashFlowWorkspaceData> {
  const context = await getFrontDeskContext();
  if (!context.branchId) throw new Error("A CRM branch is required.");
  const today = getBranchBusinessDate();
  const selected = validateCashFlowRange(range ?? { from: addDaysToYmd(today, -13), to: today });
  const client = await createClient();
  async function all<T>(
    query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>
  ): Promise<T[]> {
    const rows: T[] = [];
    for (let from = 0; ; from += 500) {
      const result = await query(from, from + 499);
      if (result.error || result.data === null)
        throw new Error("Cash Flow data could not be loaded. Try again.");
      rows.push(...result.data);
      if (result.data.length < 500) return rows;
    }
  }
  async function readWindow(window: CashFlowRange) {
    const [bookings, closes] = await Promise.all([
      all((a, b) =>
        client
          .from("bookings")
          .select(
            "id, branch_id, booking_date, start_time, type, delivery_type, status, metadata, payment_method, payment_status, payment_reference, amount_paid, customers(full_name), services(name)"
          )
          .eq("branch_id", context.branchId)
          .gte("booking_date", window.from)
          .lte("booking_date", window.to)
          .order("id")
          .range(a, b)
      ),
      all((a, b) =>
        client
          .from("daily_cash_reconciliations")
          .select("*")
          .eq("branch_id", context.branchId)
          .gte("reconciliation_date", window.from)
          .lte("reconciliation_date", window.to)
          .order("id")
          .range(a, b)
      ),
    ]);
    return { bookings: bookings as CashFlowBookingRow[], closes };
  }
  const includesToday = selected.from <= today && selected.to >= today;
  const [window, separateToday] = await Promise.all([
    readWindow(selected),
    includesToday ? Promise.resolve(null) : readWindow({ from: today, to: today }),
  ]);
  const days = [];
  for (let date = selected.to; date >= selected.from; date = addDaysToYmd(date, -1))
    days.push(
      buildCashFlowDay(
        date,
        window.bookings,
        window.closes.find((r) => r.reconciliation_date === date) ?? null
      )
    );
  const todaySource = separateToday ?? window;
  return {
    branchId: context.branchId,
    branchName: context.branchName,
    range: selected,
    days,
    today:
      days.find((day) => day.date === today) ??
      buildCashFlowDay(
        today,
        todaySource.bookings,
        todaySource.closes.find((r) => r.reconciliation_date === today) ?? null
      ),
    loadedAt: new Date().toISOString(),
  };
}
