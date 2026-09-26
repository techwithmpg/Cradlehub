import {
  Banknote,
  Receipt,
  CalendarCheck,
  Clock,
  Calendar,
  Home,
  ChevronDown,
  MoreHorizontal,
  Package,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PAYMENT_METHOD_LABELS } from "@/lib/validations/booking";
import { formatTime12h } from "@/lib/utils/time-format";
import type { CashFlowDay, CashFlowEntry } from "@/lib/cash-flow/read-model";
import type { CashFlowEntryType } from "./cash-flow-entry-type-selector";
import {
  CashFlowMetric,
  CashFlowPanel,
  CashFlowStatus,
  CashFlowCoverageTiles,
  buildStandardCoverageItems,
  PAYMENT_METHOD_ICONS,
  peso,
} from "./cash-flow-ui";

const ALL_METHODS = [
  "cash",
  "gcash",
  "maya",
  "card",
  "pay_on_site",
  "other",
] as const;

export function CashFlowToday({
  day,
  days = [],
  onSelect,
  onViewAll,
  onNewEntry,
  onSelectCoverage,
}: {
  day: CashFlowDay;
  days?: CashFlowDay[];
  onSelect: (row: CashFlowEntry) => void;
  onViewAll: () => void;
  onNewEntry?: () => void;
  onSelectCoverage?: (type: CashFlowEntryType) => void;
}) {
  const totalCollected = day.summary.total_collected;
  const yesterday = days.find((d) => {
    const prev = new Date(day.date);
    prev.setDate(prev.getDate() - 1);
    return d.date === prev.toISOString().slice(0, 10);
  });

  // Calculate truthful comparison only if yesterday's data exists
  const collectedComparison = yesterday
    ? (() => {
        const diff = totalCollected - yesterday.summary.total_collected;
        if (yesterday.summary.total_collected === 0 && totalCollected > 0) {
          return { text: "+100% vs. yesterday", direction: "up" as const, tone: "positive" as const };
        }
        if (yesterday.summary.total_collected > 0) {
          const pct = Math.round((diff / yesterday.summary.total_collected) * 100);
          return {
            text: `${pct >= 0 ? "+" : ""}${pct}% vs. yesterday`,
            direction: pct >= 0 ? ("up" as const) : ("down" as const),
            tone: pct >= 0 ? ("positive" as const) : ("negative" as const),
          };
        }
        return null;
      })()
    : null;

  const unpaidComparison = yesterday
    ? (() => {
        const diff = day.summary.total_unpaid - yesterday.summary.total_unpaid;
        if (yesterday.summary.total_unpaid === 0 && day.summary.total_unpaid > 0) {
          return { text: "+100% vs. yesterday", direction: "up" as const, tone: "negative" as const };
        }
        if (yesterday.summary.total_unpaid > 0) {
          const pct = Math.round((diff / yesterday.summary.total_unpaid) * 100);
          return {
            text: `${pct >= 0 ? "+" : ""}${pct}% vs. yesterday`,
            direction: pct >= 0 ? ("up" as const) : ("down" as const),
            tone: pct <= 0 ? ("positive" as const) : ("negative" as const),
          };
        }
        return null;
      })()
    : null;

  const paidBookingsComparison = yesterday
    ? (() => {
        const diff = day.summary.paid_count - yesterday.summary.paid_count;
        return {
          text: `${diff >= 0 ? "+" : ""}${diff} vs. yesterday`,
          direction: diff >= 0 ? ("up" as const) : ("down" as const),
          tone: diff >= 0 ? ("positive" as const) : ("neutral" as const),
        };
      })()
    : null;

  const needsPaymentComparison = yesterday
    ? (() => {
        const diff = day.summary.unpaid_count - yesterday.summary.unpaid_count;
        return {
          text: `${diff >= 0 ? "+" : ""}${diff} vs. yesterday`,
          direction: diff >= 0 ? ("up" as const) : ("down" as const),
          tone: diff <= 0 ? ("positive" as const) : ("negative" as const),
        };
      })()
    : null;

  // Real breakdown amounts
  const bookingEntries = day.entries.filter((e) => e.source === "booking");
  const homeServiceEntries = day.entries.filter((e) => e.source === "home_service");
  const bookingCollected = bookingEntries.reduce((sum, e) => sum + e.amount, 0);
  const homeServiceCollected = homeServiceEntries.reduce((sum, e) => sum + e.amount, 0);
  const bookingPaidCount = bookingEntries.filter((e) => e.amount > 0).length;
  const homeServicePaidCount = homeServiceEntries.filter((e) => e.amount > 0).length;
  const transactionEntries = day.entries.filter((e) => e.amount > 0);

  const coverageItems = buildStandardCoverageItems(
    bookingCollected,
    bookingPaidCount,
    homeServiceCollected,
    homeServicePaidCount,
    totalCollected,
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
    if (mapped && onSelectCoverage) {
      onSelectCoverage(mapped);
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-[var(--cs-text)]">Today&apos;s Financial Activity</h2>
          <p className="text-xs text-[var(--cs-text-secondary)]">Daily cash movements and booking payment progress.</p>
        </div>
        {onNewEntry && (
          <Button
            onClick={onNewEntry}
            className="h-8.5 rounded-lg bg-[#1b4332] px-3.5 text-xs font-semibold text-white shadow-xs transition hover:bg-[#16382a]"
          >
            <Plus className="mr-1.5 size-3.5 stroke-[2.5]" />
            New Entry
          </Button>
        )}
      </div>

      {/* Top 4 KPI Cards */}
      <section
        aria-label="Today Cash Flow summary"
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        <CashFlowMetric
          label="Recorded Payments"
          value={peso(totalCollected)}
          detail="Current paid balances on today's bookings"
          icon={<Banknote className="size-4" />}
          iconBg="bg-emerald-50 text-emerald-700 border-emerald-200"
          dotTone="green"
          comparison={collectedComparison}
        />

        <CashFlowMetric
          label="Outstanding"
          value={peso(day.summary.total_unpaid)}
          detail={`${day.summary.unpaid_count} unpaid or pending bookings`}
          icon={<Receipt className="size-4" />}
          iconBg="bg-[#FBF6EE] text-[#8A6347] border-[#EAE4DC]"
          dotTone="sand"
          comparison={unpaidComparison}
        />

        <CashFlowMetric
          label="Paid Bookings"
          value={day.summary.paid_count.toLocaleString("en-PH")}
          detail={`${day.summary.paid_count} completed with payments`}
          icon={<CalendarCheck className="size-4" />}
          iconBg="bg-blue-50 text-blue-700 border-blue-200"
          dotTone="blue"
          comparison={paidBookingsComparison}
        />

        <CashFlowMetric
          label="Needs Payment"
          value={day.summary.unpaid_count.toLocaleString("en-PH")}
          detail="Bookings requiring payment follow-up"
          icon={<Clock className="size-4" />}
          iconBg="bg-[#FBF6EE] text-[#8A6347] border-[#EAE4DC]"
          dotTone="sand"
          comparison={needsPaymentComparison}
        />
      </section>

      {/* Middle Row: Payment Mix & Cash Flow Coverage */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Payment Mix */}
        <CashFlowPanel
          title="Payment mix"
          description="Current booking payment balances by method — not receipt-time cash movements."
          rightAction={
            <span className="inline-flex items-center gap-1 rounded-lg border border-[var(--cs-border)] bg-transparent px-2.5 py-1 text-xs font-medium text-[var(--cs-text-secondary)]">
              Today <ChevronDown className="size-3 text-[var(--cs-text-muted)]" />
            </span>
          }
        >
          <div className="space-y-3.5">
            {ALL_METHODS.map((method) => {
              const amount = day.summary.by_method[method] ?? 0;
              const pct = totalCollected > 0 ? Math.round((amount / totalCollected) * 100) : 0;
              const label = PAYMENT_METHOD_LABELS[method] ?? method;
              const icon = PAYMENT_METHOD_ICONS[method] ?? <Package className="size-4" />;

              return (
                <div key={method} className="flex items-center gap-3 text-xs">
                  <div className="flex w-28 shrink-0 items-center gap-2">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-[var(--cs-surface-warm)]">
                      {icon}
                    </span>
                    <span className="truncate font-medium text-[var(--cs-text)]">
                      {label}
                    </span>
                  </div>

                  <span className="w-24 shrink-0 text-right font-bold tabular-nums text-[var(--cs-text)]">
                    {peso(amount)}
                  </span>

                  <span className="w-10 shrink-0 text-right tabular-nums text-[var(--cs-text-muted)]">
                    {pct}%
                  </span>

                  <div className="h-2 min-w-16 flex-1 overflow-hidden rounded-full bg-[#EAE4DC]">
                    <div
                      className="h-full rounded-full bg-[#1b4332] transition-all"
                      style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CashFlowPanel>

        {/* Cash Flow Coverage */}
        <CashFlowPanel
          title="Cash flow coverage"
          description="All financial sources that feed into Cash Flow."
          rightAction={
            <span className="inline-flex items-center gap-1 rounded-lg border border-[var(--cs-border)] bg-transparent px-2.5 py-1 text-xs font-medium text-[var(--cs-text-secondary)]">
              Today <ChevronDown className="size-3 text-[var(--cs-text-muted)]" />
            </span>
          }
        >
          <CashFlowCoverageTiles items={coverageItems} onSelectCategory={handleCoverageSelect} />
        </CashFlowPanel>
      </div>

      {/* Recent Payment Activity */}
      <CashFlowPanel
        title="Recent payment activity"
        description="Latest booking and other financial transactions today."
        rightAction={
          <Button
            variant="outline"
            size="sm"
            className="h-8 rounded-lg border-[var(--cs-border)] px-3 text-xs font-semibold"
            onClick={onViewAll}
          >
            View all
          </Button>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[var(--cs-border-soft)] text-[10px] font-bold uppercase tracking-wider text-[var(--cs-text-muted)]">
                <th className="py-2.5 pr-3">Time</th>
                <th className="px-3 py-2.5">Type</th>
                <th className="px-3 py-2.5">Customer / Reference</th>
                <th className="px-3 py-2.5">Service / Description</th>
                <th className="px-3 py-2.5">Payment Method</th>
                <th className="px-3 py-2.5 text-right">Amount</th>
                <th className="px-3 py-2.5 text-center">Status</th>
                <th className="py-2.5 pl-3 text-right">···</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--cs-border-soft)]">
              {day.entries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-xs text-[var(--cs-text-muted)]">
                    No transactions recorded for today yet.
                  </td>
                </tr>
              ) : (
                day.entries.slice(0, 8).map((entry) => {
                  const isPaid = entry.paymentStatus === "paid";
                  const isHomeService = entry.source === "home_service";
                  const methodIcon =
                    PAYMENT_METHOD_ICONS[entry.method] ?? <Package className="size-3.5" />;
                  const methodLabel =
                    PAYMENT_METHOD_LABELS[entry.method as keyof typeof PAYMENT_METHOD_LABELS] ??
                    entry.method;

                  return (
                    <tr
                      key={entry.id}
                      onClick={() => onSelect(entry)}
                      className="cursor-pointer transition-colors hover:bg-[var(--cs-surface-warm)]/70"
                    >
                      <td className="whitespace-nowrap py-3 pr-3 font-medium text-[var(--cs-text-secondary)]">
                        {formatTime12h(entry.time)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3">
                        <span className="inline-flex items-center gap-1.5 font-medium text-[var(--cs-text)]">
                          {isHomeService ? (
                            <Home className="size-3.5 text-amber-700" />
                          ) : (
                            <Calendar className="size-3.5 text-emerald-700" />
                          )}
                          {isHomeService ? "Home Service" : "Booking"}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-semibold text-[var(--cs-text)]">
                          {entry.customer}
                        </div>
                        <div className="font-mono text-[11px] text-[var(--cs-text-muted)]">
                          {entry.reference ? `#${entry.reference}` : `#BK-${entry.id.slice(0, 8)}`}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-[var(--cs-text-secondary)]">
                        <div className="font-medium">{entry.service}</div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3">
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-[var(--cs-surface-warm)] px-2 py-1 font-medium text-[var(--cs-text)]">
                          {methodIcon}
                          {methodLabel}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right font-bold tabular-nums text-[var(--cs-text)]">
                        <button
                          type="button"
                          onClick={() => onSelect(entry)}
                          className="w-full text-right"
                          aria-label={`View ${entry.customer}, ${entry.service}, ${entry.date}`}
                        >
                          {entry.paymentStatus === "refunded" ? (
                            <div>
                              <span className="text-[var(--cs-text-secondary)]">
                                {peso(entry.amount)}
                              </span>
                              <p className="text-[10px] font-semibold text-[var(--cs-text-muted)]">
                                Refunded snapshot
                              </p>
                            </div>
                          ) : entry.amount > 0 ? (
                            <span className="text-emerald-800">+{peso(entry.amount)}</span>
                          ) : (
                            <span className="text-[var(--cs-text-muted)]">
                              {peso(entry.amount)}
                            </span>
                          )}
                        </button>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-center">
                        <CashFlowStatus tone={isPaid ? "paid" : entry.paymentStatus}>
                          {entry.paymentStatus}
                        </CashFlowStatus>
                      </td>
                      <td className="py-3 pl-3 text-right text-[var(--cs-text-muted)]">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-[var(--cs-text-muted)] hover:text-[var(--cs-text)]"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelect(entry);
                          }}
                          aria-label="View transaction details"
                        >
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </CashFlowPanel>
    </div>
  );
}