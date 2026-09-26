"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Banknote,
  Receipt,
  TrendingUp,
  FileText,
  BookOpen,
  Check,
  Package,
} from "lucide-react";
import { PAYMENT_METHOD_LABELS } from "@/lib/validations/booking";
import { formatTime12h } from "@/lib/utils/time-format";
import { cn } from "@/lib/utils";
import type { CashFlowDay, CashFlowEntry } from "@/lib/cash-flow/read-model";
import type { CashFlowEntryType } from "./cash-flow-entry-type-selector";
import { upsertReconciliationAction } from "@/app/(dashboard)/crm/reconciliation/actions";
import {
  CashFlowMetric,
  CashFlowPanel,
  CashFlowStatus,
  CashFlowCoverageTiles,
  buildStandardCoverageItems,
  PAYMENT_METHOD_ICONS,
  peso,
} from "./cash-flow-ui";

const METHODS = ["cash", "gcash", "maya", "card", "pay_on_site", "other"] as const;

function formatDayHeaderDate(dateStr: string) {
  try {
    const [y, m, d] = dateStr.split("-").map(Number);
    if (!y || !m || !d) return dateStr;
    const date = new Date(Date.UTC(y, m - 1, d));
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return dateStr;
  }
}

export function CashFlowCloseRecord({ day }: { day: CashFlowDay }) {
  const close = day.reconciliation;
  const status = close?.status ?? "Open";

  return (
    <CashFlowPanel
      title={`Day Close · ${day.date}`}
      description="Saved reconciliation state for this business date."
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CashFlowStatus tone={status === "approved" ? "success" : status === "draft" ? "warning" : "neutral"}>
            {status}
          </CashFlowStatus>

          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-[var(--cs-text-muted)]">
            Saved variance
          </p>

          <p
            className={`mt-1 text-2xl font-bold tabular-nums ${
              day.variance === 0
                ? "text-emerald-700"
                : "text-[var(--cs-text)]"
            }`}
          >
            {close ? peso(day.variance ?? 0) : "—"}
          </p>
        </div>

        {close ? (
          <p className="max-w-sm text-right text-xs leading-5 text-[var(--cs-text-muted)]">
            Expected values are compiled from booking records. Actual values are recorded during reconciliation review.
          </p>
        ) : null}
      </div>
    </CashFlowPanel>
  );
}

