"use client";

import React, { useMemo, useState } from "react";
import { Banknote, Loader2, X } from "lucide-react";
import { openCashSessionAction } from "@/lib/cash-flow/cash-flow-actions";
import type { CashSessionSummary, MaskedAccountOption } from "@/lib/cash-flow/cash-flow-types";

interface OpenCashDrawerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string;
  businessDate: string;
  availableDrawers: MaskedAccountOption[];
  activeSessions: CashSessionSummary[];
  onSuccess: () => void;
}

export function OpenCashDrawerModal({
  open,
  onOpenChange,
  branchId,
  businessDate,
  availableDrawers,
  activeSessions,
  onSuccess,
}: OpenCashDrawerModalProps) {
  const openDrawerIds = useMemo(
    () => new Set(activeSessions.map((session) => session.cashDrawerAccountId)),
    [activeSessions]
  );

  const selectableDrawers = useMemo(
    () =>
      availableDrawers.filter(
        (drawer) => drawer.accountType === "cash_drawer" && !openDrawerIds.has(drawer.id)
      ),
    [availableDrawers, openDrawerIds]
  );

  const [drawerId, setDrawerId] = useState(() => selectableDrawers[0]?.id ?? "");
  const [openingFloat, setOpeningFloat] = useState("");
  const [openingNote, setOpeningNote] = useState("");
  const [idempotencyKey] = useState(() =>
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `cash-session-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const amount = Number(openingFloat);

  const canSubmit =
    !!drawerId &&
    openingFloat.trim() !== "" &&
    Number.isFinite(amount) &&
    amount >= 0 &&
    !isSubmitting;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!canSubmit) return;

    setError(null);
    setIsSubmitting(true);

    try {
      const result = await openCashSessionAction({
        branchId,
        cashDrawerAccountId: drawerId,
        businessDate,
        openingFloat: amount,
        openingNote: openingNote.trim() || undefined,
        idempotencyKey,
      });

      if (!result.ok) {
        setError(result.error || "Unable to open the cash drawer.");
        return;
      }

      onOpenChange(false);
      onSuccess();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to open the cash drawer.");
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
        aria-labelledby="open-cash-drawer-title"
        className="w-full max-w-md rounded-2xl border border-[#E5DED5] bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-[#EFEAE4] px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <Banknote className="h-5 w-5" />
            </div>

            <div>
              <h2 id="open-cash-drawer-title" className="text-base font-bold text-[#1E1916]">
                Open cash drawer
              </h2>

              <p className="mt-0.5 text-xs text-[#7B6D61]">
                Count the physical change fund before starting the drawer.
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

        <form onSubmit={handleSubmit} className="space-y-5 p-5">
          {selectableDrawers.length === 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-900">
                No unopened cash drawer is available
              </p>

              <p className="mt-1 text-xs leading-5 text-amber-800">
                Every configured physical drawer is already open, or no active cash drawer account
                is configured for this branch.
              </p>
            </div>
          ) : (
            <>
              <div>
                <label
                  htmlFor="cash-session-drawer"
                  className="mb-1.5 block text-xs font-semibold text-[#493F37]"
                >
                  Cash drawer
                </label>

                <select
                  id="cash-session-drawer"
                  value={drawerId}
                  onChange={(event) => setDrawerId(event.target.value)}
                  disabled={isSubmitting}
                  className="h-11 w-full rounded-xl border border-[#DCD4CA] bg-white px-3 text-sm text-[#1E1916] outline-none transition focus:border-[#1B4D3E] focus:ring-2 focus:ring-[#1B4D3E]/10 disabled:bg-[#F7F5F2]"
                >
                  {selectableDrawers.map((drawer) => (
                    <option key={drawer.id} value={drawer.id}>
                      {drawer.name}
                      {drawer.identifierMask ? ` · ${drawer.identifierMask}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="cash-session-opening-float"
                  className="mb-1.5 block text-xs font-semibold text-[#493F37]"
                >
                  Opening cash
                </label>

                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-[#6B5D52]">
                    ₱
                  </span>

                  <input
                    id="cash-session-opening-float"
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={openingFloat}
                    onChange={(event) => setOpeningFloat(event.target.value)}
                    disabled={isSubmitting}
                    placeholder="0.00"
                    className="h-12 w-full rounded-xl border border-[#DCD4CA] bg-white pl-8 pr-3 text-lg font-bold tabular-nums text-[#1E1916] outline-none transition focus:border-[#1B4D3E] focus:ring-2 focus:ring-[#1B4D3E]/10 disabled:bg-[#F7F5F2]"
                  />
                </div>

                <p className="mt-1.5 text-[11px] leading-4 text-[#8D7E72]">
                  This is the physical cash already inside the drawer. It is not revenue.
                </p>
              </div>

              <div>
                <label
                  htmlFor="cash-session-opening-note"
                  className="mb-1.5 block text-xs font-semibold text-[#493F37]"
                >
                  Note
                  <span className="ml-1 font-normal text-[#9C8878]">optional</span>
                </label>

                <input
                  id="cash-session-opening-note"
                  value={openingNote}
                  onChange={(event) => setOpeningNote(event.target.value)}
                  disabled={isSubmitting}
                  maxLength={250}
                  placeholder="Example: Change fund"
                  className="h-11 w-full rounded-xl border border-[#DCD4CA] bg-white px-3 text-sm text-[#1E1916] outline-none transition focus:border-[#1B4D3E] focus:ring-2 focus:ring-[#1B4D3E]/10 disabled:bg-[#F7F5F2]"
                />
              </div>
            </>
          )}

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
              className="inline-flex min-w-[126px] items-center justify-center gap-2 rounded-lg bg-[#163E32] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-[#1B4D3E] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Opening…
                </>
              ) : (
                "Open drawer"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
