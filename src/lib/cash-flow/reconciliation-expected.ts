import "server-only";

import { createClient } from "@/lib/supabase/server";

export type ReconciliationExpected = {
  cash: number;
  gcash: number;
  maya: number;
  card: number;
  other: number;
};

// Use the same posted movement authority and business date as Cash Flow.
// A booking's visit date or payment snapshot cannot establish drawer totals.
// Physical expected cash = opening float of drawer session(s) + posted cash movements.
export async function getPostedReconciliationExpected(
  branchId: string,
  businessDate: string,
  client?: Awaited<ReturnType<typeof createClient>>,
): Promise<ReconciliationExpected> {
  const supabase = client ?? await createClient();
  const expected: ReconciliationExpected = { cash: 0, gcash: 0, maya: 0, card: 0, other: 0 };

  // 1. Physical cash drawer opening floats for this branch and business date
  const { data: sessionRows, error: sessionErr } = await (supabase as unknown as {
    from: (table: string) => {
      select: (cols: string) => {
        eq: (col: string, val: unknown) => {
          eq: (col2: string, val2: unknown) => Promise<{
            data: Array<{ opening_float: number | string }> | null;
            error: unknown;
          }>;
        };
      };
    };
  })
    .from("cash_sessions")
    .select("opening_float")
    .eq("branch_id", branchId)
    .eq("business_date", businessDate);

  if (sessionErr) {
    throw new Error("Could not load cash sessions for reconciliation.");
  }

  for (const session of sessionRows ?? []) {
    const floatAmount = Number(session.opening_float);
    if (!Number.isFinite(floatAmount) || floatAmount < 0) {
      throw new Error("Invalid opening float amount for reconciliation.");
    }
    expected.cash += floatAmount;
  }

  const pageSize = 1000;

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("financial_transactions")
      .select("id, financial_account_movements(amount, payment_method)")
      .eq("branch_id", branchId)
      .eq("business_date", businessDate)
      .eq("status", "posted")
      .order("id")
      .range(offset, offset + pageSize - 1);

    if (error || !data) {
      throw new Error("Could not load posted financial movements for reconciliation.");
    }

    for (const transaction of data) {
      for (const movement of transaction.financial_account_movements ?? []) {
        const amount = Number(movement.amount);
        if (!Number.isFinite(amount)) {
          throw new Error("Invalid posted financial movement amount for reconciliation.");
        }
        const method = movement.payment_method;
        const channel = method === "cash" || method === "gcash" || method === "maya" || method === "card"
          ? method : "other";
        expected[channel] += amount;
      }
    }

    if (data.length < pageSize) break;
  }

  return expected;
}
