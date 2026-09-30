'use client';

import React from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  Banknote,
  CreditCard,
  TrendingUp,
  AlertTriangle,
  ChevronDown,
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
  FileText,
  BookOpen,
} from 'lucide-react';
import { CashFlowKpiCard } from './cash-flow-kpi-card';
import type {
  DayCloseSummaryData,
  CashFlowCoverageCategory,
} from '@/lib/cash-flow/cash-flow-types';

interface DayCloseTabProps {
  summary: DayCloseSummaryData;
  onNavigateToLedger: () => void;
}

export function DayCloseTab({ summary, onNavigateToLedger }: DayCloseTabProps) {
  const formatPeso = (val: number) =>
    `₱${val.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const statusLabel = summary.reconciliationStatus === 'not_started'
    ? 'No reconciliation recorded'
    : `Reconciliation ${summary.reconciliationStatus}`;

  return (
    <div className="space-y-4">
      {/* ── Auto-generated Day Summary Banner ────────────────────────── */}
      <div className="bg-[#FAFDFB] border border-[#CDE5D8] rounded-xl p-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)] flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full bg-[#1B4D3E] text-white flex-shrink-0 mt-0.5">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-[#1E1916]">
                Auto-generated Day Summary · {summary.businessDate}
              </h2>
            </div>
            <p className="text-xs text-[#6B5D52] mt-0.5">
              Daily financial activity has been compiled from all bookings, payments, expenses and operational records.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center md:items-end gap-1.5 md:text-right">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#E8F5EE] text-[#163E32] border border-[#BCE2CD] w-fit">
            <span className="w-1.5 h-1.5 rounded-full bg-[#1B4D3E]" />
            {statusLabel}
          </span>
          <span className="text-[11px] text-[#9C8878]">
            {summary.reconciliationStatus === 'not_started' ? 'No saved update' : `Last updated ${summary.lastUpdatedText}`}
          </span>
        </div>
      </div>

      {/* ── Top Row: 4 KPI Cards ────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <CashFlowKpiCard
          icon={Banknote}
          iconBgClass="bg-emerald-50"
          iconColorClass="text-emerald-700"
          dotColorClass="bg-emerald-500"
          label="RECORDED INFLOW"
          value={formatPeso(summary.recordedInflow)}
          description="Posted financial movement inflow"
        />

        <CashFlowKpiCard
          icon={CreditCard}
          iconBgClass="bg-rose-50"
          iconColorClass="text-rose-700"
          dotColorClass="bg-amber-500"
          label="RECORDED OUTFLOW"
          value={formatPeso(summary.recordedOutflow)}
          description="Posted financial movement outflow"
        />

        <CashFlowKpiCard
          icon={TrendingUp}
          iconBgClass="bg-teal-50"
          iconColorClass="text-teal-700"
          dotColorClass="bg-blue-500"
          label="NET POSITION"
          value={formatPeso(summary.netPosition)}
          description="Inflow minus outflow"
        />

        <CashFlowKpiCard
          icon={AlertTriangle}
          iconBgClass="bg-amber-50"
          iconColorClass="text-amber-700"
          dotColorClass="bg-amber-500"
          label="OPEN ISSUES"
          value={summary.openIssuesCount.toString()}
          trendColorClass="text-amber-700"
          description={
            summary.openIssuesCount > 0
              ? 'Bookings requiring payment follow-up'
              : 'All daily records accounted for'
          }
        />
      </div>

      {/* ── Middle Row: Payment Method Breakdown & Categories Included ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Payment Method Breakdown (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-[#EAE4DC] p-5 shadow-[0_1px_2px_rgba(0,0,0,0.02)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-base font-bold text-[#1E1916]">Payment method breakdown</h2>
              <div className="flex items-center gap-1 text-xs text-[#6B5D52] bg-[#FAF8F5] border border-[#EAE4DC] rounded-md px-2 py-1">
                <span>Today</span>
                <ChevronDown className="w-3 h-3 text-[#9C8878]" />
              </div>
            </div>
            <p className="text-xs text-[#9C8878] mb-4">
              All payments received today, grouped by method.
            </p>

            <div className="grid grid-cols-12 text-[10px] font-bold text-[#9C8878] tracking-wider uppercase pb-2 border-b border-[#F0ECE5]">
              <div className="col-span-4">METHOD</div>
              <div className="col-span-4 text-right">AMOUNT</div>
              <div className="col-span-4 text-right">% OF TOTAL</div>
            </div>

            <div className="divide-y divide-[#F0ECE5]">
              {summary.paymentBreakdown.map((item) => (
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

          <div className="pt-3 mt-4 border-t border-[#EAE4DC] flex items-center justify-between text-xs font-bold text-[#1E1916]">
            <span>Total Inflow</span>
            <div className="flex items-center gap-4">
              <span className="tabular-nums text-sm text-[#1B4D3E]">
                {formatPeso(summary.recordedInflow)}
              </span>
              <div className="w-16 h-2 bg-[#1B4D3E] rounded-full" />
            </div>
          </div>
        </div>

        {/* Right: Included in Today's Close (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-[#EAE4DC] p-5 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-base font-bold text-[#1E1916]">Included in today&apos;s close</h2>
            <div className="flex items-center gap-1 text-xs text-[#6B5D52] bg-[#FAF8F5] border border-[#EAE4DC] rounded-md px-2 py-1">
              <span>Today</span>
              <ChevronDown className="w-3 h-3 text-[#9C8878]" />
            </div>
          </div>
          <p className="text-xs text-[#9C8878] mb-4">
            All financial categories for {summary.businessDate}.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {summary.coverageCategories.map((cat) => (
              <div
                key={cat.id}
                className={`p-2.5 rounded-lg border flex items-start gap-2.5 transition-all ${
                  cat.isAvailable
                    ? 'border-[#EAE4DC] bg-[#FAF8F5]'
                    : 'border-[#F0ECE5] bg-[#FCFBF9] opacity-75'
                }`}
              >
                <div
                  className={`p-1.5 rounded-md flex-shrink-0 ${
                    cat.isAvailable ? 'bg-white text-[#1B4D3E]' : 'bg-[#F0ECE5] text-[#9C8878]'
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

      {/* ── Bottom Row: Activity Timeline & Finalize Day Close ───────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Bottom Left: Activity Timeline (6 cols) */}
        <div className="lg:col-span-6 bg-white rounded-xl border border-[#EAE4DC] p-5 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          <h2 className="text-base font-bold text-[#1E1916]">Today&apos;s activity timeline</h2>
          <p className="text-xs text-[#9C8878] mb-4">
            Key events from today&apos;s financial activity.
          </p>

          {summary.timeline.length === 0 ? (
            <div className="py-10 text-center text-xs text-[#9C8878]">
              No financial activity timeline events recorded yet today.
            </div>
          ) : (
            <div className="space-y-3 relative before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#F0ECE5]">
              {summary.timeline.map((event) => (
                <div key={event.id} className="flex items-start gap-3 pl-6 relative">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#1B4D3E] absolute left-1 top-1 -translate-x-1/2 ring-4 ring-white" />
                  <div className="flex-1 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-semibold text-[#6B5D52] mr-2">{event.time}</span>
                      <span className="text-[#1E1916]">{event.title}</span>
                    </div>
                    <div className="text-right text-[#6B5D52] font-medium tabular-nums">
                      <span>{formatPeso(event.amount)}</span>
                      <span className="text-[#9C8878] ml-1.5">· {event.paymentMethod}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bottom Right: Finalize Day Close (6 cols) */}
        <div className="lg:col-span-6 bg-white rounded-xl border border-[#EAE4DC] p-5 shadow-[0_1px_2px_rgba(0,0,0,0.02)] flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-[#1E1916]">Daily reconciliation</h2>
            <p className="text-xs text-[#9C8878] mb-4">
              Expected and actual amounts come from the saved reconciliation record.
            </p>

            <div className={`rounded-xl border p-4 mb-4 ${summary.isBalanced ? 'bg-[#FAFDFB] border-[#BCE2CD]' : 'bg-amber-50 border-amber-200'}`}>
              <div>
                <p className="text-xs font-bold text-[#163E32]">
                  {summary.isBalanced ? 'Saved reconciliation totals match' : statusLabel}
                </p>
                <p className="text-[11px] text-[#4A6B59] mt-1">
                  {summary.cashVariance === null
                    ? 'Enter and save the actual count in End-of-Day Reconciliation.'
                    : `Cash expected ${formatPeso(summary.expectedCash ?? 0)} · actual ${formatPeso(summary.actualCash ?? 0)} · variance ${formatPeso(summary.cashVariance)}`}
                </p>
                <p className="text-[11px] text-[#4A6B59] mt-1">
                  {summary.channelVariance === null
                    ? 'No channel variance is available yet.'
                    : `Total absolute channel variance: ${formatPeso(summary.channelVariance)}.`}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2 mt-4">
            <Link
              href="/crm/reconciliation"
              className="w-full py-2.5 px-4 bg-[#1B4D3E] text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 hover:bg-[#163E32]"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Open End-of-Day Reconciliation</span>
            </Link>

            <div className="grid grid-cols-2 gap-2">
              <button
                disabled
                className="py-2 px-3 border border-[#EAE4DC] bg-[#FAF8F5] text-xs font-semibold text-[#6B5D52] rounded-lg flex items-center justify-center gap-1.5 opacity-70 cursor-not-allowed"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Export PDF</span>
              </button>

              <button
                onClick={onNavigateToLedger}
                className="py-2 px-3 border border-[#EAE4DC] hover:border-[#1B4D3E] bg-[#FAF8F5] hover:bg-white text-xs font-semibold text-[#1E1916] rounded-lg flex items-center justify-center gap-1.5 transition"
              >
                <BookOpen className="w-3.5 h-3.5 text-[#1B4D3E]" />
                <span>Open detailed ledger</span>
              </button>
            </div>
          </div>
        </div>
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
