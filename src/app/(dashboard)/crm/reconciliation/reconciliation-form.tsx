"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { WorkspaceNotice, WorkspaceSection } from "@/components/features/attendance/attendance-ui";
import { Button } from "@/components/ui/button";
import { upsertReconciliationAction } from "./actions";

type PaymentSummary = {
  by_method: { cash: number; gcash: number; maya: number; card: number; pay_on_site: number; other: number };
  total_expected: number;
  total_collected: number;
};

type ExistingRecord = {
  actual_cash: number;
  actual_gcash: number;
  actual_maya: number;
  actual_card: number;
  actual_other: number;
  notes: string | null;
  status: string;
};

const METHODS = [
  { key: "actualCash",   label: "Cash",   icon: "💵" },
  { key: "actualGcash",  label: "GCash",  icon: "📱" },
  { key: "actualMaya",   label: "Maya",   icon: "💙" },
  { key: "actualCard",   label: "Card",   icon: "💳" },
  { key: "actualOther",  label: "Other",  icon: "📦" },
] as const;

type MethodKey = typeof METHODS[number]["key"];

function getExpected(key: MethodKey, summary: PaymentSummary | null): number {
  if (!summary) return 0;
  const m = summary.by_method;
  if (key === "actualCash")  return m.cash;
  if (key === "actualGcash") return m.gcash;
  if (key === "actualMaya")  return m.maya;
  if (key === "actualCard")  return m.card;
  if (key === "actualOther") return m.other + m.pay_on_site;
  return 0;
}

