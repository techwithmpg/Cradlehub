import { Button } from "@/components/ui/button";
import { PAYMENT_METHOD_LABELS } from "@/lib/validations/booking";
import type { CashFlowDay, CashFlowEntry } from "@/lib/cash-flow/read-model";
import { CashFlowEntries } from "./cash-flow-ledger";
import { CashFlowMetric, CashFlowPanel, peso } from "./cash-flow-ui";

export function CashFlowToday({
  day,
  onSelect,
  onDayClose,
}: {
  day: CashFlowDay;
  onSelect: (row: CashFlowEntry) => void;
  onDayClose: () => void;
}) {
  const paymentMethods = Object.entries(day.summary.by_method).filter(
    ([, amount]) => amount > 0
  );

  const attentionItems: string[] = [];

  if (day.summary.unpaid_count > 0) {
    attentionItems.push(
      `${day.summary.unpaid_count} bookings have unpaid or pending payments.`
    );
  }

  if (!day.reconciliation) {
    attentionItems.push("Day Close has not been started.");
  }

  if (day.reconciliation?.status === "draft") {
    attentionItems.push("Day Close is saved as a draft.");
  }

  if (day.reconciliation?.status === "submitted") {
    attentionItems.push("Day Close is awaiting approval.");
  }

  if (day.variance !== null && day.variance !== 0) {
    attentionItems.push(`Recorded reconciliation variance: ${peso(day.variance)}.`);
  }

  return (
    <div className="space-y-5">
      <section
        aria-label="Today Cash Flow summary"
        className="grid grid-cols-2 gap-3 xl:grid-cols-4"
      >
        <CashFlowMetric
          label="Recorded Payments"
          value={peso(day.summary.total_collected)}
          detail="Current paid balances on today's bookings"
          tone="success"
        />

        <CashFlowMetric
          label="Outstanding"
          value={peso(day.summary.total_unpaid)}
          detail={`${day.summary.unpaid_count} unpaid or pending bookings`}
          tone={day.summary.total_unpaid > 0 ? "warning" : "neutral"}
        />

        <CashFlowMetric
          label="Paid Bookings"
          value={day.summary.paid_count.toLocaleString("en-PH")}
          detail={`${day.summary.total_count} active or completed bookings`}
          tone="info"
        />

        <CashFlowMetric
          label="Needs Payment"
          value={day.summary.unpaid_count.toLocaleString("en-PH")}
          detail="Bookings requiring payment follow-up"
          tone={day.summary.unpaid_count > 0 ? "warning" : "neutral"}
        />
      </section>

      <CashFlowPanel
        title="Payment mix"
        description="Current booking payment balances by method — not receipt-time cash movements."
      >
        {paymentMethods.length ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {paymentMethods.map(([method, amount]) => (
              <div
                key={method}
                className="rounded-xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)] p-3"
              >
                <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--cs-text-muted)]">
                  {PAYMENT_METHOD_LABELS[
                    method as keyof typeof PAYMENT_METHOD_LABELS
                  ] ?? method}
                </p>

                <p className="mt-2 font-bold tabular-nums text-[var(--cs-text)]">
                  {peso(amount)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-[var(--cs-border)] bg-[var(--cs-surface-warm)] px-4 py-6 text-center">
            <p className="text-sm font-semibold text-[var(--cs-text-secondary)]">
              No recorded payments yet
            </p>
            <p className="mt-1 text-xs text-[var(--cs-text-muted)]">
              Payment methods will appear here as booking balances are recorded.
            </p>
          </div>
        )}
      </CashFlowPanel>

      <CashFlowPanel title="Needs attention">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {attentionItems.length ? (
            <div className="min-w-0 flex-1 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-bold text-amber-950">
                {attentionItems.length} item{attentionItems.length === 1 ? "" : "s"} to review
              </p>

              <ul className="mt-2 space-y-1 text-sm leading-5 text-amber-900">
                {attentionItems.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="min-w-0 flex-1 rounded-xl border border-[var(--cs-success)]/20 bg-[var(--cs-success-bg)] p-4">
              <p className="text-sm font-bold text-[var(--cs-success-text)]">
                Cash Flow is clear
              </p>
              <p className="mt-1 text-xs text-[var(--cs-success-text)]">
                No payment or Day Close attention items are currently recorded.
              </p>
            </div>
          )}

          <Button
            variant="outline"
            className="h-10 shrink-0"
            onClick={onDayClose}
          >
            Review Day Close
          </Button>
        </div>
      </CashFlowPanel>

      <CashFlowPanel
        title="Recent payment activity"
        description="Current booking payment state ordered by booking time."
      >
        <CashFlowEntries
          entries={day.entries.filter((row) => row.amount > 0).slice(0, 8)}
          onSelect={onSelect}
        />
      </CashFlowPanel>
    </div>
  );
}