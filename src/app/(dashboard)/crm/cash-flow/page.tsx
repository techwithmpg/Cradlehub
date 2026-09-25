import Link from "next/link";
import { redirect } from "next/navigation";

import { EmptyState, WorkspaceSection } from "@/components/features/attendance/attendance-ui";
import { CrmOperationalPageShell } from "@/components/features/crm/operational/crm-operational-page-shell";
import { getBranchBusinessDate } from "@/lib/engine/slot-time";
import { getDailyPaymentSummary } from "@/lib/queries/bookings";
import {
  getCashFlowDayClose,
  getCashFlowTransactions,
  paymentMethodLabel,
} from "@/lib/queries/cash-flow";
import { getFrontDeskContext } from "@/lib/queries/crm-context";
import { formatTime12h } from "@/lib/utils/time-format";

function peso(value: number): string {
  return `₱${value.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function paymentStatusClass(status: string): string {
  if (status === "paid") {
    return "border-emerald-800/20 bg-emerald-50 text-emerald-900";
  }

  if (status === "pending" || status === "unpaid") {
    return "border-amber-700/25 bg-amber-50 text-amber-900";
  }

  return "border-[var(--cs-border)] bg-[var(--cs-surface-warm)] text-[var(--cs-text-muted)]";
}

export default async function CashFlowPage() {
  const context = await getFrontDeskContext();

  if (!context.branchId) {
    redirect("/login");
  }

  const branchId = context.branchId;
  const branchName = context.branchName;
  const today = getBranchBusinessDate();

  const todayLabel = new Date(`${today}T00:00:00`).toLocaleDateString("en-PH", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const [summary, transactions, dayClose] = await Promise.all([
    getDailyPaymentSummary(branchId, today).catch(() => null),
    getCashFlowTransactions(branchId, today).catch(() => []),
    getCashFlowDayClose(branchId, today).catch(() => null),
  ]);

  const paymentMethods = summary
    ? Object.entries(summary.by_method)
        .filter(([, value]) => Number(value) > 0)
        .sort((a, b) => Number(b[1]) - Number(a[1]))
    : [];

  const dayCloseStatus = dayClose?.status ?? "not_started";

  return (
    <CrmOperationalPageShell
      title="Cash Flow"
      description="Operational view of collections, payment activity, and day-close status."
      context={`${branchName} · ${todayLabel}`}
      tabs={
        <div className="flex flex-wrap gap-2">
          <a
            href="#today"
            className="rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-4 py-2 text-sm font-semibold text-[var(--cs-text)] shadow-sm"
          >
            Today
          </a>

          <a
            href="#transactions"
            className="rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-4 py-2 text-sm font-semibold text-[var(--cs-text-secondary)]"
          >
            Transactions
          </a>

          <Link
            href="/crm/reconciliation"
            className="rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-4 py-2 text-sm font-semibold text-[var(--cs-text-secondary)]"
          >
            Day Close
          </Link>
        </div>
      }
    >
      <div className="grid gap-5">
        <section id="today" className="grid gap-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: "Collected",
                value: summary ? peso(summary.total_collected) : "—",
                detail: "Recorded booking payments",
              },
              {
                label: "Outstanding",
                value: summary ? peso(summary.total_unpaid) : "—",
                detail: "Pending or unpaid balance",
              },
              {
                label: "Paid Bookings",
                value: summary ? String(summary.paid_count) : "—",
                detail: summary ? `${summary.total_count} active bookings` : "Summary unavailable",
              },
              {
                label: "Transactions",
                value: String(transactions.length),
                detail: "Payments with collected value",
              },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] p-4 shadow-sm"
              >
                <div className="text-[0.6875rem] font-bold uppercase tracking-wide text-[var(--cs-text-muted)]">
                  {item.label}
                </div>

                <div className="mt-2 text-2xl font-bold text-[var(--cs-text)]">{item.value}</div>

                <div className="mt-1 text-xs text-[var(--cs-text-muted)]">{item.detail}</div>
              </div>
            ))}
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
            <WorkspaceSection
              title="Payment Methods"
              description="Today's collected booking payments by recorded tender."
            >
              {paymentMethods.length === 0 ? (
                <div className="p-4">
                  <EmptyState
                    title="No collected payments yet"
                    detail="Payment totals will appear here when canonical booking payments are recorded."
                  />
                </div>
              ) : (
                <div className="grid gap-3 p-4 sm:grid-cols-2">
                  {paymentMethods.map(([method, amount]) => (
                    <div
                      key={method}
                      className="flex items-center justify-between gap-4 rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface-warm)] p-3"
                    >
                      <div className="text-sm font-semibold text-[var(--cs-text)]">
                        {paymentMethodLabel(method)}
                      </div>

                      <div className="text-base font-bold tabular-nums text-[var(--cs-text)]">
                        {peso(Number(amount))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </WorkspaceSection>

            <WorkspaceSection
              title="Day Close"
              description="Existing end-of-day reconciliation remains authoritative."
            >
              <div className="grid gap-4 p-4">
                <div>
                  <div className="text-[0.6875rem] font-bold uppercase tracking-wide text-[var(--cs-text-muted)]">
                    Status
                  </div>

                  <div className="mt-1 text-lg font-bold capitalize text-[var(--cs-text)]">
                    {dayCloseStatus.replaceAll("_", " ")}
                  </div>
                </div>

                {dayClose ? (
                  <div className="grid gap-2 text-sm">
                    <div className="flex justify-between gap-3">
                      <span className="text-[var(--cs-text-muted)]">Expected</span>
                      <span className="font-semibold tabular-nums text-[var(--cs-text)]">
                        {peso(dayClose.expected)}
                      </span>
                    </div>

                    <div className="flex justify-between gap-3">
                      <span className="text-[var(--cs-text-muted)]">Actual</span>
                      <span className="font-semibold tabular-nums text-[var(--cs-text)]">
                        {peso(dayClose.actual)}
                      </span>
                    </div>

                    <div className="flex justify-between gap-3 border-t border-[var(--cs-border)] pt-2">
                      <span className="text-[var(--cs-text-muted)]">Variance</span>
                      <span
                        className="font-bold tabular-nums"
                        style={{
                          color: dayClose.variance === 0 ? "var(--cs-success)" : "var(--cs-error)",
                        }}
                      >
                        {dayClose.variance > 0 ? "+" : ""}
                        {peso(dayClose.variance)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-[var(--cs-text-muted)]">
                    No reconciliation has been started for this business day.
                  </p>
                )}

                <Link
                  href="/crm/reconciliation"
                  className="inline-flex min-h-10 items-center justify-center rounded-lg bg-[var(--cs-brand)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
                >
                  Open Day Close
                </Link>
              </div>
            </WorkspaceSection>
          </div>
        </section>

        <section id="transactions">
          <WorkspaceSection
            title="Transactions"
            description="Booking payments recorded in CradleHub for the current business day."
          >
            {transactions.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  title="No payment transactions"
                  detail="Collected booking payments for today will appear here."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead>
                    <tr className="border-b border-[var(--cs-border)] text-left text-[0.6875rem] font-bold uppercase tracking-wide text-[var(--cs-text-muted)]">
                      <th className="px-4 py-3">Time</th>
                      <th className="px-4 py-3">Customer</th>
                      <th className="px-4 py-3">Service</th>
                      <th className="px-4 py-3">Source</th>
                      <th className="px-4 py-3">Method</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                    </tr>
                  </thead>

                  <tbody>
                    {transactions.map((transaction) => (
                      <tr
                        key={transaction.id}
                        className="border-b border-[var(--cs-border)] last:border-b-0"
                      >
                        <td className="whitespace-nowrap px-4 py-3 font-medium text-[var(--cs-text)]">
                          {formatTime12h(transaction.startTime)}
                        </td>

                        <td className="px-4 py-3">
                          <div className="font-semibold text-[var(--cs-text)]">
                            {transaction.customerName}
                          </div>

                          {transaction.paymentReference ? (
                            <div className="mt-0.5 text-xs text-[var(--cs-text-muted)]">
                              Ref: {transaction.paymentReference}
                            </div>
                          ) : null}
                        </td>

                        <td className="px-4 py-3 text-[var(--cs-text-secondary)]">
                          {transaction.serviceName}
                        </td>

                        <td className="px-4 py-3 text-[var(--cs-text-secondary)]">
                          {transaction.bookingSource}
                        </td>

                        <td className="px-4 py-3 font-medium text-[var(--cs-text)]">
                          {paymentMethodLabel(transaction.paymentMethod)}
                        </td>

                        <td className="px-4 py-3">
                          <span
                            className={`rounded border px-2 py-1 text-xs font-semibold capitalize ${paymentStatusClass(
                              transaction.paymentStatus
                            )}`}
                          >
                            {transaction.paymentStatus.replaceAll("_", " ")}
                          </span>
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-right text-base font-bold tabular-nums text-emerald-800">
                          +{peso(transaction.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </WorkspaceSection>
        </section>

        <div className="rounded-lg border border-dashed border-[var(--cs-border)] bg-[var(--cs-surface-warm)] p-4">
          <div className="text-sm font-semibold text-[var(--cs-text)]">Cash Flow Pass 1</div>

          <p className="mt-1 max-w-4xl text-sm text-[var(--cs-text-muted)]">
            This view currently reads canonical CradleHub booking payments and the existing Day
            Close record. Expenses, cash-outs, advances, split tenders, fuel, miscellaneous sales,
            vouchers, adjustments, and Master Sheet financial rows are intentionally not written
            yet.
          </p>
        </div>
      </div>
    </CrmOperationalPageShell>
  );
}
