"use client";

import { useState } from "react";
import { CrmPanel } from "../crm-panel";
import { CrmLoadingButton } from "../crm-loading-button";
import type { CrmTodayPayment } from "@/lib/queries/crm-today";

export function TodayEndOfDayTab({
  paymentSummary,
  completedCount,
  cancelledCount,
  totalCount,
}: {
  paymentSummary: CrmTodayPayment | null;
  completedCount: number;
  cancelledCount: number;
  totalCount: number;
}) {
  const [submitted, setSubmitted] = useState(false);

  const outstanding = paymentSummary?.total_unpaid ?? 0;

  const checklist = [
    { label: "All completed services reviewed", done: completedCount > 0 },
    { label: "All pending payments handled", done: outstanding === 0 },
    { label: "Cash and digital payments reconciled", done: false },
    { label: "No unresolved urgent actions", done: false },
    { label: "Notes added for owner/manager", done: false },
  ];

  const allChecked = checklist.every((c) => c.done);

  const handleSubmit = async () => {
    // Simulate submission — replace with real action when available
    await new Promise((r) => setTimeout(r, 1200));
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <CrmPanel>
        <div style={{ padding: "3rem 1.5rem", textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
          <div style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--cs-success)", marginBottom: 8 }}>
            End-of-day report submitted
          </div>
          <div style={{ fontSize: "0.875rem", color: "var(--cs-text-muted)" }}>
            Great work today. See you tomorrow.
          </div>
        </div>
      </CrmPanel>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Revenue Summary */}
      <CrmPanel title="Revenue Summary">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem" }}>
          {[
            { label: "Expected", value: paymentSummary?.total_expected ?? 0, color: "var(--cs-text)" },
            { label: "Collected", value: paymentSummary?.total_collected ?? 0, color: "var(--cs-success)" },
            { label: "Outstanding", value: outstanding, color: outstanding > 0 ? "var(--cs-error)" : "var(--cs-text-muted)" },
          ].map((s) => (
            <div
              key={s.label}
              className="cs-card"
              style={{
                padding: "0.75rem 1rem",
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                gap: "0.25rem",
              }}
            >
              <div style={{ fontSize: "1.125rem", fontWeight: 700, color: s.color, fontFamily: "var(--font-display)" }}>
                ₱{s.value.toLocaleString()}
              </div>
              <div style={{ fontSize: "0.6875rem", fontWeight: 600, color: "var(--cs-text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </CrmPanel>

      {/* Booking Summary */}
      <CrmPanel title="Booking Summary">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem" }}>
          {[
            { label: "Total", value: totalCount, color: "var(--cs-text)" },
            { label: "Completed", value: completedCount, color: "var(--cs-success)" },
            { label: "Cancelled / No-show", value: cancelledCount, color: cancelledCount > 0 ? "var(--cs-error)" : "var(--cs-text-muted)" },
          ].map((s) => (
            <div
              key={s.label}
              className="cs-card"
              style={{
                padding: "0.75rem 1rem",
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                gap: "0.25rem",
              }}
            >
              <div style={{ fontSize: "1.125rem", fontWeight: 700, color: s.color, fontFamily: "var(--font-display)" }}>
                {s.value}
              </div>
              <div style={{ fontSize: "0.6875rem", fontWeight: 600, color: "var(--cs-text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </CrmPanel>

      {/* Closing Checklist */}
      <CrmPanel title="Closing Checklist">
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {checklist.map((item, idx) => (
            <label
              key={idx}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.625rem",
                padding: "0.5rem 0.75rem",
                borderRadius: "var(--cs-r-sm)",
                background: item.done ? "var(--cs-success-bg)" : "var(--cs-surface-warm)",
                cursor: "pointer",
                fontSize: "0.8125rem",
                color: item.done ? "var(--cs-success-text)" : "var(--cs-text-secondary)",
                transition: "background 150ms ease",
              }}
            >
              <input
                type="checkbox"
                checked={item.done}
                readOnly
                style={{ accentColor: "var(--cs-success)", width: 16, height: 16 }}
              />
              <span style={{ textDecoration: item.done ? "line-through" : "none", opacity: item.done ? 0.7 : 1 }}>
                {item.label}
              </span>
            </label>
          ))}
        </div>
      </CrmPanel>

      {/* Submit */}
      <div
        style={{
          padding: "1.25rem",
          borderRadius: "var(--cs-r-lg)",
          background: "var(--cs-surface)",
          border: "1px solid var(--cs-border-soft)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--cs-text)" }}>
            Ready to close the day?
          </div>
          <div style={{ fontSize: "0.8125rem", color: "var(--cs-text-muted)", marginTop: 2 }}>
            {allChecked
              ? "All checklist items are complete. You may submit the end-of-day report."
              : "Some checklist items are not yet complete. Review before submitting."}
          </div>
        </div>
        <CrmLoadingButton
          label="Submit End-of-Day Report"
          loadingLabel="Submitting..."
          variant="primary"
          onClick={handleSubmit}
          disabled={!allChecked}
        />
      </div>
    </div>
  );
}
