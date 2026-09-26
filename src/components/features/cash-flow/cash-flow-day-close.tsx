import { ReconciliationForm } from "@/app/(dashboard)/crm/reconciliation/reconciliation-form";
import {
  reconciliationSummary,
  type CashFlowDay,
} from "@/lib/cash-flow/read-model";
import { PAYMENT_METHOD_LABELS } from "@/lib/validations/booking";
import { CashFlowPanel, CashFlowStatus, peso } from "./cash-flow-ui";

const METHODS = ["cash", "gcash", "maya", "card", "other"] as const;

function closeTone(
  status: string | undefined
): "neutral" | "success" | "warning" | "info" {
  if (status === "approved") return "success";
  if (status === "submitted") return "info";
  if (status === "draft") return "warning";
  return "neutral";
}

export function CashFlowCloseRecord({ day }: { day: CashFlowDay }) {
  const close = day.reconciliation;
  const status = close?.status ?? "Open";

  return (
    <CashFlowPanel
      title={`Day Close · ${day.date}`}
      description="Saved reconciliation state for this business date."
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CashFlowStatus tone={closeTone(close?.status)}>
            {status}
          </CashFlowStatus>

          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-[var(--cs-text-muted)]">
            Saved variance
          </p>

          <p
            className={`mt-1 text-2xl font-bold tabular-nums ${
              day.variance === 0
                ? "text-[var(--cs-success-text)]"
                : "text-[var(--cs-text)]"
            }`}
          >
            {close ? peso(day.variance ?? 0) : "—"}
          </p>
        </div>

        {close ? (
          <p className="max-w-sm text-right text-xs leading-5 text-[var(--cs-text-muted)]">
            Expected values are the saved Day Close values. Actual values are the
            amounts entered during reconciliation.
          </p>
        ) : null}
      </div>

      {close ? (
        <div className="mt-5 overflow-hidden rounded-xl border border-[var(--cs-border-soft)]">
          <div className="grid grid-cols-[1fr_1fr_1fr] bg-[var(--cs-surface-warm)] px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-[var(--cs-text-muted)]">
            <span>Method</span>
            <span className="text-right">Expected</span>
            <span className="text-right">Actual</span>
          </div>

          {METHODS.map((method) => (
            <div
              key={method}
              className="grid grid-cols-[1fr_1fr_1fr] border-t border-[var(--cs-border-soft)] px-4 py-3 text-sm first:border-t-0"
            >
              <span className="font-semibold text-[var(--cs-text-secondary)]">
                {PAYMENT_METHOD_LABELS[method] ?? method}
              </span>

              <span className="text-right tabular-nums text-[var(--cs-text)]">
                {peso(close[`expected_${method}`])}
              </span>

              <span className="text-right font-semibold tabular-nums text-[var(--cs-text)]">
                {peso(close[`actual_${method}`])}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-5 rounded-xl border border-dashed border-[var(--cs-border)] bg-[var(--cs-surface-warm)] px-4 py-6 text-center">
          <p className="text-sm font-semibold text-[var(--cs-text-secondary)]">
            No Day Close recorded yet
          </p>
          <p className="mt-1 text-xs text-[var(--cs-text-muted)]">
            Use the reconciliation form below when the business day is ready to close.
          </p>
        </div>
      )}

      {close?.notes ? (
        <div className="mt-4 rounded-xl bg-[var(--cs-surface-warm)] p-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--cs-text-muted)]">
            Notes
          </p>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm text-[var(--cs-text-secondary)]">
            {close.notes}
          </p>
        </div>
      ) : null}
    </CashFlowPanel>
  );
}

export function CashFlowDayClose({
  day,
  branchId,
  onSaved,
}: {
  day: CashFlowDay;
  branchId: string;
  onSaved: () => void;
}) {
  return (
    <div className="space-y-5">
      <CashFlowCloseRecord day={day} />

      <div className="rounded-xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)] px-4 py-3 text-sm text-[var(--cs-text-secondary)]">
        {day.reconciliation?.status === "approved"
          ? "This Day Close is approved. Saved expected values remain locked to the approved record."
          : "Expected values use the current booking-payment snapshot. Saving recalculates them through the existing Day Close reconciliation action."}
      </div>

      <ReconciliationForm
        key={`${branchId}:${day.date}:${day.reconciliation?.updated_at ?? "new"}`}
        branchId={branchId}
        date={day.date}
        summary={reconciliationSummary(day)}
        existing={day.reconciliation}
        onSaved={onSaved}
      />
    </div>
  );
}