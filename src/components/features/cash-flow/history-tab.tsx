'use client';

import React, { useState } from 'react';
import {
  Calendar,
  Banknote,
  CreditCard,
  AlertTriangle,
  Search,
  ChevronDown,
  CheckCircle2,
  ArrowUp,
  ArrowDown,
  Equal,
  Users,
  User,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { CashFlowKpiCard } from './cash-flow-kpi-card';
import type { HistoryTabSummary } from '@/lib/cash-flow/cash-flow-types';

interface HistoryTabProps {
  history: HistoryTabSummary;
  businessDate: string;
}

export function HistoryTab({ history, businessDate }: HistoryTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const formatPeso = (val: number) =>
    `₱${val.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const records = history.records;
  const filtered = records.filter((r) => {
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const match =
        r.date.includes(q) ||
        r.branchName.toLowerCase().includes(q) ||
        (r.reviewedBy && r.reviewedBy.toLowerCase().includes(q));
      if (!match) return false;
    }
    if (statusFilter !== 'all' && r.status !== statusFilter) {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {/* ── Top Row: 4 KPI Cards ────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <CashFlowKpiCard
          icon={Calendar}
          iconBgClass="bg-emerald-50"
          iconColorClass="text-emerald-700"
          dotColorClass="bg-emerald-500"
          label="CLOSED DAYS THIS MONTH"
          value={history.closedDaysThisMonth.toString()}
          description="Out of 30 days"
        />

        <CashFlowKpiCard
          icon={Banknote}
          iconBgClass="bg-emerald-50"
          iconColorClass="text-emerald-700"
          dotColorClass="bg-emerald-500"
          label="TOTAL INFLOW THIS MONTH"
          value={formatPeso(history.totalInflowThisMonth)}
          description="Total cash and digital payments"
        />

        <CashFlowKpiCard
          icon={CreditCard}
          iconBgClass="bg-rose-50"
          iconColorClass="text-rose-700"
          dotColorClass="bg-amber-500"
          label="TOTAL OUTFLOW THIS MONTH"
          value={formatPeso(history.totalOutflowThisMonth)}
          description="Total operational expenses"
        />

        <CashFlowKpiCard
          icon={AlertTriangle}
          iconBgClass="bg-amber-50"
          iconColorClass="text-amber-700"
          dotColorClass="bg-amber-500"
          label="REVIEW EXCEPTIONS"
          value={history.reviewExceptions.toString()}
          description="Day closes needing attention"
        />
      </div>

      {/* ── Main Section: Historical Table (Left) + Summaries (Right) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Side: Historical day close records (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-[#EAE4DC] p-5 shadow-[0_1px_2px_rgba(0,0,0,0.02)] flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-[#1E1916]">Historical day close records</h2>
            <p className="text-xs text-[#9C8878] mb-4">
              View and search previous day close summaries and reconciliation details.
            </p>

            {/* Filter Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 mb-4 p-2.5 bg-[#FAF8F5] border border-[#F0ECE5] rounded-xl text-xs">
              <div className="flex items-center justify-between px-2.5 py-1.5 bg-white border border-[#EAE4DC] rounded-lg text-[#1E1916]">
                <span className="truncate">{businessDate}</span>
                <Calendar className="w-3.5 h-3.5 text-[#9C8878] ml-1 flex-shrink-0" />
              </div>

              <select className="px-2.5 py-1.5 bg-white border border-[#EAE4DC] rounded-lg text-[#1E1916] focus:outline-none">
                <option value="all">All branches</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-white border border-[#EAE4DC] rounded-lg text-[#1E1916] focus:outline-none"
              >
                <option value="all">All statuses</option>
                <option value="reviewed">Reviewed</option>
                <option value="closed">Closed</option>
                <option value="needs_review">Needs review</option>
                <option value="reopened">Reopened</option>
              </select>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#9C8878] absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search records..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-1.5 bg-white border border-[#EAE4DC] rounded-lg text-xs placeholder:text-[#9C8878] focus:outline-none"
                />
              </div>
            </div>

            {/* Records Table */}
            {filtered.length === 0 ? (
              <div className="py-20 text-center">
                <Calendar className="w-8 h-8 text-[#9C8878] mx-auto mb-2 opacity-50" />
                <p className="text-sm font-semibold text-[#1E1916]">No historical day close records</p>
                <p className="text-xs text-[#9C8878] mt-1">
                  Historical day close snapshots will accumulate as daily reconciliations are finalized.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#F0ECE5] text-[10px] font-bold text-[#9C8878] tracking-wider uppercase">
                      <th className="py-2.5 pr-2 font-semibold">DATE</th>
                      <th className="py-2.5 px-2 font-semibold">BRANCH</th>
                      <th className="py-2.5 px-2 font-semibold">STATUS</th>
                      <th className="py-2.5 px-2 text-right font-semibold">INFLOW</th>
                      <th className="py-2.5 px-2 text-right font-semibold">OUTFLOW</th>
                      <th className="py-2.5 px-2 text-right font-semibold">NET</th>
                      <th className="py-2.5 px-2 font-semibold">REVIEWED BY</th>
                      <th className="py-2.5 pl-2 text-right font-semibold">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0ECE5]">
                    {filtered.map((r) => (
                      <tr key={r.id} className="hover:bg-[#FAF8F5] transition-colors">
                        <td className="py-3 pr-2 font-medium text-[#1E1916] whitespace-nowrap">{r.date}</td>
                        <td className="py-3 px-2 text-[#6B5D52]">{r.branchName}</td>
                        <td className="py-3 px-2">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${getStatusBadgeClass(r.status)}`}>
                            {r.status}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-right font-medium tabular-nums text-[#1E1916]">
                          {formatPeso(r.inflow)}
                        </td>
                        <td className="py-3 px-2 text-right font-medium tabular-nums text-[#6B5D52]">
                          {formatPeso(r.outflow)}
                        </td>
                        <td className="py-3 px-2 text-right font-bold tabular-nums text-[#1E1916]">
                          {formatPeso(r.net)}
                        </td>
                        <td className="py-3 px-2 text-[#6B5D52]">{r.reviewedBy || '—'}</td>
                        <td className="py-3 pl-2 text-right">
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

          {/* Pagination */}
          <div className="mt-4 pt-3 border-t border-[#F0ECE5] flex items-center justify-between text-xs text-[#6B5D52]">
            <div>Showing 1–{filtered.length || 0} of {filtered.length} records</div>
            <div className="flex items-center gap-1">
              <button disabled className="p-1.5 rounded-md border border-[#EAE4DC] opacity-40 cursor-not-allowed">
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button className="w-7 h-7 rounded-md bg-[#1B4D3E] text-white text-xs font-semibold">1</button>
              <button disabled className="p-1.5 rounded-md border border-[#EAE4DC] opacity-40 cursor-not-allowed">
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Right Side: Selected Close Summary & Audit Trail (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Selected close summary card */}
          {history.selectedClose ? (
          <div className="bg-white rounded-xl border border-[#EAE4DC] p-5 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-base font-bold text-[#1E1916]">Selected close summary</h2>
              <div className="flex items-center gap-1 text-xs text-[#6B5D52] bg-[#FAF8F5] border border-[#EAE4DC] rounded-md px-2 py-1">
                <span>{businessDate}</span>
                <ChevronDown className="w-3 h-3 text-[#9C8878]" />
              </div>
            </div>
            <p className="text-xs text-[#9C8878] mb-3">
              Detailed summary for the selected day close record.
            </p>

            {/* Day Close Status Banner */}
            <div className="bg-[#FAFDFB] border border-[#BCE2CD] rounded-xl p-3 flex items-start gap-2.5 mb-3">
              <div className="p-1 rounded-full bg-[#1B4D3E] text-white flex-shrink-0 mt-0.5">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-[#163E32]">Day close reviewed</p>
                <p className="text-[11px] text-[#4A6B59] mt-0.5">
                  This day close has been reviewed and finalized.
                </p>
              </div>
            </div>

            {/* Inflow / Outflow / Net Grid */}
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="bg-[#FAF8F5] p-2.5 rounded-lg border border-[#F0ECE5] text-center">
                <div className="flex items-center justify-center gap-1 text-[11px] font-semibold text-emerald-700 mb-0.5">
                  <ArrowUp className="w-3 h-3" />
                  <span>Inflow</span>
                </div>
                <div className="text-xs font-bold text-[#1E1916] tabular-nums">
                  {formatPeso(history.selectedClose?.inflow || 0)}
                </div>
              </div>

              <div className="bg-[#FAF8F5] p-2.5 rounded-lg border border-[#F0ECE5] text-center">
                <div className="flex items-center justify-center gap-1 text-[11px] font-semibold text-rose-700 mb-0.5">
                  <ArrowDown className="w-3 h-3" />
                  <span>Outflow</span>
                </div>
                <div className="text-xs font-bold text-[#1E1916] tabular-nums">
                  {formatPeso(history.selectedClose?.outflow || 0)}
                </div>
              </div>

              <div className="bg-[#FAF8F5] p-2.5 rounded-lg border border-[#F0ECE5] text-center">
                <div className="flex items-center justify-center gap-1 text-[11px] font-semibold text-emerald-700 mb-0.5">
                  <Equal className="w-3 h-3" />
                  <span>Net Position</span>
                </div>
                <div className="text-xs font-bold text-[#1E1916] tabular-nums">
                  {formatPeso(history.selectedClose?.netPosition || 0)}
                </div>
              </div>
            </div>

            {/* Bookings / Customers / Reviewer Row */}
            <div className="grid grid-cols-3 gap-2 mb-3 text-xs">
              <div className="bg-[#FAF8F5] p-2 rounded-lg border border-[#F0ECE5]">
                <div className="flex items-center gap-1.5 text-[10px] text-[#9C8878] mb-0.5">
                  <Calendar className="w-3 h-3" />
                  <span>Total Bookings</span>
                </div>
                <div className="font-bold text-[#1E1916]">
                  {history.selectedClose?.totalBookings ?? 0}
                </div>
              </div>

              <div className="bg-[#FAF8F5] p-2 rounded-lg border border-[#F0ECE5]">
                <div className="flex items-center gap-1.5 text-[10px] text-[#9C8878] mb-0.5">
                  <Users className="w-3 h-3" />
                  <span>Total Customers</span>
                </div>
                <div className="font-bold text-[#1E1916]">
                  {history.selectedClose?.totalCustomers ?? 0}
                </div>
              </div>

              <div className="bg-[#FAF8F5] p-2 rounded-lg border border-[#F0ECE5]">
                <div className="flex items-center gap-1.5 text-[10px] text-[#9C8878] mb-0.5">
                  <User className="w-3 h-3" />
                  <span>Reviewed By</span>
                </div>
                <div className="font-semibold text-[#1E1916] truncate">
                  {history.selectedClose?.reviewedBy || 'Pending'}
                </div>
              </div>
            </div>

            {/* Payment method mix preview */}
            <div className="pt-2 border-t border-[#F0ECE5]">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-bold text-[#1E1916]">Payment method mix</span>
                <span className="text-[11px] font-medium text-[#1B4D3E]">View details</span>
              </div>
              <div className="text-xs text-[#9C8878] italic">
                {history.selectedClose?.paymentMix?.length
                  ? `${history.selectedClose.paymentMix.length} methods recorded`
                  : 'No payment methods recorded for this close'}
              </div>
            </div>
          </div>

          ) : (
            <div className="bg-white rounded-xl border border-[#EAE4DC] p-6 text-center shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
              <h2 className="text-base font-bold text-[#1E1916]">No day close selected</h2>
              <p className="mt-2 text-sm text-[#6B5D52]">
                No historical day close is available to review.
              </p>
            </div>
          )}

          {/* Audit & activity trail card */}
          <div className="bg-white rounded-xl border border-[#EAE4DC] p-5 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            <h2 className="text-base font-bold text-[#1E1916]">Audit & activity trail</h2>
            <p className="text-xs text-[#9C8878] mb-3">
              Recent actions and changes for this day close record.
            </p>

            {history.auditTrail.length === 0 ? (
              <div className="py-6 text-center text-xs text-[#9C8878]">
                No day-close audit activity yet.
              </div>
            ) : (
              <div className="space-y-2">
                {history.auditTrail.map((item) => (
                  <div
                    key={item.id}
                    className="p-2 rounded-lg bg-[#FAF8F5] border border-[#F0ECE5] text-xs flex items-center justify-between"
                  >
                    <div>
                      <span className="font-semibold text-[#1E1916] mr-2">{item.user}</span>
                      <span className="text-[#6B5D52]">{item.details}</span>
                    </div>
                    <span className="text-[10px] text-[#9C8878]">{item.time}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function getStatusBadgeClass(status: string) {
  switch (status.toLowerCase()) {
    case 'reviewed':
      return 'bg-[#EEF8F2] text-[#1A4A2A]';
    case 'closed':
      return 'bg-[#EEF8F6] text-[#1A5A52]';
    case 'needs_review':
      return 'bg-[#FFFBEB] text-[#92400E]';
    case 'reopened':
      return 'bg-[#FEF2F2] text-[#991B1B]';
    default:
      return 'bg-[#F0EDE8] text-[#3A3028]';
  }
}
