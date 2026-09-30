"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Banknote, ArrowLeftRight, Plus, FileText } from "lucide-react";
import type { CashFlowWorkspaceData } from "@/lib/cash-flow/cash-flow-types";
import { TodayTab } from "./today-tab";
import { LedgerTab } from "./ledger-tab";
import { DayCloseTab } from "./day-close-tab";
import { HistoryTab } from "./history-tab";
import { OpenCashDrawerModal } from "./open-cash-drawer-modal";
import { RecordFinancialEntryModal, type FinancialEntryMode } from "./record-financial-entry-modal";

export type CashFlowTab = "today" | "ledger" | "day-close" | "history";

interface CashFlowWorkspaceProps {
  initialData: CashFlowWorkspaceData;
  initialTab?: CashFlowTab;
}

export function CashFlowWorkspace({ initialData, initialTab = "today" }: CashFlowWorkspaceProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<CashFlowTab>(initialTab);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false);
  const [isOpenDrawerModalOpen, setIsOpenDrawerModalOpen] = useState(false);
  const [targetOrderId, setTargetOrderId] = useState<string | undefined>(undefined);
  const [entryModalMode, setEntryModalMode] = useState<FinancialEntryMode>("customer_payment");

  const handleTabChange = (newTab: CashFlowTab) => {
    setActiveTab(newTab);
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    router.refresh();
    setTimeout(() => {
      setIsRefreshing(false);
    }, 600);
  };

  const openRecordPayment = (orderId?: string) => {
    setEntryModalMode("customer_payment");
    setTargetOrderId(orderId);
    setIsRecordPaymentOpen(true);
  };

  const openRecordExpense = () => {
    setEntryModalMode("expense");
    setTargetOrderId(undefined);
    setIsRecordPaymentOpen(true);
  };

  const openCashOperations = () => {
    setEntryModalMode("other_entry");
    setTargetOrderId(undefined);
    setIsRecordPaymentOpen(true);
  };

  const tabs: { key: CashFlowTab; label: string }[] = [
    { key: "today", label: "Today" },
    { key: "ledger", label: "Ledger" },
    { key: "day-close", label: "Day Close" },
    { key: "history", label: "History" },
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
          {initialData.cashSessions?.activeSessions?.length ? (
            <button
              type="button"
              onClick={() => setIsOpenDrawerModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100"
              title="View cash drawer status"
            >
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span>
                {initialData.cashSessions.activeSessions.length === 1
                  ? "Drawer Open"
                  : `${initialData.cashSessions.activeSessions.length} Drawers Open`}
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsOpenDrawerModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-1.5 text-xs font-semibold text-amber-900 shadow-2xs transition hover:bg-amber-100"
            >
              <Banknote className="h-3.5 w-3.5" />
              <span>Open Cash Drawer</span>
            </button>
          )}
          <button
            type="button"
            onClick={openCashOperations}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#D8CDBF] bg-white px-3.5 py-1.5 text-xs font-semibold text-[#493F37] shadow-2xs transition hover:border-[#BFAF9E] hover:bg-[#FAF8F5]"
            title="Record cash corrections or transfers between configured financial accounts"
          >
            <ArrowLeftRight className="h-3.5 w-3.5 text-[#6B5D52]" />
            <span>Cash Operations</span>
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
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
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
                  ? "text-[#163E32] bg-[#FAF8F5] after:absolute after:bottom-0 after:left-3 after:right-3 after:h-0.5 after:bg-[#163E32]"
                  : "text-[#6B5D52] hover:text-[#1E1916] hover:bg-[#FAF8F5]"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "today" && (
        <div>
          {initialData.cashSessions?.activeSessions?.length ? (
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              {initialData.cashSessions.activeSessions.map((session) => (
                <div
                  key={session.id}
                  className="rounded-xl border border-emerald-200 bg-[#F6FBF8] px-4 py-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
                >
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                          Drawer Open
                        </span>
                      </div>

                      <p className="mt-1 truncate text-sm font-bold text-[#1E1916]">
                        {session.cashDrawerName}
                      </p>

                      <p className="mt-0.5 text-[11px] text-[#7B6D61]">
                        Opened by {session.openedByName || "Staff"} ·{" "}
                        {new Date(session.openedAt).toLocaleTimeString("en-PH", {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-x-5 gap-y-1 sm:text-right">
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-wider text-[#9C8878]">
                          Opening float
                        </p>
                        <p className="mt-0.5 text-sm font-semibold tabular-nums text-[#493F37]">
                          ₱
                          {session.openingFloat.toLocaleString("en-PH", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </p>
                      </div>

                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-wider text-[#9C8878]">
                          Expected cash
                        </p>
                        <p className="mt-0.5 text-sm font-bold tabular-nums text-emerald-800">
                          ₱
                          {session.expectedCash.toLocaleString("en-PH", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3.5 sm:flex-row sm:items-center">
              <div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
                    Drawer Closed
                  </span>
                </div>

                <p className="mt-1 text-sm font-semibold text-[#1E1916]">
                  No cash drawer session is open
                </p>

                <p className="mt-0.5 text-[11px] text-[#7B6D61]">
                  Count the physical opening float before starting cash operations.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsOpenDrawerModalOpen(true)}
                className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[#163E32] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-[#1B4D3E]"
              >
                <Banknote className="h-3.5 w-3.5" />
                Open drawer
              </button>
            </div>
          )}
        </div>
      )}
      {/* ── Active Tab Content ──────────────────────────────────────── */}
      <div>
        {activeTab === "today" && (
          <TodayTab
            kpis={initialData.today.kpis}
            paymentMix={initialData.today.paymentMix}
            totalInflow={initialData.today.totalInflow}
            coverage={initialData.today.coverage}
            recentPayments={initialData.today.recentPayments}
            onNavigateToLedger={() => handleTabChange("ledger")}
            onRecordPaymentClick={openRecordPayment}
            onRecordExpenseClick={openRecordExpense}
          />
        )}

        {activeTab === "ledger" && (
          <LedgerTab
            kpis={initialData.ledger.kpis}
            records={initialData.ledger.records}
            totalRecords={initialData.ledger.totalRecords}
            businessDate={initialData.businessDate}
          />
        )}

        {activeTab === "day-close" && (
          <DayCloseTab
            summary={initialData.dayClose}
            onNavigateToLedger={() => handleTabChange("ledger")}
          />
        )}

        {activeTab === "history" && (
          <HistoryTab history={initialData.history} businessDate={initialData.businessDate} />
        )}
      </div>

      {isOpenDrawerModalOpen && (
        <OpenCashDrawerModal
          open={isOpenDrawerModalOpen}
          onOpenChange={setIsOpenDrawerModalOpen}
          branchId={initialData.branchId}
          businessDate={initialData.businessDate}
          availableDrawers={initialData.cashSessions?.availableDrawers ?? []}
          activeSessions={initialData.cashSessions?.activeSessions ?? []}
          onSuccess={() => {
            router.refresh();
          }}
        />
      )}
      {/* ── Record Financial Entry Modal ─────────────────────────────── */}
      <RecordFinancialEntryModal
        open={isRecordPaymentOpen}
        onOpenChange={setIsRecordPaymentOpen}
        accounts={initialData.accounts}
        expenseCategories={initialData.expenseCategories}
        staffOptions={initialData.staffOptions}
        payableOrders={initialData.payableOrders}
        activeCashSessions={initialData.cashSessions?.activeSessions ?? []}
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
