"use client";

import React, { useMemo, useState } from "react";
import { ArrowLeftRight, Loader2, X } from "lucide-react";
import { handoverCashSessionAction } from "@/lib/cash-flow/cash-flow-actions";
import type { CashSessionSummary, StaffOption } from "@/lib/cash-flow/cash-flow-types";

interface HandoverDrawerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: CashSessionSummary | null;
  staffOptions: StaffOption[];
  onSuccess: () => void;
}

export function HandoverDrawerModal({
  open,
  onOpenChange,
  session,
  staffOptions,
  onSuccess,
}: HandoverDrawerModalProps) {
  const currentCustodianId = session?.currentCustodianId || session?.openedBy || "";
  const currentCustodianName = session?.currentCustodianName || session?.openedByName || "Staff";

  // Eligible next CSRs: active branch staff with cash-handling roles, excluding current custodian
  const eligibleStaff = useMemo(() => {
    return staffOptions.filter(
      (s) =>
        s.id !== currentCustodianId &&
        ["owner", "manager", "assistant_manager", "store_manager", "crm"].includes(s.role)
    );
  }, [staffOptions, currentCustodianId]);

  const [nextStaffId, setNextStaffId] = useState(() => eligibleStaff[0]?.id ?? "");
  const [physicalCount, setPhysicalCount] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generate unique idempotency key per modal opening
  const [idempotencyKey] = useState(() =>
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `handover-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );

  if (!open || !session) return null;

  const counted = Number(physicalCount);
  const hasCount = physicalCount.trim() !== "" && Number.isFinite(counted) && counted >= 0;
  const variance = hasCount ? counted - session.expectedCash : 0;

  const canSubmit =
    !!session.id &&
    !!nextStaffId &&
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
      const result = await handoverCashSessionAction({
        sessionId: session.id,
        incomingCustodianId: nextStaffId,
        countedCash: counted,
        notes: notes.trim() || undefined,
        idempotencyKey,
      });

      if (!result.ok) {
        setError(result.error || "Unable to complete handover.");
        return;
      }

      onOpenChange(false);
      onSuccess();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to complete handover.");
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
        aria-labelledby="handover-drawer-title"
        className="w-full max-w-md rounded-2xl border border-[#E5DED5] bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-[#EFEAE4] px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
              <ArrowLeftRight className="h-5 w-5" />
            </div>

            <div>
              <h2 id="handover-drawer-title" className="text-base font-bold text-[#1E1916]">
                Hand over drawer
              </h2>

              <p className="mt-0.5 text-xs text-[#7B6D61]">
                {session.cashDrawerName} · Shift custody handover
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
          {/* Current Custodian & Expected Cash Info */}
          <div className="rounded-xl border border-[#EAE4DC] bg-[#FAF8F5] p-3.5 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-[#6B5D52]">Current custodian:</span>
              <span className="font-semibold text-[#1E1916]">{currentCustodianName}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-[#6B5D52]">Expected drawer cash:</span>
              <span className="font-bold text-[#163E32] tabular-nums text-sm">
                {formatPeso(session.expectedCash)}
              </span>
            </div>
          </div>

          {/* Physical Count Input */}
          <div>
            <label
              htmlFor="handover-physical-count"
              className="mb-1.5 block text-xs font-semibold text-[#493F37]"
            >
              Physical count <span className="text-rose-500">*</span>
            </label>

            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-[#6B5D52]">
                ₱
              </span>

              <input
                id="handover-physical-count"
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
                  ? "Count matches expected (Balanced)"
                  : variance > 0
                  ? "Overage (+)"
                  : "Shortage (-)"}
              </span>
              <span className="font-bold tabular-nums text-sm">
                {variance > 0 ? `+${formatPeso(variance)}` : formatPeso(variance)}
              </span>
            </div>
          )}

          {/* Next CSR Selector */}
          <div>
            <label
              htmlFor="handover-next-csr"
              className="mb-1.5 block text-xs font-semibold text-[#493F37]"
            >
              Next CSR / Custodian <span className="text-rose-500">*</span>
            </label>

            {eligibleStaff.length === 0 ? (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 p-2.5 rounded-lg">
                No other active cash-handling staff available in this branch.
              </p>
            ) : (
              <select
                id="handover-next-csr"
                value={nextStaffId}
                onChange={(event) => setNextStaffId(event.target.value)}
                disabled={isSubmitting}
                className="h-11 w-full rounded-xl border border-[#DCD4CA] bg-white px-3 text-sm text-[#1E1916] outline-none transition focus:border-[#1B4D3E] focus:ring-2 focus:ring-[#1B4D3E]/10 disabled:bg-[#F7F5F2]"
              >
                {eligibleStaff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.role})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Optional Notes */}
          <div>
            <label
              htmlFor="handover-notes"
              className="mb-1.5 block text-xs font-semibold text-[#493F37]"
            >
              Handover note <span className="ml-1 font-normal text-[#9C8878]">optional</span>
            </label>

            <input
              id="handover-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              disabled={isSubmitting}
              maxLength={250}
              placeholder="Example: Count verified together"
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
              className="inline-flex min-w-[140px] items-center justify-center gap-2 rounded-lg bg-[#163E32] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-[#1B4D3E] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Confirming…
                </>
              ) : (
                "Confirm Handover"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
