'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  RefreshCw,
  Download,
  FolderOpen,
  Plus,
  FileText,
} from 'lucide-react';
import type { CashFlowWorkspaceData } from '@/lib/cash-flow/cash-flow-types';
import { TodayTab } from './today-tab';
import { LedgerTab } from './ledger-tab';
import { DayCloseTab } from './day-close-tab';
import { HistoryTab } from './history-tab';
import {
  RecordFinancialEntryModal,
  type FinancialEntryMode,
} from './record-financial-entry-modal';

interface CashFlowWorkspaceProps {
  initialData: CashFlowWorkspaceData;
}

export function CashFlowWorkspace({ initialData }: CashFlowWorkspaceProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const activeTab = searchParams.get('tab') || 'today';

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false);
  const [targetOrderId, setTargetOrderId] = useState<string | undefined>(undefined);
  const [entryModalMode, setEntryModalMode] = useState<FinancialEntryMode>('customer_payment');

  const handleTabChange = (newTab: string) => {
    router.push(`/crm/cash-flow?tab=${newTab}`, { scroll: false });
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    router.refresh();
    setTimeout(() => {
      setIsRefreshing(false);
    }, 600);
  };

  const openRecordPayment = (orderId?: string) => {
    setEntryModalMode('customer_payment');
    setTargetOrderId(orderId);
    setIsRecordPaymentOpen(true);
  };

  const openRecordExpense = () => {
    setEntryModalMode('expense');
    setTargetOrderId(undefined);
    setIsRecordPaymentOpen(true);
  };

  const tabs = [
    { key: 'today', label: 'Today' },
    { key: 'ledger', label: 'Ledger' },
    { key: 'day-close', label: 'Day Close' },
    { key: 'history', label: 'History' },
  ];

  return (
    <div className="min-h-full bg-[#F5F2EE] p-4 sm:p-6 lg:p-7 space-y-5">
      {/* ── Page Header ────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="text-[11px] font-bold tracking-wider text-[#A67B5B] uppercase">
            {initialData.branchName} · {initialData.businessDate}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1E1916] mt-0.5">
            Cash Flow
          </h1>
          <p className="text-xs text-[#6B5D52] mt-0.5">
            Financial activity and daily reconciliation
          </p>
        </div>

        {/* Right-side Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            disabled
            title="Open workspace options not yet configured."
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#EAE4DC] bg-white text-xs font-semibold text-[#1E1916] rounded-lg shadow-2xs opacity-60 cursor-not-allowed"
          >
            <FolderOpen className="w-3.5 h-3.5 text-[#6B5D52]" />
            <span>Open</span>
          </button>

          <button
            disabled
            title="Export summary will be enabled with Day Close reporting."
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#EAE4DC] bg-white text-xs font-semibold text-[#1E1916] rounded-lg shadow-2xs opacity-60 cursor-not-allowed"
          >
            <Download className="w-3.5 h-3.5 text-[#6B5D52]" />
            <span>Export Summary</span>
          </button>

          <button
            onClick={() => openRecordPayment()}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 border border-[#1B4D3E] bg-[#EEF8F2] hover:bg-[#E3F2E9] text-xs font-semibold text-[#163E32] rounded-lg shadow-2xs transition"
          >
            <Plus className="w-3.5 h-3.5 text-[#163E32]" />
            <span>Record Payment</span>
          </button>

          <button
            onClick={() => openRecordExpense()}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 border border-amber-300 bg-amber-50 hover:bg-amber-100 text-xs font-semibold text-amber-900 rounded-lg shadow-2xs transition"
          >
            <FileText className="w-3.5 h-3.5 text-amber-800" />
            <span>Record Expense</span>
          </button>

          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#163E32] hover:bg-[#1B4D3E] text-white text-xs font-semibold rounded-lg shadow-2xs transition disabled:opacity-75"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ── Tab Navigation Bar ──────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-[#EAE4DC] p-1 flex gap-1 w-fit shadow-2xs">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all relative ${
                isActive
                  ? 'text-[#163E32] bg-[#FAF8F5] after:absolute after:bottom-0 after:left-3 after:right-3 after:h-0.5 after:bg-[#163E32]'
                  : 'text-[#6B5D52] hover:text-[#1E1916] hover:bg-[#FAF8F5]'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Active Tab Content ──────────────────────────────────────── */}
      <div>
        {activeTab === 'today' && (
          <TodayTab
            kpis={initialData.today.kpis}
            paymentMix={initialData.today.paymentMix}
            totalInflow={initialData.today.totalInflow}
            coverage={initialData.today.coverage}
            recentPayments={initialData.today.recentPayments}
            onNavigateToLedger={() => handleTabChange('ledger')}
            onRecordPaymentClick={openRecordPayment}
            onRecordExpenseClick={openRecordExpense}
          />
        )}

        {activeTab === 'ledger' && (
          <LedgerTab
            kpis={initialData.ledger.kpis}
            records={initialData.ledger.records}
            totalRecords={initialData.ledger.totalRecords}
            businessDate={initialData.businessDate}
          />
        )}

        {activeTab === 'day-close' && (
          <DayCloseTab
            summary={initialData.dayClose}
            onNavigateToLedger={() => handleTabChange('ledger')}
          />
        )}

        {activeTab === 'history' && (
          <HistoryTab
            history={initialData.history}
            businessDate={initialData.businessDate}
          />
        )}
      </div>

      {/* ── Record Financial Entry Modal ─────────────────────────────── */}
      <RecordFinancialEntryModal
        open={isRecordPaymentOpen}
        onOpenChange={setIsRecordPaymentOpen}
        accounts={initialData.accounts}
        expenseCategories={initialData.expenseCategories}
        staffOptions={initialData.staffOptions}
        payableOrders={initialData.payableOrders}
        initialOrderId={targetOrderId}
        initialMode={entryModalMode}
        branchId={initialData.branchId}
        businessDate={initialData.businessDate}
        onSuccess={() => {
          router.refresh();
        }}
      />
    </div>
  );
}
