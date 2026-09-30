'use client';

import React from 'react';
import {
  Banknote,
  CreditCard,
  CalendarCheck,
  Clock,
  MoreHorizontal,
  ChevronDown,
} from 'lucide-react';
import { CashFlowKpiCard } from './cash-flow-kpi-card';
import type {
  TodayKpiSummary,
  PaymentMixItem,
  CashFlowCoverageCategory,
  RecentPaymentItem,
} from '@/lib/cash-flow/cash-flow-types';

interface TodayTabProps {
  kpis: TodayKpiSummary;
  paymentMix: PaymentMixItem[];
  totalInflow: number;
  coverage: CashFlowCoverageCategory[];
  recentPayments: RecentPaymentItem[];
  onNavigateToLedger: () => void;
  onRecordPaymentClick: (orderId?: string) => void;
  onRecordExpenseClick?: () => void;
}

export function TodayTab({
  kpis,
  paymentMix,
  totalInflow,
  coverage,
  recentPayments,
  onNavigateToLedger,
  onRecordPaymentClick,
  onRecordExpenseClick,
}: TodayTabProps) {
  const formatPeso = (val: number) =>
    `₱${val.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const expenseCoverage = coverage.find((item) => item.id === 'expenses');
  const expenseOutflow = expenseCoverage?.isAvailable ? expenseCoverage.amount : 0;
  const netOperationalFlow = totalInflow - expenseOutflow;
  const unreconciledBookingCount = kpis.unreconciledBookingCount || 0;
  const attentionCount = kpis.needsPaymentCount + unreconciledBookingCount;

  return (
    <div className="space-y-4">
      {/* ── Top Row: 4 KPI Cards ────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 xl:gap-4">
        <CashFlowKpiCard
          icon={Banknote}
          iconBgClass="bg-emerald-50"
          iconColorClass="text-emerald-700"
          dotColorClass="bg-emerald-500"
          label="RECEIPTS"
          value={formatPeso(totalInflow)}
          description="Money received across recorded financial accounts"
        />

        <CashFlowKpiCard
          icon={CreditCard}
          iconBgClass="bg-amber-50"
          iconColorClass="text-amber-700"
          dotColorClass="bg-amber-500"
          label="EXPENSES"
          value={formatPeso(expenseOutflow)}
          description="Operational expenses recorded today"
        />

        <CashFlowKpiCard
          icon={CalendarCheck}
          iconBgClass="bg-teal-50"
          iconColorClass="text-teal-700"
          dotColorClass="bg-blue-500"
          label="NET FLOW"
          value={formatPeso(netOperationalFlow)}
          description="Recorded receipts minus operational expenses"
        />

        <CashFlowKpiCard
          icon={Clock}
          iconBgClass="bg-orange-50"
          iconColorClass="text-orange-700"
          dotColorClass="bg-amber-500"
          label="NEEDS ATTENTION"
          value={attentionCount.toString()}
          trendColorClass="text-amber-700"
          description={
            kpis.needsPaymentCount > 0
              ? `${formatPeso(kpis.outstandingBalance)} awaiting payment`
              : unreconciledBookingCount > 0
                ? `${unreconciledBookingCount} payment snapshot${unreconciledBookingCount === 1 ? '' : 's'} need review`
                : 'No payment follow-up required'
          }
        />
      </div>

      {/* ── Middle Row: Payment Mix & Cash Flow Coverage ─────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Payment Mix (5 columns) */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-[#EAE4DC] p-4 sm:p-5 shadow-[0_1px_2px_rgba(0,0,0,0.02)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-base font-bold text-[#1E1916]">Money received</h2>
              <div className="flex items-center gap-1 text-xs text-[#6B5D52] bg-[#FAF8F5] border border-[#EAE4DC] rounded-md px-2 py-1">
                <span>Today</span>
                <ChevronDown className="w-3 h-3 text-[#9C8878]" />
              </div>
            </div>
            <p className="text-xs text-[#9C8878] mb-4">
              Where today&apos;s recorded receipts were received.
            </p>

            {/* Table Header */}
            <div className="grid grid-cols-12 text-[10px] font-bold text-[#9C8878] tracking-wider uppercase pb-2 border-b border-[#F0ECE5]">
              <div className="col-span-4">METHOD</div>
              <div className="col-span-4 text-right">AMOUNT</div>
              <div className="col-span-4 text-right">% OF TOTAL</div>
            </div>

            {/* Rows */}
            <div className="divide-y divide-[#F0ECE5]">
              {paymentMix.map((item) => (
                <div key={item.method} className="py-2.5 grid grid-cols-12 items-center text-xs">
                  <div className="col-span-4 flex items-center gap-2">
                    {renderMethodIcon(item.method)}
                    <span className="font-medium text-[#1E1916]">{item.label}</span>
                  </div>
                  <div className="col-span-4 text-right font-medium tabular-nums text-[#1E1916]">
                    {formatPeso(item.amount)}
                  </div>
                  <div className="col-span-4 flex items-center justify-end gap-2">
                    <span className="text-[11px] text-[#6B5D52] tabular-nums w-8 text-right">
                      {item.percentage}%
                    </span>
                    <div className="w-16 h-2 bg-[#EAE4DC] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#1B4D3E] rounded-full"
                        style={{ width: `${Math.min(100, item.percentage)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer: Total Inflow */}
          <div className="pt-3 mt-4 border-t border-[#EAE4DC] flex items-center justify-between text-xs font-bold text-[#1E1916]">
            <span>Total received</span>
            <div className="flex items-center gap-4">
              <span className="tabular-nums text-sm text-[#1B4D3E]">{formatPeso(totalInflow)}</span>
              <div className="w-16 h-2 bg-[#1B4D3E] rounded-full" />
            </div>
          </div>
        </div>

        {/* Right: Front-desk attention and quick actions */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-[#EAE4DC] p-4 sm:p-5 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-[#1E1916]">
                Needs your attention
              </h2>
              <p className="text-xs text-[#9C8878] mt-0.5">
                Only financial items requiring front-desk action appear here.
              </p>
            </div>

            <span
              className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                attentionCount > 0
                  ? 'border-amber-200 bg-amber-50 text-amber-800'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-800'
              }`}
            >
              {attentionCount > 0
                ? `${attentionCount} open`
                : 'All clear'}
            </span>
          </div>

          <div className="mt-4 space-y-2.5">
            {kpis.needsPaymentCount > 0 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 sm:p-4">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div>
                    <p className="text-sm font-semibold text-[#1E1916]">
                      Payment follow-up
                    </p>

                    <p className="text-xs text-[#6B5D52] mt-1">
                      {kpis.needsPaymentCount}{' '}
                      {kpis.needsPaymentCount === 1
                        ? 'booking requires'
                        : 'bookings require'}{' '}
                      payment · {formatPeso(kpis.outstandingBalance)} outstanding
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => onRecordPaymentClick()}
                    className="inline-flex shrink-0 items-center justify-center rounded-lg bg-[#163E32] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-[#1B4D3E]"
                  >
                    Record payment
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-[#D8E8DF] bg-[#F7FBF8] p-3.5 sm:p-4">
                <div className="flex items-start gap-3">
                  <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />

                  <div>
                    <p className="text-sm font-semibold text-[#1E1916]">
                      No payment follow-up required
                    </p>

                    <p className="text-xs text-[#6B5D52] mt-1">
                      There are no additional unpaid bookings requiring payment follow-up.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {unreconciledBookingCount > 0 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 sm:p-4">
                <p className="text-sm font-semibold text-[#1E1916]">Booking payment reconciliation</p>
                <p className="mt-1 text-xs text-[#6B5D52]">
                  {unreconciledBookingCount} booking payment snapshot{unreconciledBookingCount === 1 ? '' : 's'}{' '}
                  cannot be safely matched to booking-level financial evidence. Review the flagged Ledger rows; snapshot amounts are excluded from receipts.
                </p>
                <button type="button" onClick={onNavigateToLedger} className="mt-2 text-xs font-semibold text-[#163E32] underline">
                  View Ledger
                </button>
              </div>
            ) : (
              <div className="rounded-xl border border-[#D8E8DF] bg-[#F7FBF8] p-3.5 sm:p-4">
                <div className="flex items-start gap-3">
                  <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />

                  <div>
                    <p className="text-sm font-semibold text-[#1E1916]">
                      No other financial issues
                    </p>

                    <p className="text-xs text-[#6B5D52] mt-1">
                      Expense, transfer and reconciliation alerts will appear here
                      when their CF8 contracts are activated.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 border-t border-[#F0ECE5] pt-4">
            <div>
              <h3 className="text-sm font-bold text-[#1E1916]">
                Quick actions
              </h3>

              <p className="text-xs text-[#9C8878] mt-0.5">
                Common financial tasks for the front desk.
              </p>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => onRecordPaymentClick()}
                className="rounded-xl border border-[#BFDCCE] bg-[#F1F9F4] p-3 text-left transition hover:border-[#8FC5A8] hover:bg-[#EAF6EE]"
              >
                <div className="mb-2.5 flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                  <span className="text-base">₱</span>
                </div>

                <span className="block text-xs font-semibold text-[#163E32]">
                  Record payment
                </span>

                <span className="mt-1 block text-[10px] leading-4 text-[#6B5D52]">
                  Customer or booking payment
                </span>
              </button>

              <button
                type="button"
                onClick={() => onRecordExpenseClick?.()}
                disabled={!onRecordExpenseClick}
                className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-left transition hover:border-amber-300 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <div className="mb-2.5 flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                  <span className="text-sm font-bold">−</span>
                </div>

                <span className="block text-xs font-semibold text-amber-900">
                  Record expense
                </span>

                <span className="mt-1 block text-[10px] leading-4 text-[#6B5D52]">
                  Fuel, laundry, supplies and more
                </span>
              </button>

              <button
                type="button"
                onClick={onNavigateToLedger}
                className="rounded-xl border border-[#DED7CF] bg-[#FAF8F5] p-3 text-left transition hover:border-[#C8BBB0] hover:bg-white"
              >
                <div className="mb-2.5 flex h-8 w-8 items-center justify-center rounded-lg bg-[#EEE9E3] text-[#6B5D52]">
                  <span className="text-sm">≡</span>
                </div>

                <span className="block text-xs font-semibold text-[#1E1916]">
                  View ledger
                </span>

                <span className="mt-1 block text-[10px] leading-4 text-[#6B5D52]">
                  Review all money movements
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
      {/* ── Bottom Wide Card: Today's Money Movements ───────────────── */}
      <div className="bg-white rounded-xl border border-[#EAE4DC] p-4 sm:p-5 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h2 className="text-base font-bold text-[#1E1916]">Today&apos;s money movements</h2>
            <p className="text-xs text-[#9C8878]">
              Latest recorded money activity across bookings and operations.
            </p>
          </div>
          <button
            onClick={onNavigateToLedger}
            className="text-xs font-semibold text-[#1B4D3E] hover:text-[#163E32] bg-[#EEF8F2] hover:bg-[#E3F2E9] px-3 py-1.5 rounded-md transition-colors"
          >
            View all
          </button>
        </div>

        {recentPayments.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm font-medium text-[#1E1916]">No financial activity recorded today</p>
            <p className="text-xs text-[#9C8878] mt-1 mb-4">
              Payments and operational entries will appear here as they are recorded.
            </p>
            <button
              onClick={() => onRecordPaymentClick()}
              className="text-xs font-semibold bg-[#1B4D3E] text-white px-4 py-2 rounded-lg hover:bg-[#163E32] transition"
            >
              Record Payment
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto mt-3">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#F0ECE5] text-[10px] font-bold text-[#9C8878] tracking-wider uppercase">
                  <th className="py-2.5 pr-3 font-semibold">TIME</th>
                  <th className="py-2.5 px-3 font-semibold">TYPE</th>
                  <th className="py-2.5 px-3 font-semibold">CUSTOMER / REFERENCE</th>
                  <th className="py-2.5 px-3 font-semibold">SERVICE / DESCRIPTION</th>
                  <th className="py-2.5 px-3 font-semibold">PAYMENT METHOD</th>
                  <th className="py-2.5 px-3 text-right font-semibold">AMOUNT</th>
                  <th className="py-2.5 px-3 text-center font-semibold">STATUS</th>
                  <th className="py-2.5 pl-3 text-right font-semibold">MENU</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0ECE5]">
                {recentPayments.map((item) => (
                  <tr key={item.id} className="hover:bg-[#FAF8F5] transition-colors">
                    <td className="py-3 pr-3 text-[#6B5D52] font-medium whitespace-nowrap">
                      {item.time}
                    </td>
                    <td className="py-3 px-3">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-[#F0EDE8] text-[#3A3028]">
                        {item.type}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-semibold text-[#1E1916]">{item.customerName}</div>
                      <div className="text-[10px] text-[#9C8878] font-mono">{item.reference}</div>
                    </td>
                    <td className="py-3 px-3 text-[#6B5D52]">
                      <div className="truncate max-w-[200px]">{item.serviceDescription}</div>
                      {item.durationMinutes && (
                        <div className="text-[10px] text-[#9C8878]">{item.durationMinutes} min</div>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                        {item.paymentMethodDisplay}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-[#1E1916] tabular-nums">
                      {formatPeso(item.amount)}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          item.status === 'paid'
                            ? 'bg-[#EEF8F2] text-[#1A4A2A]'
                            : 'bg-[#FFFBEB] text-[#92400E]'
                        }`}
                      >
                        {item.status === 'paid' ? 'Paid' : 'Pending'}
                      </span>
                    </td>
                    <td className="py-3 pl-3 text-right">
                      <button className="p-1 rounded hover:bg-[#EAE4DC] text-[#9C8878] hover:text-[#1E1916]">
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function renderMethodIcon(method: string) {
  switch (method) {
    case 'cash':
      return <Banknote className="w-3.5 h-3.5 text-emerald-600" />;
    case 'gcash':
      return <div className="w-3.5 h-3.5 rounded bg-blue-600 text-white font-bold text-[9px] flex items-center justify-center">G</div>;
    case 'maya':
      return <div className="w-3.5 h-3.5 rounded bg-teal-600 text-white font-bold text-[9px] flex items-center justify-center">M</div>;
    case 'card':
      return <CreditCard className="w-3.5 h-3.5 text-blue-500" />;
    default:
      return <CreditCard className="w-3.5 h-3.5 text-gray-500" />;
  }
}
