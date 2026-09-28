'use client';

import React from 'react';
import {
  Banknote,
  CreditCard,
  CalendarCheck,
  Clock,
  Calendar,
  Home,
  ShoppingCart,
  Gift,
  User,
  Users,
  Percent,
  Wallet,
  ArrowLeftRight,
  RotateCcw,
  Sliders,
  Plus,
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
}

export function TodayTab({
  kpis,
  paymentMix,
  totalInflow,
  coverage,
  recentPayments,
  onNavigateToLedger,
  onRecordPaymentClick,
}: TodayTabProps) {
  const formatPeso = (val: number) =>
    `₱${val.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-4">
      {/* ── Top Row: 4 KPI Cards ────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <CashFlowKpiCard
          icon={Banknote}
          iconBgClass="bg-emerald-50"
          iconColorClass="text-emerald-700"
          dotColorClass="bg-emerald-500"
          label="RECORDED PAYMENTS"
          value={formatPeso(kpis.recordedPayments)}
          trendText={kpis.recordedPayments > 0 ? null : null}
          description="Total cash and digital payments received"
        />

        <CashFlowKpiCard
          icon={CreditCard}
          iconBgClass="bg-amber-50"
          iconColorClass="text-amber-700"
          dotColorClass="bg-amber-500"
          label="OUTSTANDING"
          value={formatPeso(kpis.outstandingBalance)}
          trendText={kpis.outstandingBalance > 0 ? null : null}
          description="Unpaid or pending balances"
        />

        <CashFlowKpiCard
          icon={CalendarCheck}
          iconBgClass="bg-teal-50"
          iconColorClass="text-teal-700"
          dotColorClass="bg-blue-500"
          label="PAID BOOKINGS"
          value={kpis.paidBookingsCount.toString()}
          trendText={kpis.paidBookingsCount > 0 ? null : null}
          description="Bookings completed with payments"
        />

        <CashFlowKpiCard
          icon={Clock}
          iconBgClass="bg-orange-50"
          iconColorClass="text-orange-700"
          dotColorClass="bg-amber-500"
          label="NEEDS PAYMENT"
          value={kpis.needsPaymentCount.toString()}
          trendText={kpis.needsPaymentCount > 0 ? null : null}
          trendColorClass="text-amber-700"
          description="Bookings requiring payment follow-up"
        />
      </div>

      {/* ── Middle Row: Payment Mix & Cash Flow Coverage ─────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Payment Mix (5 columns) */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-[#EAE4DC] p-5 shadow-[0_1px_2px_rgba(0,0,0,0.02)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-base font-bold text-[#1E1916]">Payment mix</h2>
              <div className="flex items-center gap-1 text-xs text-[#6B5D52] bg-[#FAF8F5] border border-[#EAE4DC] rounded-md px-2 py-1">
                <span>Today</span>
                <ChevronDown className="w-3 h-3 text-[#9C8878]" />
              </div>
            </div>
            <p className="text-xs text-[#9C8878] mb-4">
              All payments received today, grouped by method.
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
            <span>Total Inflow</span>
            <div className="flex items-center gap-4">
              <span className="tabular-nums text-sm text-[#1B4D3E]">{formatPeso(totalInflow)}</span>
              <div className="w-16 h-2 bg-[#1B4D3E] rounded-full" />
            </div>
          </div>
        </div>

        {/* Right: Cash Flow Coverage (7 columns) */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-[#EAE4DC] p-5 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-base font-bold text-[#1E1916]">Cash flow coverage</h2>
            <div className="flex items-center gap-1 text-xs text-[#6B5D52] bg-[#FAF8F5] border border-[#EAE4DC] rounded-md px-2 py-1">
              <span>Today</span>
              <ChevronDown className="w-3 h-3 text-[#9C8878]" />
            </div>
          </div>
          <p className="text-xs text-[#9C8878] mb-4">
            All financial sources that feed into Cash Flow.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {coverage.map((cat) => (
              <div
                key={cat.id}
                className={`p-2.5 rounded-lg border flex items-start gap-2.5 transition-all ${
                  cat.isAvailable
                    ? 'border-[#EAE4DC] bg-[#FAF8F5] hover:border-[#D4C8BC]'
                    : 'border-[#F0ECE5] bg-[#FCFBF9] opacity-75'
                }`}
              >
                <div
                  className={`p-1.5 rounded-md flex-shrink-0 ${
                    cat.isAvailable ? 'bg-white text-[#1B4D3E] shadow-2xs' : 'bg-[#F0ECE5] text-[#9C8878]'
                  }`}
                >
                  {renderCategoryIcon(cat.iconType)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold text-[#1E1916] truncate">{cat.label}</p>
                  <p className="text-xs font-bold text-[#1E1916] tabular-nums mt-0.5">
                    {cat.isAvailable ? formatPeso(cat.amount) : 'Not available'}
                  </p>
                  <p className="text-[10px] text-[#9C8878] truncate mt-0.5">
                    {cat.countLabel}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Bottom Wide Card: Recent Payment Activity ───────────────── */}
      <div className="bg-white rounded-xl border border-[#EAE4DC] p-5 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h2 className="text-base font-bold text-[#1E1916]">Recent payment activity</h2>
            <p className="text-xs text-[#9C8878]">
              Latest booking and other financial transactions today.
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
            <p className="text-sm font-medium text-[#1E1916]">No payment activity recorded today</p>
            <p className="text-xs text-[#9C8878] mt-1 mb-4">
              Payments posted via front desk checkout will appear here in real time.
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

function renderCategoryIcon(type: CashFlowCoverageCategory['iconType']) {
  const iconProps = { className: 'w-3.5 h-3.5' };
  switch (type) {
    case 'calendar':
      return <Calendar {...iconProps} />;
    case 'home':
      return <Home {...iconProps} />;
    case 'credit_card':
      return <CreditCard {...iconProps} />;
    case 'shopping_cart':
      return <ShoppingCart {...iconProps} />;
    case 'gift':
      return <Gift {...iconProps} />;
    case 'user':
      return <User {...iconProps} />;
    case 'users':
      return <Users {...iconProps} />;
    case 'percent':
      return <Percent {...iconProps} />;
    case 'wallet':
      return <Wallet {...iconProps} />;
    case 'arrows':
      return <ArrowLeftRight {...iconProps} />;
    case 'reply':
      return <RotateCcw {...iconProps} />;
    case 'sliders':
      return <Sliders {...iconProps} />;
    case 'plus':
      return <Plus {...iconProps} />;
    default:
      return <Calendar {...iconProps} />;
  }
}
