import { ReconciliationForm } from "@/app/(dashboard)/crm/reconciliation/reconciliation-form";
import { reconciliationSummary, type CashFlowDay } from "@/lib/cash-flow/read-model";
import { CashFlowPanel, CashFlowStatus, peso } from "./cash-flow-ui";

export function CashFlowCloseRecord({ day }: { day: CashFlowDay }) {
  const close = day.reconciliation;
  return (
    <CashFlowPanel title={`Day Close · ${day.date}`}>
      <CashFlowStatus>{close?.status ?? "Open"}</CashFlowStatus>
      {close ? (
        <div className="mt-3 space-y-2 text-sm">
          <p>Saved variance: {peso(day.variance ?? 0)}</p>
          <p className="text-[var(--cs-text-muted)]">Saved expected / actual counts</p>
          <dl className="grid grid-cols-2 gap-2">
            {(["cash", "gcash", "maya", "card", "other"] as const).map((method) => (
              <div key={method}>
                <dt className="capitalize">{method}</dt>
                <dd className="tabular-nums">
                  {peso(close[`expected_${method}`])} / {peso(close[`actual_${method}`])}
                </dd>
              </div>
            ))}
          </dl>
          <p className="whitespace-pre-wrap break-words">{close.notes || "No notes recorded."}</p>
        </div>
      ) : (
        <p className="mt-3 text-sm">No reconciliation has been recorded for this date.</p>
      )}
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
      <p className="text-sm text-[var(--cs-text-muted)]">
        {day.reconciliation?.status === "approved"
          ? "Approved counts retain the saved expected values."
          : "Expected counts use current booking payments. Saving recalculates them through the existing reconciliation action."}
      </p>
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