export function ReconciliationForm({
  branchId,
  date,
  summary,
  existing,
}: {
  branchId: string;
  date: string;
  summary: PaymentSummary | null;
  existing: ExistingRecord | null;
}) {
  const isApproved = existing?.status === "approved";
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState<"draft" | "submitted" | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const initActual: Record<MethodKey, string> = {
    actualCash:  String(existing?.actual_cash  ?? 0),
    actualGcash: String(existing?.actual_gcash ?? 0),
    actualMaya:  String(existing?.actual_maya  ?? 0),
    actualCard:  String(existing?.actual_card  ?? 0),
    actualOther: String(existing?.actual_other ?? 0),
  };
  const [actuals, setActuals] = useState(initActual);
  const [notes, setNotes] = useState(existing?.notes ?? "");

  function handleChange(key: MethodKey, value: string) {
    setActuals((prev) => ({ ...prev, [key]: value }));
  }

  function totalActual() {
    return METHODS.reduce((sum, m) => sum + (parseFloat(actuals[m.key]) || 0), 0);
  }
  function totalExpected() {
    if (!summary) return 0;
    return summary.total_collected;
  }
  function variance() {
    return totalActual() - totalExpected();
  }

  function handleSubmit(status: "draft" | "submitted") {
    setServerError(null);
    startTransition(async () => {
      const result = await upsertReconciliationAction({
        branchId,
        date,
        actualCash:  actuals.actualCash,
        actualGcash: actuals.actualGcash,
        actualMaya:  actuals.actualMaya,
        actualCard:  actuals.actualCard,
        actualOther: actuals.actualOther,
        notes:       notes || undefined,
        status,
      });
      if (result.ok) {
        setSaved(status);
        toast.success(
          status === "submitted"
            ? "Reconciliation submitted."
            : "Reconciliation saved as draft."
        );
      } else {
        setServerError(result.error ?? "Something went wrong");
        toast.error(result.error ?? "Could not save reconciliation.");
      }
    });
  }

  const varAmount = variance();
  const varColor = varAmount === 0 ? "var(--cs-success)" : varAmount > 0 ? "var(--cs-info)" : "var(--cs-error)";

  return (
    <WorkspaceSection
      title="Enter Actual Counts"
      description="Compare counted payments with collected system records."
      context={
        <span
          className="rounded-lg border px-3 py-1.5 text-xs font-bold"
          style={{
            borderColor: "var(--cs-border)",
            color: varColor,
          }}
        >
          Variance:{" "}
          {varAmount === 0
            ? "Balanced"
            : `${varAmount > 0 ? "+" : ""}₱${varAmount.toLocaleString("en-PH", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`}
        </span>
      }
    >
      <div className="grid gap-5 p-4">
        {isApproved && (
          <WorkspaceNotice tone="success" title="Approved and locked">
            This reconciliation has been approved and can no longer be edited.
          </WorkspaceNotice>
        )}

        <div className="overflow-x-auto">
          <div className="grid min-w-[540px] gap-3">
            <div className="grid grid-cols-[1fr_1fr_1fr_80px] items-center gap-2 border-b border-[var(--cs-border)] pb-1 text-[0.6875rem] font-bold uppercase tracking-wide text-[var(--cs-text-muted)]">
              <div>Method</div>
              <div className="text-right">Expected</div>
              <div className="text-right">Actual</div>
              <div className="text-right">Variance</div>
            </div>

            {METHODS.map((m) => {
              const expected = getExpected(m.key, summary);
              const actual = parseFloat(actuals[m.key]) || 0;
              const diff = actual - expected;
              return (
                <div
                  key={m.key}
                  className="grid grid-cols-[1fr_1fr_1fr_80px] items-center gap-2"
                >
                  <div className="flex items-center gap-1.5 text-sm font-medium text-[var(--cs-text)]">
                    <span aria-hidden="true">{m.icon}</span>
                    {m.label}
                  </div>
                  <div className="text-right text-sm text-[var(--cs-text-muted)]">
                    ₱{expected.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div>
                    <input
                      aria-label={`Actual ${m.label} amount`}
                      type="number"
                      step="0.01"
                      min="0"
                      disabled={isApproved}
                      value={actuals[m.key]}
                      onChange={(e) => handleChange(m.key, e.target.value)}
                      className="h-9 w-full rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-2 text-right text-sm text-[var(--cs-text)] outline-none transition focus:border-emerald-800 disabled:bg-[var(--cs-surface-warm)] disabled:opacity-70"
                    />
                  </div>
                  <div
                    className="text-right text-sm font-semibold"
                    style={{
                      color:
                        diff === 0
                          ? "var(--cs-text-muted)"
                          : diff > 0
                            ? "var(--cs-info)"
                            : "var(--cs-error)",
                    }}
                  >
                    {diff === 0
                      ? "—"
                      : `${diff > 0 ? "+" : ""}₱${diff.toLocaleString("en-PH", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}`}
                  </div>
                </div>
              );
            })}

            <div className="grid grid-cols-[1fr_1fr_1fr_80px] items-center gap-2 border-t-2 border-[var(--cs-border)] pt-2 text-sm font-bold text-[var(--cs-text)]">
              <div>Total</div>
              <div className="text-right">
                ₱{totalExpected().toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-right">
                ₱{totalActual().toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-right" style={{ color: varColor }}>
                {varAmount === 0
                  ? "✓"
                  : `${varAmount > 0 ? "+" : ""}₱${varAmount.toLocaleString("en-PH", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}`}
              </div>
            </div>
          </div>
        </div>

        {!isApproved && (
          <label className="grid gap-1.5 text-sm font-medium text-[var(--cs-text)]" htmlFor="recon-notes">
            Notes (optional)
            <textarea
              id="recon-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Explain any variance, missing receipts, etc."
              className="min-h-20 w-full resize-y rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 py-2 text-sm text-[var(--cs-text)] outline-none transition focus:border-emerald-800"
            />
          </label>
        )}

        {serverError && (
          <WorkspaceNotice tone="error" title="Could not save reconciliation">
            {serverError}
          </WorkspaceNotice>
        )}

        {saved && (
          <WorkspaceNotice tone="success">
            {saved === "submitted" ? "Reconciliation submitted for approval." : "Draft saved."}
          </WorkspaceNotice>
        )}

        {!isApproved && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleSubmit("draft")}
              disabled={isPending}
            >
              Save Draft
            </Button>
            <Button
              type="button"
              onClick={() => handleSubmit("submitted")}
              disabled={isPending}
              className="bg-[var(--cs-sand)] text-white hover:bg-[var(--cs-sand)]/90"
            >
              Submit for Approval
            </Button>
          </div>
        )}
      </div>
    </WorkspaceSection>
  );
}
