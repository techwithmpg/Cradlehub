"use client";

import React, { useState } from "react";
import { CheckCircle2, Loader2, X } from "lucide-react";
import { closeCashSessionAction } from "@/lib/cash-flow/cash-flow-actions";
import type { CashSessionSummary } from "@/lib/cash-flow/cash-flow-types";

interface CloseDrawerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: CashSessionSummary | null;
  onSuccess: () => void;
}

export function CloseDrawerModal({
  open,
  onOpenChange,
  session,
  onSuccess,
}: CloseDrawerModalProps) {
  const [physicalCount, setPhysicalCount] = useState("");
  const [closingNote, setClosingNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generate unique idempotency key per modal opening
  const [idempotencyKey] = useState(() =>
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `close-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );

  if (!open || !session) return null;

  const counted = Number(physicalCount);
  const hasCount = physicalCount.trim() !== "" && Number.isFinite(counted) && counted >= 0;
  const variance = hasCount ? counted - session.expectedCash : 0;
  const netMovements = session.expectedCash - session.openingFloat;

  const canSubmit =
    !!session.id &&
    hasCount &&
    !isSubmitting;

  const formatPeso = (val: number) =>
    `₱${val.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;

    setError(null);
    setIsSubmitting(true);

    try {
      const result = await closeCashSessionAction({
        sessionId: session.id,
        countedCash: counted,
        closingNote: closingNote.trim() || undefined,
        idempotencyKey,
      });

      if (!result.ok) {
        setError(result.error || "Unable to close cash drawer session.");
        return;
      }

      onOpenChange(false);
      onSuccess();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to close cash drawer session.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/35 px-4 py-6 backdrop-blur-[1px]"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) {
          onOpenChange(false);
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="close-drawer-title"
        className="w-full max-w-md rounded-2xl border border-[#E5DED5] bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-[#EFEAE4] px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <CheckCircle2 className="h-5 w-5" />
            </div>

            <div>
              <h2 id="close-drawer-title" className="text-base font-bold text-[#1E1916]">
                Day Close — Close cash drawer
              </h2>

              <p className="mt-0.5 text-xs text-[#7B6D61]">
                {session.cashDrawerName} · Reconcile physical cash and close session
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => onOpenChange(false)}
            className="rounded-lg p-1.5 text-[#7B6D61] transition hover:bg-[#F5F2EE] disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          {/* Day Close Breakdown: Float + Movements = Expected Drawer */}
          <div className="rounded-xl border border-[#EAE4DC] bg-[#FAF8F5] p-3.5 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-[#6B5D52]">Opening Float:</span>
              <span className="font-semibold text-[#1E1916] tabular-nums">
                {formatPeso(session.openingFloat)}
              </span>
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="text-[#6B5D52]">Posted Cash Movements:</span>
              <span
                className={`font-semibold tabular-nums ${
                  netMovements > 0
                    ? "text-emerald-700"
                    : netMovements < 0
                    ? "text-rose-700"
                    : "text-[#1E1916]"
                }`}
              >
                {netMovements > 0
                  ? `+${formatPeso(netMovements)}`
                  : netMovements < 0
                  ? `-${formatPeso(Math.abs(netMovements))}`
                  : "₱0.00"}
              </span>
            </div>

            <div className="pt-2 border-t border-[#EAE4DC] flex justify-between items-center">
              <span className="text-xs font-bold text-[#1E1916]">Expected Drawer Cash:</span>
              <span className="font-bold text-[#163E32] tabular-nums text-base">
                {formatPeso(session.expectedCash)}
              </span>
            </div>
          </div>

          {/* Physical Count Input */}
          <div>
            <label
              htmlFor="close-physical-count"
              className="mb-1.5 block text-xs font-semibold text-[#493F37]"
            >
              Physical counted cash <span className="text-rose-500">*</span>
            </label>

            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-[#6B5D52]">
                ₱
              </span>

              <input
                id="close-physical-count"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={physicalCount}
                onChange={(event) => setPhysicalCount(event.target.value)}
                disabled={isSubmitting}
                placeholder="0.00"
                className="h-12 w-full rounded-xl border border-[#DCD4CA] bg-white pl-8 pr-3 text-lg font-bold tabular-nums text-[#1E1916] outline-none transition focus:border-[#1B4D3E] focus:ring-2 focus:ring-[#1B4D3E]/10 disabled:bg-[#F7F5F2]"
              />
            </div>

            <p className="mt-1 text-[11px] text-[#8D7E72]">
              Count the exact physical cash in the drawer before closing.
            </p>
          </div>

          {/* Live Variance Display */}
          {hasCount && (
            <div
              className={`rounded-xl border p-3 text-xs flex justify-between items-center ${
                variance === 0
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                  : variance > 0
                  ? "border-blue-200 bg-blue-50 text-blue-900"
                  : "border-amber-200 bg-amber-50 text-amber-900"
              }`}
            >
              <span className="font-medium">
                {variance === 0
                  ? "Balanced (Count matches expected)"
                  : variance > 0
                  ? "Overage (+)"
                  : "Shortage (-)"}
              </span>
              <span className="font-bold tabular-nums text-sm">
                {variance > 0 ? `+${formatPeso(variance)}` : formatPeso(variance)}
              </span>
            </div>
          )}

          {/* Optional Closing Notes */}
          <div>
            <label
              htmlFor="close-notes"
              className="mb-1.5 block text-xs font-semibold text-[#493F37]"
            >
              Closing note <span className="ml-1 font-normal text-[#9C8878]">optional</span>
            </label>

            <input
              id="close-notes"
              value={closingNote}
              onChange={(event) => setClosingNote(event.target.value)}
              disabled={isSubmitting}
              maxLength={250}
              placeholder="Example: End of business day"
              className="h-11 w-full rounded-xl border border-[#DCD4CA] bg-white px-3 text-sm text-[#1E1916] outline-none transition focus:border-[#1B4D3E] focus:ring-2 focus:ring-[#1B4D3E]/10 disabled:bg-[#F7F5F2]"
            />
          </div>

          {error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-xs leading-5 text-rose-800">
              {error}
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-3 border-t border-[#EFEAE4] pt-4">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => onOpenChange(false)}
              className="rounded-lg border border-[#DED7CF] bg-white px-4 py-2.5 text-xs font-semibold text-[#493F37] transition hover:bg-[#F8F6F3] disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={!canSubmit}
              className="inline-flex min-w-[130px] items-center justify-center gap-2 rounded-lg bg-[#163E32] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-[#1B4D3E] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Closing…
                </>
              ) : (
                "Close Session"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
