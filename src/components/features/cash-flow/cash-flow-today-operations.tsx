"use client";

import { useMemo, useState } from "react";
import { Banknote, CheckCircle2, CreditCard, ReceiptText, Search } from "lucide-react";
import type { CashFlowWorkspaceData } from "@/lib/cash-flow/cash-flow-types";
import {
  isCompletedAndPayable,
  isQuickPaymentEligible,
  getBookingPaymentOperationalStatus,
} from "./cash-flow-today-eligibility";
import {
  isPaymentMethodCompatibleWithAccount,
  type FinancialPaymentMethod,
} from "@/lib/cash-flow/financial-contract";

type Props = {
  data: CashFlowWorkspaceData;
  onRecordPaymentClick: (orderId?: string, method?: FinancialPaymentMethod) => void;
  onNavigateToLedger: () => void;
};

const methods: ReadonlyArray<{ value: FinancialPaymentMethod; label: string }> = [
  { value: "cash", label: "Cash" },
  { value: "gcash", label: "GCash" },
  { value: "maya", label: "Maya" },
  { value: "card", label: "Card" },
  { value: "bank_transfer", label: "Bank Transfer" },
];

function peso(amount: number): string {
  return `₱${amount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function Kpi({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "green" | "neutral";
}) {
  return (
    <div
      className={`min-w-0 rounded-xl border p-4 shadow-sm ${
        tone === "green"
          ? "border-emerald-900 bg-[#163E32] text-white"
          : "border-[#EAE4DC] bg-white text-[#1E1916]"
      }`}
    >
      <p
        className={`text-xs font-semibold ${tone === "green" ? "text-emerald-100" : "text-[#6B5D52]"}`}
      >
        {label}
      </p>
      <p className="mt-2 truncate text-xl font-bold tabular-nums sm:text-2xl">{value}</p>
      <p
        className={`mt-1 truncate text-[11px] ${tone === "green" ? "text-emerald-100" : "text-[#7B6D61]"}`}
      >
        {hint}
      </p>
    </div>
  );
}

export function CashFlowTodayOperations({
  data,
  onRecordPaymentClick,
  onNavigateToLedger,
}: Props) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<FinancialPaymentMethod>("cash");
  const [activityTab, setActivityTab] = useState<"transactions" | "expenses">("transactions");

  // Strict completed-only KPI constraint:
  // "Completed — awaiting collection" counts completed unpaid orders only.
  const completedOrders = useMemo(
    () => data.payableOrders.filter(isCompletedAndPayable),
    [data.payableOrders]
  );
  const completedPendingAmount = completedOrders.reduce(
    (sum, order) => sum + order.remainingBalance,
    0
  );

  // Authoritative parity with Record Payment modal:
  // Displays all eligible orders with outstanding balances (completed, in-progress, partially paid).
  const outstandingOrders = useMemo(
    () => data.payableOrders.filter(isQuickPaymentEligible),
    [data.payableOrders]
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return outstandingOrders;
    return outstandingOrders.filter((order) =>
      [
        order.customerName,
        order.customerPhone ?? "",
        order.orderNumber,
        order.serviceDescription,
        order.serviceTime ?? "",
      ].some((v) => v.toLowerCase().includes(q))
    );
  }, [outstandingOrders, search]);

  const selectedOrder =
    visible.find((order) => order.id === selectedId) ??
    (selectedId ? null : visible[0] ?? null);

  const expenseCoverage = data.today.coverage.find((item) => item.id === "expenses");
  const expensesAvailable = expenseCoverage?.isAvailable === true;
  const expenseTotal = expensesAvailable ? expenseCoverage.amount : null;
  const recentExpenses = data.ledger.records
    .filter((item) => (item.outflow ?? 0) > 0 && /expense/i.test(item.category))
    .slice(0, 5);

  const methodAllowed = (method: FinancialPaymentMethod) => {
    const compatible = data.accounts.some((account) =>
      isPaymentMethodCompatibleWithAccount(method, account.accountType)
    );
    return compatible && (method !== "cash" || Boolean(data.cashSessions?.activeSessions?.length));
  };

  const canPay = Boolean(selectedOrder && methodAllowed(paymentMethod));

  return (
    <section className="space-y-4" aria-label="Cash Flow Today">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Completed — awaiting collection"
          value={peso(completedPendingAmount)}
          hint={`${completedOrders.length} completed order${completedOrders.length === 1 ? "" : "s"} unpaid`}
          tone="green"
        />
        <Kpi
          label="Collected today"
          value={peso(data.today.totalInflow)}
          hint="Recorded receipts across financial accounts"
        />
        <Kpi
          label="Expenses today"
          value={expenseTotal === null ? "Unavailable" : peso(expenseTotal)}
          hint={expensesAvailable ? "Operational expenses" : "Financial coverage not available"}
        />
        <Kpi
          label="Net operational flow"
          value={
            expenseTotal === null
              ? "Unavailable"
              : peso(data.today.totalInflow - expenseTotal)
          }
          hint="Recorded receipts minus available expenses"
        />
      </div>

      <div className="grid min-w-0 grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(350px,390px)]">
        <div className="min-w-0 overflow-hidden rounded-xl border border-[#EAE4DC] bg-white shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#F0ECE5] px-4 py-4 sm:px-5">
            <div>
              <h2 className="text-base font-bold text-[#1E1916]">
                Bookings with outstanding payments
              </h2>
              <p className="mt-1 text-xs text-[#7B6D61]">
                Select a booking with an outstanding balance, then choose a payment method.
              </p>
            </div>
            <span className="rounded-full bg-[#EAF6EE] px-3 py-1 text-xs font-bold text-[#163E32]">
              {outstandingOrders.length} outstanding
            </span>
          </div>

          <div className="border-b border-[#F0ECE5] p-3 sm:px-5">
            <label className="flex items-center gap-2 rounded-lg border border-[#EAE4DC] bg-[#FAF8F5] px-3 py-2 text-xs focus-within:border-emerald-600">
              <Search aria-hidden="true" className="h-4 w-4 text-[#9C8878]" />
              <span className="sr-only">Search bookings with outstanding payments</span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-[#9C8878]"
                placeholder="Search customer, phone, order or service"
              />
            </label>
          </div>

          <div className="max-h-[720px] overflow-auto">
            <table className="w-full min-w-[690px] border-collapse text-left text-xs">
              <thead className="sticky top-0 z-10 bg-[#FAF8F5] text-[10px] uppercase tracking-wide text-[#9C8878]">
                <tr>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-3 py-3">Service</th>
                  <th className="px-3 py-3">Order / service time</th>
                  <th className="px-3 py-3 text-right">Due</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0ECE5]">
                {visible.map((order) => {
                  const opStatus = getBookingPaymentOperationalStatus(order);
                  return (
                    <tr
                      key={order.id}
                      className={`transition hover:bg-[#F7FBF8] ${selectedOrder?.id === order.id ? "bg-[#F1F9F4]" : ""}`}
                    >
                      <td className="px-4 py-3">
                        <div className="font-semibold text-[#1E1916]">{order.customerName}</div>
                        <div className="mt-0.5 text-[10px] text-[#9C8878]">
                          {order.customerPhone ?? "No phone"}
                        </div>
                      </td>
                      <td className="max-w-[250px] px-3 py-3">
                        <div
                          className="truncate font-medium text-[#1E1916]"
                          title={order.serviceDescription}
                        >
                          {order.serviceDescription}
                        </div>
                        <div className="mt-0.5 text-[10px] text-[#9C8878]">
                          {order.visitType === "home_service" ? "Home service" : "In-spa"}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-[#493F37]">{order.orderNumber}</span>
                          <span
                            className={`inline-block rounded-full border px-2 py-0.5 text-[9px] font-semibold leading-none ${
                              opStatus.status === "ready_to_pay"
                                ? "border-[#C3E6D0] bg-[#EAF6EE] text-[#163E32]"
                                : opStatus.status === "partially_paid"
                                  ? "border-[#C7D2FE] bg-[#E0E7FF] text-[#3730A3]"
                                  : "border-[#FDE68A] bg-[#FEF3C7] text-[#92400E]"
                            }`}
                          >
                            {opStatus.label}
                          </span>
                        </div>
                        <div className="mt-0.5 text-[10px] text-[#9C8878]">
                          {order.serviceTime ?? order.bookingDate}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right font-bold tabular-nums text-[#163E32]">
                        {peso(order.remainingBalance)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedId(order.id)}
                          aria-label={`Select payment for ${order.customerName}`}
                          className="rounded-lg bg-[#163E32] px-3 py-2 font-semibold text-white hover:bg-[#1B4D3E]"
                        >
                          {selectedOrder?.id === order.id ? "Selected" : "Pay"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {visible.length === 0 ? (
              <div className="px-6 py-14 text-center">
                <CheckCircle2 className="mx-auto h-7 w-7 text-emerald-600" />
                <p className="mt-3 text-sm font-semibold text-[#163E32]">
                  {search
                    ? "No matching bookings with outstanding payments"
                    : "No bookings with outstanding payments"}
                </p>
                <p className="mt-1 text-xs text-[#7B6D61]">
                  All eligible bookings for this business date have been collected.
                </p>
              </div>
            ) : null}
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-[#F0ECE5] px-4 py-3 text-xs text-[#6B5D52]">
            <span>
              {visible.length} of {outstandingOrders.length} bookings with outstanding payments
              {completedOrders.length > 0 ? ` (${completedOrders.length} completed)` : ""}
            </span>
            <button
              type="button"
              onClick={onNavigateToLedger}
              className="font-semibold text-[#163E32] hover:underline"
            >
              View ledger
            </button>
          </div>
        </div>

        <aside className="min-w-0 space-y-3" aria-label="Payment and financial activity">
          <div className="rounded-xl border border-[#EAE4DC] bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Banknote aria-hidden="true" className="h-5 w-5 text-emerald-700" />
              <h2 className="text-base font-bold text-[#1E1916]">Quick Payment</h2>
            </div>
            {selectedOrder ? (
              <>
                <div className="rounded-lg border border-[#EAE4DC] bg-[#FAF8F5] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#1E1916]">
                        {selectedOrder.customerName}
                      </p>
                      <p className="mt-1 truncate text-[11px] text-[#6B5D52]">
                        {selectedOrder.serviceDescription}
                      </p>
                      <p className="mt-1 text-[10px] text-[#9C8878]">
                        Order {selectedOrder.orderNumber}
                      </p>
                    </div>
                    <strong className="whitespace-nowrap text-sm tabular-nums text-[#163E32]">
                      {peso(selectedOrder.remainingBalance)}
                    </strong>
                  </div>
                </div>
                <p className="mb-2 mt-4 text-xs font-bold text-[#1E1916]">Payment method</p>
                <div className="grid grid-cols-3 gap-2">
                  {methods.map((method) => {
                    const allowed = methodAllowed(method.value);
                    return (
                      <button
                        key={method.value}
                        type="button"
                        disabled={!allowed}
                        onClick={() => setPaymentMethod(method.value)}
                        aria-pressed={paymentMethod === method.value}
                        className={`min-h-14 rounded-lg border px-1 py-2 text-[11px] font-medium transition
                          ${
                            paymentMethod === method.value
                              ? "border-emerald-600 bg-emerald-50 text-[#163E32]"
                              : "border-[#EAE4DC] bg-white text-[#493F37] hover:bg-[#FAF8F5]"
                          }
                          disabled:cursor-not-allowed disabled:opacity-40`}
                      >
                        {method.label}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-3 text-[11px] leading-4 text-[#6B5D52]">
                  Review the amount and any required account reference before confirming.
                </p>
                <button
                  type="button"
                  disabled={!canPay}
                  onClick={() => onRecordPaymentClick(selectedOrder.id, paymentMethod)}
                  className="mt-4 w-full rounded-lg bg-[#163E32] px-4 py-3 text-sm font-semibold text-white hover:bg-[#1B4D3E] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Review &amp; Confirm Payment
                </button>
              </>
            ) : (
              <p className="rounded-lg bg-[#FAF8F5] p-4 text-xs text-[#6B5D52]">
                Select a booking from the left to collect payment.
              </p>
            )}
          </div>

          <div className="overflow-hidden rounded-xl border border-[#EAE4DC] bg-white shadow-sm">
            <div className="grid grid-cols-2 border-b border-[#EAE4DC]">
              <button
                type="button"
                onClick={() => setActivityTab("transactions")}
                aria-pressed={activityTab === "transactions"}
                className={`px-2 py-3 text-xs font-semibold ${
                  activityTab === "transactions"
                    ? "border-b-2 border-emerald-700 text-[#163E32]"
                    : "text-[#6B5D52]"
                }`}
              >
                Recent Transactions
              </button>
              <button
                type="button"
                onClick={() => setActivityTab("expenses")}
                aria-pressed={activityTab === "expenses"}
                className={`px-2 py-3 text-xs font-semibold ${
                  activityTab === "expenses"
                    ? "border-b-2 border-emerald-700 text-[#163E32]"
                    : "text-[#6B5D52]"
                }`}
              >
                Today&apos;s Expenses
              </button>
            </div>

            <div className="max-h-[300px] overflow-auto p-4 text-xs">
              {activityTab === "transactions" ? (
                data.today.recentPayments.length > 0 ? (
                  <ul className="space-y-3">
                    {data.today.recentPayments.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-center justify-between border-b border-[#F0ECE5] pb-2 last:border-0"
                      >
                        <div>
                          <p className="font-semibold text-[#1E1916]">{item.customerName}</p>
                          <p className="text-[10px] text-[#9C8878]">
                            {item.serviceDescription} · {item.paymentMethodDisplay}
                          </p>
                        </div>
                        <span className="font-bold tabular-nums text-[#163E32]">
                          +{peso(item.amount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="py-4 text-center text-[#7B6D61]">No transactions recorded yet today.</p>
                )
              ) : recentExpenses.length > 0 ? (
                <ul className="space-y-3">
                  {recentExpenses.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between border-b border-[#F0ECE5] pb-2 last:border-0"
                    >
                      <div>
                        <p className="font-semibold text-[#1E1916]">{item.category}</p>
                        <p className="text-[10px] text-[#9C8878]">{item.dateTime}</p>
                      </div>
                      <span className="font-bold tabular-nums text-red-700">
                        -{peso(item.outflow ?? 0)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="py-4 text-center text-[#7B6D61]">No expenses recorded today.</p>
              )}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
