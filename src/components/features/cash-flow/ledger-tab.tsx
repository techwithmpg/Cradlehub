'use client';

import React, { useState } from 'react';
import {
  ArrowUp,
  ArrowDown,
  Equal,
  Clock,
  Search,
  Calendar,
  Download,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { CashFlowKpiCard } from './cash-flow-kpi-card';
import type {
  LedgerKpiSummary,
  LedgerRecordItem,
} from '@/lib/cash-flow/cash-flow-types';

interface LedgerTabProps {
  kpis: LedgerKpiSummary;
  records: LedgerRecordItem[];
  totalRecords?: number;
  businessDate: string;
}

export function LedgerTab({
  kpis,
  records,
  businessDate,
}: LedgerTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [methodFilter, setMethodFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [pageSize, setPageSize] = useState(12);
  const [currentPage, setCurrentPage] = useState(1);

  const formatPeso = (val: number) =>
    `₱${val.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Filter records in memory for immediate interactive responsiveness
  const filtered = records.filter((r) => {
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const match =
        r.reference.toLowerCase().includes(q) ||
        r.customerSource.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q);
      if (!match) return false;
    }
    if (methodFilter !== 'all' && r.method.toLowerCase() !== methodFilter.toLowerCase()) {
      return false;
    }
    if (categoryFilter !== 'all' && r.category.toLowerCase() !== categoryFilter.toLowerCase()) {
      return false;
    }
    if (statusFilter !== 'all' && r.status.toLowerCase() !== statusFilter.toLowerCase()) {
      return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const displayedRecords = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <div className="space-y-4">
      {/* ── Top Row: 4 KPI Cards ────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <CashFlowKpiCard
          icon={ArrowUp}
          iconBgClass="bg-emerald-50"
          iconColorClass="text-emerald-700"
          dotColorClass="bg-emerald-500"
          label="INFLOW"
          value={formatPeso(kpis.inflow)}
          description="Total money received"
        />

        <CashFlowKpiCard
          icon={ArrowDown}
          iconBgClass="bg-rose-50"
          iconColorClass="text-rose-700"
          dotColorClass="bg-rose-500"
          label="OUTFLOW"
          value={formatPeso(kpis.outflow)}
          description="Total money paid out"
        />

        <CashFlowKpiCard
          icon={Equal}
          iconBgClass="bg-emerald-50"
          iconColorClass="text-emerald-700"
          dotColorClass="bg-emerald-500"
          label="NET FLOW"
          value={formatPeso(kpis.netFlow)}
          description="Inflow minus outflow"
        />

        <CashFlowKpiCard
          icon={Clock}
          iconBgClass="bg-amber-50"
          iconColorClass="text-amber-700"
          dotColorClass="bg-amber-500"
          label="UNRECONCILED"
          value={kpis.unreconciledText}
          description="Requires review or day close"
        />
      </div>

      {/* ── Main Panel: Ledger ──────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-[#EAE4DC] p-5 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
        {/* Title and Top Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-base font-bold text-[#1E1916]">Ledger</h2>
            <p className="text-xs text-[#9C8878]">
              Complete financial ledger of all transactions. {filtered.length} records found.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              disabled
              title="Export functionality will be enabled with Day Close reporting."
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#EAE4DC] bg-[#FAF8F5] text-xs font-semibold text-[#1E1916] rounded-lg opacity-60 cursor-not-allowed"
            >
              <Download className="w-3.5 h-3.5 text-[#6B5D52]" />
              <span>Export</span>
            </button>
            <button
              disabled
              className="p-1.5 border border-[#EAE4DC] bg-[#FAF8F5] text-[#6B5D52] rounded-lg opacity-60 cursor-not-allowed"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 mb-4 p-3 bg-[#FAF8F5] border border-[#F0ECE5] rounded-xl text-xs">
          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#9C8878] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Customer, reference, description..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-8 pr-2.5 py-1.5 bg-white border border-[#EAE4DC] rounded-lg text-xs placeholder:text-[#9C8878] focus:outline-none focus:border-[#1B4D3E]"
            />
          </div>

          {/* Date range */}
          <div className="flex items-center justify-between px-2.5 py-1.5 bg-white border border-[#EAE4DC] rounded-lg text-[#1E1916]">
            <span className="truncate">{businessDate}</span>
            <Calendar className="w-3.5 h-3.5 text-[#9C8878] ml-1 flex-shrink-0" />
          </div>

          {/* Source Filter */}
          <select
            className="px-2.5 py-1.5 bg-white border border-[#EAE4DC] rounded-lg text-[#1E1916] focus:outline-none focus:border-[#1B4D3E]"
            defaultValue="all"
          >
            <option value="all">All sources</option>
            <option value="booking_order">Booking Order</option>
            <option value="cash_session">Cash Session</option>
            <option value="retail">Retail</option>
          </select>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-2.5 py-1.5 bg-white border border-[#EAE4DC] rounded-lg text-[#1E1916] focus:outline-none focus:border-[#1B4D3E]"
          >
            <option value="all">All categories</option>
            <option value="booking">Booking</option>
            <option value="home service">Home Service</option>
            <option value="deposit">Deposit</option>
          </select>

          {/* Method Filter */}
          <select
            value={methodFilter}
            onChange={(e) => {
              setMethodFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-2.5 py-1.5 bg-white border border-[#EAE4DC] rounded-lg text-[#1E1916] focus:outline-none focus:border-[#1B4D3E]"
          >
            <option value="all">All methods</option>
            <option value="cash">Cash</option>
            <option value="gcash">GCash</option>
            <option value="maya">Maya</option>
            <option value="card">Card</option>
            <option value="bank transfer">Bank Transfer</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-2.5 py-1.5 bg-white border border-[#EAE4DC] rounded-lg text-[#1E1916] focus:outline-none focus:border-[#1B4D3E]"
          >
            <option value="all">All statuses</option>
            <option value="paid">Paid</option>
            <option value="pending">Pending</option>
            <option value="reversed">Reversed</option>
          </select>
        </div>

        {/* Ledger Table */}
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Filter className="w-8 h-8 text-[#9C8878] mx-auto mb-2 opacity-50" />
            <p className="text-sm font-semibold text-[#1E1916]">No matching ledger records</p>
            <p className="text-xs text-[#9C8878] mt-1">
              Try adjusting your search query or filters to find records.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#F0ECE5] text-[10px] font-bold text-[#9C8878] tracking-wider uppercase">
                  <th className="py-2.5 pr-3 font-semibold">DATE & TIME</th>
                  <th className="py-2.5 px-3 font-semibold">REFERENCE</th>
                  <th className="py-2.5 px-3 font-semibold">CUSTOMER / SOURCE</th>
                  <th className="py-2.5 px-3 font-semibold">CATEGORY</th>
                  <th className="py-2.5 px-3 font-semibold">METHOD</th>
                  <th className="py-2.5 px-3 text-right font-semibold">INFLOW</th>
                  <th className="py-2.5 px-3 text-right font-semibold">OUTFLOW</th>
                  <th className="py-2.5 px-3 text-right font-semibold">NET EFFECT</th>
                  <th className="py-2.5 px-3 text-center font-semibold">STATUS</th>
                  <th className="py-2.5 pl-3 text-right font-semibold">MENU</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0ECE5]">
                {displayedRecords.map((item) => (
                  <tr key={item.id} className="hover:bg-[#FAF8F5] transition-colors">
                    <td className="py-3 pr-3 text-[#6B5D52] font-medium whitespace-nowrap">
                      {item.dateTime}
                    </td>
                    <td className="py-3 px-3 font-mono font-semibold text-[#1E1916]">
                      {item.reference}
                    </td>
                    <td className="py-3 px-3 text-[#1E1916] font-medium">
                      {item.customerSource}
                    </td>
                    <td className="py-3 px-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-[#F0EDE8] text-[#3A3028]">
                        {item.category}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-[#1E1916] font-medium">
                      {item.method}
                    </td>
                    <td className="py-3 px-3 text-right font-semibold text-emerald-700 tabular-nums">
                      {item.inflow !== null ? formatPeso(item.inflow) : '—'}
                    </td>
                    <td className="py-3 px-3 text-right font-semibold text-rose-700 tabular-nums">
                      {item.outflow !== null ? `-${formatPeso(item.outflow)}` : '—'}
                    </td>
                    <td
                      className={`py-3 px-3 text-right font-bold tabular-nums ${
                        item.netEffect >= 0 ? 'text-[#1E1916]' : 'text-rose-700'
                      }`}
                    >
                      {item.netEffect < 0 ? `-${formatPeso(Math.abs(item.netEffect))}` : formatPeso(item.netEffect)}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          item.status.toLowerCase() === 'paid'
                            ? 'bg-[#EEF8F2] text-[#1A4A2A]'
                            : 'bg-[#FFFBEB] text-[#92400E]'
                        }`}
                      >
                        {item.status}
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

        {/* Pagination Footer */}
        <div className="mt-4 pt-3 border-t border-[#F0ECE5] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#6B5D52]">
          <div>
            Showing {(currentPage - 1) * pageSize + (filtered.length > 0 ? 1 : 0)}–
            {Math.min(currentPage * pageSize, filtered.length)} of {filtered.length} records
          </div>

          <div className="flex items-center gap-2">
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-2 py-1 bg-[#FAF8F5] border border-[#EAE4DC] rounded-md text-xs text-[#1E1916] focus:outline-none"
            >
              <option value={10}>10 per page</option>
              <option value={12}>12 per page</option>
              <option value={20}>20 per page</option>
              <option value={50}>50 per page</option>
            </select>

            <div className="flex items-center gap-1">
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-md border border-[#EAE4DC] hover:bg-[#FAF8F5] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setCurrentPage(p)}
                  className={`w-7 h-7 rounded-md text-xs font-semibold ${
                    currentPage === p
                      ? 'bg-[#1B4D3E] text-white'
                      : 'border border-[#EAE4DC] text-[#1E1916] hover:bg-[#FAF8F5]'
                  }`}
                >
                  {p}
                </button>
              ))}

              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded-md border border-[#EAE4DC] hover:bg-[#FAF8F5] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
