import {
  buildCashFlowDay,
  type CashFlowBookingRow,
  type CashFlowReconciliation,
  type CashFlowWorkspaceData,
} from "@/lib/cash-flow/read-model";
export const DATE = "2026-09-26";
export function booking(overrides: Partial<CashFlowBookingRow> = {}): CashFlowBookingRow {
  return {
    id: "booking-a",
    branch_id: "branch-a",
    booking_date: DATE,
    start_time: "10:00:00",
    type: "online",
    delivery_type: "in_branch",
    status: "confirmed",
    metadata: { price_paid: 1000 },
    payment_method: "cash",
    payment_status: "paid",
    amount_paid: 1000,
    payment_reference: "TEST-001",
    customers: { full_name: "Test Guest" },
    services: { name: "Test Service" },
    ...overrides,
  };
}
export function reconciliation(
  overrides: Partial<CashFlowReconciliation> = {}
): CashFlowReconciliation {
  return {
    id: "close-a",
    branch_id: "branch-a",
    reconciliation_date: DATE,
    status: "draft",
    actual_cash: 990,
    actual_gcash: 0,
    actual_maya: 0,
    actual_card: 0,
    actual_other: 0,
    expected_cash: 1000,
    expected_gcash: 0,
    expected_maya: 0,
    expected_card: 0,
    expected_other: 0,
    notes: "TEST count",
    recorded_by: null,
    created_at: "2026-09-26T04:00:00Z",
    updated_at: "2026-09-26T04:00:00Z",
    ...overrides,
  };
}
export function workspace(): CashFlowWorkspaceData {
  const today = buildCashFlowDay(
    DATE,
    [
      booking(),
      booking({
        id: "booking-b",
        customers: { full_name: "Test Home Guest" },
        payment_status: "pending",
        amount_paid: 300,
        payment_method: "gcash",
        delivery_type: "home_service",
      }),
    ],
    reconciliation()
  );
  return {
    branchId: "branch-a",
    branchName: "TEST Branch",
    today,
    range: { from: "2026-09-25", to: DATE },
    days: [
      today,
      buildCashFlowDay(
        "2026-09-25",
        [booking({ id: "old", booking_date: "2026-09-25", amount_paid: 500 })],
        reconciliation({ reconciliation_date: "2026-09-25", status: "approved" })
      ),
    ],
    loadedAt: "2026-09-26T04:00:00Z",
  };
}
