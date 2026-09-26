import type { CashFlowDay } from "@/lib/cash-flow/read-model";
import { PAYMENT_METHOD_LABELS } from "@/lib/validations/booking";
import { CashFlowPanel, CashFlowStatus, peso } from "./cash-flow-ui";

function closeTone(
  status: string | undefined
): "neutral" | "success" | "warning" | "info" {
  if (status === "approved") return "success";
  if (status === "submitted") return "info";
  if (status === "draft") return "warning";
  return "neutral";
}

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
      description="Current booking balances by booking date alongside saved Day Close records."
    >
      <div className="hidden grid-cols-[1.1fr_1fr_1.3fr_1fr] gap-4 rounded-t-xl border border-b-0 border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)] px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-[var(--cs-text-muted)] lg:grid">
        <span>Business date</span>
        <span>Recorded / Outstanding</span>
        <span>Payment mix</span>
        <span>Day Close</span>
      </div>

      <ul className="overflow-hidden rounded-xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] lg:rounded-t-none">
        {days.map((day) => {
          const methods = Object.entries(day.summary.by_method)
            .filter(([, amount]) => amount > 0)
            .map(
              ([method, amount]) =>
                `${PAYMENT_METHOD_LABELS[
                  method as keyof typeof PAYMENT_METHOD_LABELS
                ] ?? method} ${peso(amount)}`
            )
            .join(" · ");

          return (
            <li
              key={day.date}
              className="border-t border-[var(--cs-border-soft)] first:border-t-0"
            >
              <button
                type="button"
                onClick={() => onSelect(day.date)}
                className="grid w-full min-w-0 gap-3 px-4 py-4 text-left transition-colors hover:bg-[var(--cs-surface-warm)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--cs-sand)] sm:grid-cols-2 lg:grid-cols-[1.1fr_1fr_1.3fr_1fr]"
                aria-label={`View day ${day.date}`}
              >
                <div className="min-w-0">
                  <p className="font-bold text-[var(--cs-text)]">
                    {day.date}
                  </p>

                  <div className="mt-2">
                    <CashFlowStatus tone={closeTone(day.reconciliation?.status)}>
                      {day.reconciliation?.status ?? "Open"}
                    </CashFlowStatus>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-[var(--cs-text-muted)]">
                    Recorded payments
                  </p>
                  <p className="mt-1 font-bold tabular-nums text-[var(--cs-text)]">
                    {peso(day.summary.total_collected)}
                  </p>
                  <p className="mt-1 text-xs text-[var(--cs-text-muted)]">
                    Outstanding {peso(day.summary.total_unpaid)}
                  </p>
                </div>

                <div className="min-w-0 text-sm text-[var(--cs-text-secondary)]">
                  <p className="text-xs font-semibold text-[var(--cs-text-muted)] lg:hidden">
                    Payment mix
                  </p>
                  <p className="mt-1 break-words lg:mt-0">
                    {methods || "No recorded payments"}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-[var(--cs-text-muted)]">
                    Saved variance
                  </p>

                  <p
                    className={`mt-1 font-semibold tabular-nums ${
                      day.variance === 0
                        ? "text-[var(--cs-success-text)]"
                        : "text-[var(--cs-text)]"
                    }`}
                  >
                    {day.variance === null ? "—" : peso(day.variance)}
                  </p>

                  <p className="mt-1 text-xs text-[var(--cs-text-muted)]">
                    Select to review
                  </p>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </CashFlowPanel>
  );
}