export function CashFlowDayClose({
  day,
  branchId,
  onSaved,
  onOpenLedger,
  onNewEntry,
  onCorrectEntry,
}: {
  day: CashFlowDay;
  branchId: string;
  onSaved: () => void;
  onOpenLedger?: () => void;
  onNewEntry?: (type?: CashFlowEntryType) => void;
  onCorrectEntry?: (entry: CashFlowEntry) => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [reviewMessage, setReviewMessage] = useState<string | null>(null);

  const close = day.reconciliation;
  const isApproved = close?.status === "approved";
  const hasVariance = day.variance !== null && day.variance !== 0;
  const openIssuesCount = (day.summary.unpaid_count > 0 ? 1 : 0) + (hasVariance ? 1 : 0);
  const totalInflow = day.summary.total_collected;
  const totalOutflow = day.entries
    .filter((e) => e.paymentStatus === "refunded")
    .reduce((sum, e) => sum + e.amount, 0);
  const netPosition = totalInflow - totalOutflow;

  const bookingEntries = day.entries.filter((e) => e.source === "booking");
  const homeServiceEntries = day.entries.filter((e) => e.source === "home_service");
  const bookingCollected = bookingEntries.reduce((sum, e) => sum + e.amount, 0);
  const homeServiceCollected = homeServiceEntries.reduce((sum, e) => sum + e.amount, 0);
  const transactionEntries = day.entries.filter((e) => e.amount > 0);

  const coverageItems = buildStandardCoverageItems(
    bookingCollected,
    bookingEntries.filter((e) => e.amount > 0).length,
    homeServiceCollected,
    homeServiceEntries.filter((e) => e.amount > 0).length,
    totalInflow,
    transactionEntries.length
  );

  const handleCoverageSelect = (key: string) => {
    const map: Record<string, CashFlowEntryType> = {
      expenses: "expense",
      tips: "tip",
      staff_advances: "staff_advance",
      petty_cash: "petty_cash",
      transfers: "transfer",
      refunds: "refund",
      adjustments: "adjustment",
      misc_income: "misc_income",
      commission_payouts: "commission_payout",
      payroll: "payroll",
    };
    const mapped = map[key];
    if (mapped && onNewEntry) {
      onNewEntry(mapped);
    }
  };

  // Chronological timeline events
  const timelineEvents = [...day.entries]
    .filter((e) => e.amount > 0)
    .sort((a, b) => a.time.localeCompare(b.time));

  async function handleMarkAsReviewed() {
    setSubmitting(true);
    setReviewMessage(null);

    try {
      const actualCash = day.summary.by_method.cash ?? 0;
      const actualGcash = day.summary.by_method.gcash ?? 0;
      const actualMaya = day.summary.by_method.maya ?? 0;
      const actualCard = day.summary.by_method.card ?? 0;
      const actualOther = (day.summary.by_method.other ?? 0) + (day.summary.by_method.pay_on_site ?? 0);

      const res = await upsertReconciliationAction({
        branchId,
        date: day.date,
        actualCash,
        actualGcash,
        actualMaya,
        actualCard,
        actualOther,
        status: "submitted",
        notes: "Automated Day Close verified and marked as reviewed.",
      });

      if (!res.ok) {
        setReviewMessage(res.error || "Failed to mark as reviewed.");
      } else {
        setReviewMessage("Day Close successfully marked as reviewed.");
        onSaved();
      }
    } catch {
      setReviewMessage("An error occurred while saving the review.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleExportPdf() {
    window.print();
  }

  return (
    <div className="space-y-5">
      {/* TOP BANNER: Auto-generated Day Summary */}
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-emerald-200/70 bg-emerald-50/50 p-4 sm:flex-row sm:items-center sm:p-5">
        <div className="flex items-start gap-3.5">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#1b4332] text-white shadow-xs">
            <Check className="size-5 stroke-[2.5]" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[var(--cs-text)]">
              Auto-generated Day Summary · {formatDayHeaderDate(day.date)}
            </h2>
            <p className="mt-0.5 text-xs text-[var(--cs-text-secondary)]">
              Daily financial activity has been compiled from all bookings, payments, expenses and operational records.
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3 sm:text-right">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-100/60 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-900">
              <span className="size-1.5 rounded-full bg-emerald-600" />
              {isApproved ? "Approved and locked" : close ? "Ready for review" : "Compiled"}
            </div>
            <p className="mt-1 text-[11px] text-[var(--cs-text-muted)]">
              {close?.updated_at
                ? `Last updated today at ${new Date(close.updated_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
                : "Active live compile"}
            </p>
          </div>
        </div>
      </div>

      {/* TOP METRICS: 4 Cards */}
      <section
        aria-label="Day Close metrics"
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        <CashFlowMetric
          label="Recorded Inflow"
          value={peso(totalInflow)}
          detail="Total cash received today"
          icon={<Banknote className="size-4" />}
          iconBg="bg-emerald-50 text-emerald-700 border-emerald-200"
          dotTone="green"
        />

        <CashFlowMetric
          label="Recorded Outflow"
          value={peso(totalOutflow)}
          detail="Total operational expenses"
          icon={<Receipt className="size-4" />}
          iconBg="bg-[#FBF6EE] text-[#8A6347] border-[#EAE4DC]"
          dotTone="sand"
        />

        <CashFlowMetric
          label="Net Position"
          value={peso(netPosition)}
          detail="Inflow minus outflow"
          icon={<TrendingUp className="size-4" />}
          iconBg="bg-emerald-50 text-emerald-700 border-emerald-200"
          dotTone="blue"
        />

        <CashFlowMetric
          label="Open Issues"
          value={openIssuesCount.toString()}
          detail={openIssuesCount > 0 ? "Items need your attention" : "All records accounted for"}
          icon={<AlertTriangle className="size-4" />}
          iconBg={openIssuesCount > 0 ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"}
          dotTone={openIssuesCount > 0 ? "sand" : "green"}
        />
      </section>

      {/* MIDDLE ROW: Payment Method Breakdown & Included in Today's Close */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Payment Method Breakdown */}
        <CashFlowPanel
          title="Payment method breakdown"
          description="All payments received today, grouped by method."
        >
          <div className="space-y-3">
            <div className="grid grid-cols-[1.5fr_1fr_0.8fr_1.5fr] text-[10px] font-bold uppercase tracking-wider text-[var(--cs-text-muted)]">
              <span>Method</span>
              <span className="text-right">Amount</span>
              <span className="text-right">% of Total</span>
              <span className="pl-3"></span>
            </div>

            {METHODS.map((method) => {
              const amount = day.summary.by_method[method] ?? 0;
              const pct = totalInflow > 0 ? Math.round((amount / totalInflow) * 100) : 0;
              const label = PAYMENT_METHOD_LABELS[method] ?? method;
              const icon = PAYMENT_METHOD_ICONS[method] ?? <Package className="size-4" />;

              return (
                <div
                  key={method}
                  className="grid grid-cols-[1.5fr_1fr_0.8fr_1.5fr] items-center text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-[var(--cs-surface-warm)]">
                      {icon}
                    </span>
                    <span className="truncate font-medium text-[var(--cs-text)]">
                      {label}
                    </span>
                  </div>

                  <span className="text-right font-bold tabular-nums text-[var(--cs-text)]">
                    {peso(amount)}
                  </span>

                  <span className="text-right tabular-nums text-[var(--cs-text-muted)]">
                    {pct}%
                  </span>

                  <div className="pl-3">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-[#EAE4DC]">
                      <div
                        className="h-full rounded-full bg-[#1b4332] transition-all"
                        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Total Inflow Row */}
            <div className="grid grid-cols-[1.5fr_1fr_0.8fr_1.5fr] items-center border-t border-[var(--cs-border-soft)] pt-3 text-xs font-bold text-[var(--cs-text)]">
              <span>Total Inflow</span>
              <span className="text-right tabular-nums text-emerald-800">
                {peso(totalInflow)}
              </span>
              <span className="text-right tabular-nums">100%</span>
              <div className="pl-3">
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#EAE4DC]">
                  <div className="h-full w-full rounded-full bg-[#1b4332]" />
                </div>
              </div>
            </div>
          </div>
        </CashFlowPanel>

        {/* Included in Today's Close */}
        <CashFlowPanel
          title="Included in today's close"
          description={`All financial categories for ${formatDayHeaderDate(day.date)}.`}
        >
          <CashFlowCoverageTiles items={coverageItems} onSelectCategory={handleCoverageSelect} />
        </CashFlowPanel>
      </div>

      {/* BOTTOM ROW: Activity Timeline & Finalize Day Close */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Today's Activity Timeline */}
        <CashFlowPanel
          title="Today's activity timeline"
          description="Key events from today's financial activity."
        >
          {timelineEvents.length === 0 ? (
            <p className="py-8 text-center text-xs text-[var(--cs-text-muted)]">
              No financial events recorded today.
            </p>
          ) : (
            <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-[var(--cs-border-soft)]">
              {timelineEvents.slice(0, 7).map((entry) => {
                const isHomeService = entry.source === "home_service";
                const methodLabel =
                  PAYMENT_METHOD_LABELS[entry.method as keyof typeof PAYMENT_METHOD_LABELS] ??
                  entry.method;

                return (
                  <div
                    key={entry.id}
                    onClick={() => onCorrectEntry?.(entry)}
                    className={cn(
                      "relative flex items-center justify-between text-xs p-1 rounded-md transition-colors",
                      onCorrectEntry && "cursor-pointer hover:bg-[var(--cs-surface-warm)]"
                    )}
                    role={onCorrectEntry ? "button" : undefined}
                    tabIndex={onCorrectEntry ? 0 : undefined}
                    onKeyDown={(e) => {
                      if (onCorrectEntry && (e.key === "Enter" || e.key === " ")) {
                        e.preventDefault();
                        onCorrectEntry(entry);
                      }
                    }}
                  >
                    <span className="absolute -left-6 top-1.5 size-2.5 rounded-full border-2 border-white bg-[#1b4332]" />
                    <div className="flex items-center gap-3">
                      <span className="w-16 shrink-0 font-medium text-[var(--cs-text-muted)]">
                        {formatTime12h(entry.time)}
                      </span>
                      <span className="font-semibold text-[var(--cs-text)]">
                        {isHomeService ? "Home service payment received" : "Booking payment received"}
                      </span>
                    </div>
                    <span className="font-semibold tabular-nums text-[var(--cs-text-secondary)]">
                      {peso(entry.amount)} · {methodLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CashFlowPanel>

        {/* Finalize Day Close */}
        <CashFlowPanel
          title="Finalize Day Close"
          description="Review the summary and complete today's reconciliation."
        >
          <div className="space-y-4">
            {/* Status notification block */}
            <div className="flex items-start gap-3 rounded-xl border border-emerald-200/80 bg-emerald-50/60 p-4">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-white">
                <Check className="size-4 stroke-[3]" />
              </div>
              <div>
                <p className="font-bold text-emerald-950">
                  {openIssuesCount === 0 ? "Records are balanced" : "Review required"}
                </p>
                <p className="mt-0.5 text-xs text-emerald-800">
                  {openIssuesCount === 0
                    ? "All transactions are accounted for and ready to close."
                    : `${openIssuesCount} item requires attention before closing.`}
                </p>
              </div>
            </div>

            {reviewMessage ? (
              <p className="text-xs font-semibold text-emerald-800">{reviewMessage}</p>
            ) : null}

            {/* Actions Grid */}
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              {/* Mark as reviewed */}
              <button
                type="button"
                disabled={submitting || isApproved}
                onClick={handleMarkAsReviewed}
                className="flex flex-col items-start justify-between rounded-xl bg-[#1b4332] p-3 text-left text-white shadow-xs transition hover:bg-[#16382a] disabled:opacity-50"
              >
                <div className="flex w-full items-center justify-between">
                  <div className="flex size-6 items-center justify-center rounded-full bg-white/20">
                    <Check className="size-3.5 stroke-[3]" />
                  </div>
                </div>
                <div className="mt-3">
                  <p className="font-bold text-xs">Mark as reviewed</p>
                  <p className="mt-0.5 text-[10px] text-white/80">
                    Confirm that you have reviewed today&apos;s summary
                  </p>
                </div>
              </button>

              {/* Export PDF */}
              <button
                type="button"
                onClick={handleExportPdf}
                className="flex flex-col items-start justify-between rounded-xl border border-[var(--cs-border)] bg-white p-3 text-left shadow-xs transition hover:bg-[var(--cs-surface-warm)]"
              >
                <div className="flex size-6 items-center justify-center rounded-md bg-[var(--cs-surface-warm)] text-[var(--cs-text)]">
                  <FileText className="size-3.5" />
                </div>
                <div className="mt-3">
                  <p className="font-bold text-xs text-[var(--cs-text)]">Export PDF</p>
                  <p className="mt-0.5 text-[10px] text-[var(--cs-text-muted)]">
                    Download day close report
                  </p>
                </div>
              </button>

              {/* Open detailed ledger */}
              <button
                type="button"
                onClick={onOpenLedger}
                className="flex flex-col items-start justify-between rounded-xl border border-[var(--cs-border)] bg-white p-3 text-left shadow-xs transition hover:bg-[var(--cs-surface-warm)]"
              >
                <div className="flex size-6 items-center justify-center rounded-md bg-[var(--cs-surface-warm)] text-[var(--cs-text)]">
                  <BookOpen className="size-3.5" />
                </div>
                <div className="mt-3">
                  <p className="font-bold text-xs text-[var(--cs-text)]">Open detailed ledger</p>
                  <p className="mt-0.5 text-[10px] text-[var(--cs-text-muted)]">
                    View all transactions for today
                  </p>
                </div>
              </button>
            </div>
          </div>
        </CashFlowPanel>
      </div>
    </div>
  );
}