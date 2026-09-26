"use client";

import { ArrowRight, Banknote } from "lucide-react";
import type { CrmTodayPayment } from "@/lib/queries/crm-today";
import { formatCradleFlowMoney } from "@/lib/crm/cradle-flow";

export { CradleFlowRecentActivity } from "./today-recent-activity";

export function CradleFlowMoneySummary({
  payment,
  collectedOverride,
  onViewTotals,
}: {
  payment: CrmTodayPayment | null;
  collectedOverride: number;
  onViewTotals: () => void;
}) {
  const collected = collectedOverride;
  return (
    <section className="rounded-xl border border-[#d5c096] bg-[linear-gradient(135deg,#fffaf0,#f8f1df)] p-4 shadow-[var(--cs-shadow-xs)] sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-full bg-[#164b36] text-white">
            <Banknote className="size-5" />
          </span>
          <div>
            <h2 className="text-sm font-extrabold text-[var(--cs-text)]">Today’s Money</h2>
            <p className="text-xs text-[var(--cs-text-muted)]">
              Booking collections, not a drawer close.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-5">
          {[
            ["Collected", collected],
            ["Expected", payment?.total_expected ?? 0],
            ["Outstanding", payment?.total_unpaid ?? 0],
          ].map(([label, value]) => (
            <div key={String(label)} className="text-right">
              <div className="text-[10px] font-bold uppercase text-[var(--cs-text-muted)]">
                {label}
              </div>
              <div className="mt-1 text-sm font-extrabold">
                {formatCradleFlowMoney(Number(value))}
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={onViewTotals}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#b78a42] bg-white/70 px-4 text-xs font-bold text-[#6f4a1c]"
        >
          View Day Totals <ArrowRight className="size-4" />
        </button>
      </div>
    </section>
  );
}
