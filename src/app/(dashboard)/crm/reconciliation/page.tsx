import { redirect } from "next/navigation";
import { EmptyState, WorkspaceSection } from "@/components/features/attendance/attendance-ui";
import { CrmOperationalPageShell } from "@/components/features/crm/operational/crm-operational-page-shell";
import { getDailyPaymentSummary } from "@/lib/queries/bookings";
import { getReconciliationsAction } from "./actions";
import { ReconciliationForm } from "./reconciliation-form";
import { getBranchBusinessDate } from "@/lib/engine/slot-time";
import { getFrontDeskContext } from "@/lib/queries/crm-context";

const STATUS_CLASS: Record<string, string> = {
  draft: "border-[var(--cs-border)] bg-[var(--cs-surface-warm)] text-[var(--cs-text-muted)]",
  submitted: "border-amber-700/25 bg-amber-50 text-amber-900",
  approved: "border-emerald-800/20 bg-emerald-50 text-emerald-900",
};

async function getContext() {
  const context = await getFrontDeskContext();
  if (!context.branchId) redirect("/login");
  return { branchId: context.branchId, branchName: context.branchName };
}

export default async function ReconciliationPage() {
  const { branchId, branchName } = await getContext();
  const today = getBranchBusinessDate();
  const todayLabel = new Date(`${today}T00:00:00`).toLocaleDateString("en-PH", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const [summary, historyResult] = await Promise.all([
    getDailyPaymentSummary(branchId, today).catch(() => null),
    getReconciliationsAction(branchId, 20),
  ]);

  const history = historyResult.ok ? historyResult.data : [];

  const existing = history.find((r) => r.reconciliation_date === today) ?? null;

  const historyPanel = (
    <WorkspaceSection
      title="History"
      description="Recent end-of-day submissions for this branch."
    >
      {history.length === 0 ? (
        <div className="p-4">
          <EmptyState
            title="No reconciliations yet"
            detail="Saved drafts and submitted reconciliations will appear here."
          />
        </div>
      ) : (
        <div className="grid gap-2.5 p-4">
          {history.map((rec) => {
            const totalActual =
              Number(rec.actual_cash) +
              Number(rec.actual_gcash) +
              Number(rec.actual_maya) +
              Number(rec.actual_card) +
              Number(rec.actual_other);
            const totalExpected =
              Number(rec.expected_cash) +
              Number(rec.expected_gcash) +
              Number(rec.expected_maya) +
              Number(rec.expected_card) +
              Number(rec.expected_other);
            const diff = totalActual - totalExpected;
            const statusClass = STATUS_CLASS[rec.status] ?? STATUS_CLASS["draft"]!;

            return (
              <div
                key={rec.id}
                className={`rounded-lg border p-3 ${
                  rec.reconciliation_date === today
                    ? "border-[var(--cs-border)] bg-[var(--cs-sand-mist)]"
                    : "border-[var(--cs-border)] bg-[var(--cs-surface-warm)]"
                }`}
              >
                <div className="mb-1 flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-[var(--cs-text)]">
                    {new Date(rec.reconciliation_date + "T00:00:00").toLocaleDateString("en-PH", { month: "short", day: "numeric" })}
                    {rec.reconciliation_date === today && (
                      <span className="ml-1.5 text-[0.6875rem] font-bold text-[var(--cs-sand)]">Today</span>
                    )}
                  </span>
                  <span
                    className={`rounded border px-1.5 py-0.5 text-[0.6875rem] font-bold capitalize ${statusClass}`}
                  >
                    {rec.status}
                  </span>
                </div>
                <div className="flex justify-between gap-3 text-[0.8125rem]">
                  <span className="text-[var(--cs-text-muted)]">
                    Actual: ₱{totalActual.toLocaleString()}
                  </span>
                  <span
                    className="font-semibold"
                    style={{ color: diff === 0 ? "var(--cs-text-muted)" : diff > 0 ? "var(--cs-info)" : "var(--cs-error)" }}
                  >
                    {diff === 0 ? "Balanced" : `${diff > 0 ? "+" : ""}₱${diff.toLocaleString()}`}
                  </span>
                </div>
                {rec.notes && (
                  <div className="mt-1 text-xs italic text-[var(--cs-text-muted)]">
                    {rec.notes}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </WorkspaceSection>
  );

  return (
    <CrmOperationalPageShell
      title="End-of-Day Reconciliation"
      description="Verify today's collections against system records."
      context={`${branchName} · ${todayLabel}`}
      support={historyPanel}
    >
      <div className="grid gap-5">
        {summary && (
          <WorkspaceSection
            title="System Records"
            description={`Expected collections for ${todayLabel}.`}
          >
            <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { label: "Total Bookings", value: summary.total_count },
                { label: "Paid",           value: summary.paid_count },
                { label: "Unpaid",         value: summary.unpaid_count },
                { label: "Expected",       value: `₱${summary.total_expected.toLocaleString()}` },
                { label: "Collected",      value: `₱${summary.total_collected.toLocaleString()}` },
                { label: "Outstanding",    value: `₱${summary.total_unpaid.toLocaleString()}` },
              ].map((kpi) => (
                <div
                  key={kpi.label}
                  className="rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface-warm)] p-3"
                >
                  <div className="mb-1 text-[0.6875rem] font-semibold uppercase tracking-wide text-[var(--cs-text-muted)]">
                    {kpi.label}
                  </div>
                  <div className="text-lg font-bold text-[var(--cs-text)]">
                    {kpi.value}
                  </div>
                </div>
              ))}
            </div>
          </WorkspaceSection>
        )}

        <ReconciliationForm
          branchId={branchId}
          date={today}
          summary={summary}
          existing={
            existing
              ? {
                  actual_cash:  Number(existing.actual_cash),
                  actual_gcash: Number(existing.actual_gcash),
                  actual_maya:  Number(existing.actual_maya),
                  actual_card:  Number(existing.actual_card),
                  actual_other: Number(existing.actual_other),
                  notes:        existing.notes,
                  status:       existing.status,
                }
              : null
          }
        />
      </div>
    </CrmOperationalPageShell>
  );
}
