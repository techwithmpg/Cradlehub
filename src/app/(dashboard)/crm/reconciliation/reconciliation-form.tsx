"use client";

import { useState, useTransition } from "react";
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
      } else {
        setServerError(result.error ?? "Something went wrong");
      }
    });
  }

  const varAmount = variance();
  const varColor = varAmount === 0 ? "var(--cs-success)" : varAmount > 0 ? "var(--cs-info)" : "var(--cs-error)";

  return (
    <div className="cs-card" style={{ padding: "1.5rem" }}>
      <div
        style={{
          fontSize: "0.8125rem",
          fontWeight: 600,
          color: "var(--cs-text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: "1.25rem",
        }}
      >
        Enter Actual Counts
      </div>

      {isApproved && (
        <div
          style={{
            padding: "0.75rem 1rem",
            borderRadius: 8,
            backgroundColor: "#ECFDF5",
            color: "#065F46",
            fontSize: "0.8125rem",
            fontWeight: 600,
            marginBottom: "1.25rem",
          }}
        >
          ✅ This reconciliation has been approved and is locked.
        </div>
      )}

      {/* Per-method rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1.25rem" }}>
        {/* Header */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr 80px",
            gap: "0.5rem",
            fontSize: "0.6875rem",
            fontWeight: 700,
            color: "var(--cs-text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            paddingBottom: "0.25rem",
            borderBottom: "1px solid var(--cs-border)",
          }}
        >
          <div>Method</div>
          <div style={{ textAlign: "right" }}>Expected</div>
          <div style={{ textAlign: "right" }}>Actual</div>
          <div style={{ textAlign: "right" }}>Variance</div>
        </div>

        {METHODS.map((m) => {
          const expected = getExpected(m.key, summary);
          const actual = parseFloat(actuals[m.key]) || 0;
          const diff = actual - expected;
          return (
            <div
              key={m.key}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr 80px",
                gap: "0.5rem",
                alignItems: "center",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.875rem", fontWeight: 500 }}>
                <span>{m.icon}</span> {m.label}
              </div>
              <div style={{ textAlign: "right", fontSize: "0.875rem", color: "var(--cs-text-muted)" }}>
                ₱{expected.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  disabled={isApproved}
                  value={actuals[m.key]}
                  onChange={(e) => handleChange(m.key, e.target.value)}
                  style={{
                    width: "100%",
                    height: 34,
                    borderRadius: 6,
                    border: "1px solid var(--cs-border)",
                    backgroundColor: isApproved ? "var(--cs-surface-warm)" : "var(--cs-surface)",
                    color: "var(--cs-text)",
                    padding: "0 0.5rem",
                    fontSize: "0.875rem",
                    textAlign: "right",
                  }}
                />
              </div>
              <div
                style={{
                  textAlign: "right",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  color: diff === 0 ? "var(--cs-text-muted)" : diff > 0 ? "var(--cs-info)" : "var(--cs-error)",
                }}
              >
                {diff === 0 ? "—" : `${diff > 0 ? "+" : ""}₱${diff.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              </div>
            </div>
          );
        })}

        {/* Totals row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr 80px",
            gap: "0.5rem",
            alignItems: "center",
            paddingTop: "0.5rem",
            borderTop: "2px solid var(--cs-border)",
          }}
        >
          <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--cs-text)" }}>Total</div>
          <div style={{ textAlign: "right", fontSize: "0.875rem", fontWeight: 700, color: "var(--cs-text)" }}>
            ₱{totalExpected().toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ textAlign: "right", fontSize: "0.875rem", fontWeight: 700, color: "var(--cs-text)" }}>
            ₱{totalActual().toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ textAlign: "right", fontSize: "0.875rem", fontWeight: 700, color: varColor }}>
            {varAmount === 0 ? "✓" : `${varAmount > 0 ? "+" : ""}₱${varAmount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          </div>
        </div>
      </div>

      {/* Notes */}
      {!isApproved && (
        <div style={{ marginBottom: "1.25rem" }}>
          <label
            htmlFor="recon-notes"
            style={{ display: "block", fontSize: "0.8125rem", fontWeight: 500, marginBottom: 4 }}
          >
            Notes (optional)
          </label>
          <textarea
            id="recon-notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Explain any variance, missing receipts, etc."
            style={{
              width: "100%",
              borderRadius: 6,
              border: "1px solid var(--cs-border)",
              backgroundColor: "var(--cs-surface)",
              color: "var(--cs-text)",
              padding: "0.5rem 0.75rem",
              fontSize: "0.875rem",
              resize: "vertical",
            }}
          />
        </div>
      )}

      {serverError && (
        <div
          style={{
            padding: "0.75rem",
            backgroundColor: "#FEF2F2",
            color: "#991B1B",
            borderRadius: 6,
            fontSize: "0.8125rem",
            marginBottom: "1rem",
          }}
        >
          {serverError}
        </div>
      )}

      {saved && (
        <div
          style={{
            padding: "0.75rem",
            backgroundColor: "#ECFDF5",
            color: "#065F46",
            borderRadius: 6,
            fontSize: "0.8125rem",
            marginBottom: "1rem",
          }}
        >
          {saved === "submitted" ? "Reconciliation submitted for approval." : "Draft saved."}
        </div>
      )}

      {!isApproved && (
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            onClick={() => handleSubmit("draft")}
            disabled={isPending}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "1px solid var(--cs-border)",
              backgroundColor: "var(--cs-surface)",
              color: "var(--cs-text)",
              fontSize: "0.8125rem",
              fontWeight: 500,
              cursor: isPending ? "default" : "pointer",
              opacity: isPending ? 0.6 : 1,
            }}
          >
            Save Draft
          </button>
          <button
            onClick={() => handleSubmit("submitted")}
            disabled={isPending}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "none",
              backgroundColor: "var(--cs-sand)",
              color: "#fff",
              fontSize: "0.8125rem",
              fontWeight: 600,
              cursor: isPending ? "default" : "pointer",
              opacity: isPending ? 0.6 : 1,
            }}
          >
            Submit for Approval
          </button>
        </div>
      )}
    </div>
  );
}
