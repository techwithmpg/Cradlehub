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
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <CashFlowMetric
          label="Collected"
          value={peso(day.summary.total_collected)}
          detail="Recorded for today's bookings"
        />
        <CashFlowMetric
          label="Outstanding"
          value={peso(day.summary.total_unpaid)}
          detail={`${day.summary.unpaid_count} unpaid or pending bookings`}
        />
        <CashFlowMetric label="Expenses" value="—" detail="Not tracked yet" />
        <CashFlowMetric label="Net Flow" value="—" detail="Available when expenses are tracked" />
      </div>
      <CashFlowPanel
        title="Payment mix"
        description="Recorded amounts from today's active and completed bookings."
      >
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {Object.entries(day.summary.by_method).map(([method, amount]) => (
            <div key={method}>
              <p className="text-sm text-[var(--cs-text-muted)]">
                {PAYMENT_METHOD_LABELS[method as keyof typeof PAYMENT_METHOD_LABELS] ?? method}
              </p>
              <p className="mt-1 font-semibold tabular-nums text-[var(--cs-text)]">
                {peso(amount)}
              </p>
            </div>
          ))}
        </div>
      </CashFlowPanel>
      <CashFlowPanel title="Needs attention">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ul className="space-y-1 text-sm text-[var(--cs-text-secondary)]">
            {day.summary.unpaid_count > 0 && (
              <li>{day.summary.unpaid_count} bookings have unpaid or pending payments.</li>
            )}
            {!day.reconciliation && <li>Day Close has not been started.</li>}
            {day.reconciliation?.status === "draft" && <li>Day Close is saved as a draft.</li>}
            {day.reconciliation?.status === "submitted" && <li>Day Close is awaiting approval.</li>}
            {day.variance !== null && day.variance !== 0 && (
              <li>Recorded reconciliation variance: {peso(day.variance)}.</li>
            )}
            {day.reconciliation?.status === "approved" &&
              day.variance === 0 &&
              day.summary.unpaid_count === 0 && <li>No payment or Day Close attention items.</li>}
          </ul>
          <Button variant="outline" onClick={onDayClose}>
            Review Day Close
          </Button>
        </div>
      </CashFlowPanel>
      <CashFlowPanel
        title="Recent booking payments"
        description="Ordered by appointment time; these are current payment balances."
      >
        <CashFlowEntries
          entries={day.entries.filter((r) => r.amount > 0).slice(0, 8)}
          onSelect={onSelect}
        />
      </CashFlowPanel>
    </div>
  );
}
