import type { CashFlowDay } from "@/lib/cash-flow/read-model";
import { PAYMENT_METHOD_LABELS } from "@/lib/validations/booking";
import { CashFlowPanel, CashFlowStatus, peso } from "./cash-flow-ui";

export function CashFlowHistory({
  days,
  onSelect,
}: {
  days: CashFlowDay[];
  onSelect: (date: string) => void;
}) {
  return (
    <CashFlowPanel
      title="Daily history"
      description="Current booking balances grouped by booking date, alongside saved Day Close records."
    >
      <ul className="divide-y divide-[var(--cs-border)]">
        {days.map((day) => (
          <li key={day.date}>
            <button
              type="button"
              onClick={() => onSelect(day.date)}
              className="grid w-full gap-3 rounded-lg px-2 py-4 text-left hover:bg-[var(--cs-surface-warm)] focus-visible:outline-2 focus-visible:outline-[var(--cs-brand)] sm:grid-cols-2 lg:grid-cols-4"
              aria-label={`View day ${day.date}`}
            >
              <div>
                <p className="mb-2 font-semibold">{day.date}</p>
                <CashFlowStatus>{day.reconciliation?.status ?? "Open"}</CashFlowStatus>
              </div>
              <div>
                <p>
                  Collected{" "}
                  <strong className="tabular-nums">{peso(day.summary.total_collected)}</strong>
                </p>
                <p className="text-[var(--cs-text-muted)]">
                  Outstanding {peso(day.summary.total_unpaid)}
                </p>
              </div>
              <p className="text-sm text-[var(--cs-text-secondary)]">
                {Object.entries(day.summary.by_method)
                  .filter(([, amount]) => amount > 0)
                  .map(
                    ([method, amount]) =>
                      `${PAYMENT_METHOD_LABELS[method as keyof typeof PAYMENT_METHOD_LABELS] ?? method} ${peso(amount)}`
                  )
                  .join(" · ") || "No recorded payments"}
              </p>
              <p className="text-sm">
                Saved variance: {day.variance === null ? "—" : peso(day.variance)}
              </p>
            </button>
          </li>
        ))}
      </ul>
    </CashFlowPanel>
  );
}
