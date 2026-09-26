"use client";

import type { CashFlowEntry } from "@/lib/cash-flow/read-model";
import { CashFlowStatus, peso } from "./cash-flow-ui";

function formatPreviewDate(dateStr?: string, timeStr?: string) {
  if (!dateStr) return "—";
  try {
    const [y, m, d] = dateStr.split("-").map(Number);
    if (!y || !m || !d) return dateStr;
    const date = new Date(Date.UTC(y, m - 1, d));
    const formatted = date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
    return timeStr ? `${formatted} ${timeStr}` : formatted;
  } catch {
    return dateStr;
  }
}

export function CashFlowCorrectionPreview({
  transaction,
  action,
  difference,
  effectiveDateTime,
}: {
  transaction?: CashFlowEntry | null;
  action: string;
  difference: number;
  correctedAmount?: number;
  effectiveDateTime: string;
  reason?: string;
}) {
  const origRef =
    transaction?.reference ||
    (transaction?.id ? `#${transaction.id.slice(0, 8)}` : "EXP-20260925-001");
  const origAmount = transaction?.amount ?? 1250;
  const description = transaction?.service || transaction?.customer || "Supplies Purchase";

  // Action text for preview
  const actionLabel =
    action === "correct_amount"
      ? `Amount correction (${description})`
      : action === "reverse"
        ? `Reversal (${description})`
        : action === "correct_category"
          ? `Category update (${description})`
          : action === "correct_method"
            ? `Method update (${description})`
            : `Adjustment (${description})`;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-[var(--cs-text-secondary)]">
          Audit trail preview
        </p>
        <span className="text-[11px] text-[var(--cs-text-muted)]">
          This correction will create a new linked entry in the ledger.
        </span>
      </div>

      <div className="rounded-xl border border-[var(--cs-border-soft)] bg-white p-3.5 space-y-3">
        {/* Row 1: Original Entry */}
        <div className="flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <span className="size-2.5 rounded-full bg-stone-400" />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-[var(--cs-text)]">Original entry</span>
                <span className="font-mono text-[11px] text-[var(--cs-text-muted)]">{origRef}</span>
              </div>
              <p className="text-[11px] text-[var(--cs-text-secondary)]">
                {formatPreviewDate(transaction?.date, transaction?.time)} · {description}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-bold tabular-nums text-rose-700">-{peso(origAmount)}</span>
            <CashFlowStatus tone={transaction?.paymentStatus ?? "paid"}>
              {transaction?.paymentStatus ?? "Paid"}
            </CashFlowStatus>
          </div>
        </div>

        {/* Vertical connector line */}
        <div className="ml-1 -my-1 h-3 w-0.5 bg-stone-300" />

        {/* Row 2: Correction Entry */}
        <div className="flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <span className="size-2.5 rounded-full bg-[#1b4332]" />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-[#1b4332]">Correction entry</span>
                <span className="rounded bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 text-[10px] font-semibold text-emerald-800">
                  Pending correction
                </span>
              </div>
              <p className="text-[11px] text-[var(--cs-text-secondary)]">
                {effectiveDateTime || "Effective upon save"} · {actionLabel}
              </p>
              <p className="text-[10px] text-[var(--cs-text-muted)]">
                Linked to: {origRef}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`font-bold tabular-nums ${
                difference > 0
                  ? "text-emerald-700"
                  : difference < 0
                    ? "text-rose-700"
                    : "text-[var(--cs-text-secondary)]"
              }`}
            >
              {difference > 0 ? `+${peso(difference)}` : difference < 0 ? `-${peso(Math.abs(difference))}` : peso(0)}
            </span>
            <CashFlowStatus tone="warning">Pending</CashFlowStatus>
          </div>
        </div>
      </div>
    </div>
  );
}
