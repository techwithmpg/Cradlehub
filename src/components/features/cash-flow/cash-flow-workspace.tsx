"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RotateCw, Download } from "lucide-react";
import { refreshCashFlow } from "@/app/(dashboard)/crm/cash-flow/actions";
import { CrmOperationalPageShell } from "@/components/features/crm/operational/crm-operational-page-shell";
import { WorkspaceNotice } from "@/components/features/attendance/attendance-ui";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { BOOKINGS_CHANGED_EVENT } from "@/lib/bookings/bookings-client-events";
import { cn } from "@/lib/utils";
import {
  validateCashFlowRange,
  type CashFlowEntry,
  type CashFlowRange,
  type CashFlowWorkspaceData,
} from "@/lib/cash-flow/read-model";
import { CashFlowToday } from "./cash-flow-today";
import { CashFlowLedger } from "./cash-flow-ledger";
import { CashFlowDayClose, CashFlowCloseRecord } from "./cash-flow-day-close";
import { CashFlowHistory, exportDailyHistoryToCsv } from "./cash-flow-history";
import { CashFlowTransactionDetail } from "./cash-flow-transaction-detail";
import {
  CashFlowEntryDialog,
  type CashFlowModalMode,
} from "./cash-flow-entry-dialog";
import type { CashFlowEntryType } from "./cash-flow-entry-type-selector";

export type CashFlowModalState =
  | { open: false }
  | {
      open: true;
      mode: "create";
      defaultEntryType?: CashFlowEntryType;
      relatedTransaction?: CashFlowEntry;
    }
  | {
      open: true;
      mode: "correct";
      transaction: CashFlowEntry;
    };

export function CashFlowWorkspace({ initialData }: { initialData: CashFlowWorkspaceData }) {
  const [data, setData] = useState(initialData);
  const [tab, setTab] = useState("today");
  const [range, setRange] = useState(initialData.range);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modalState, setModalState] = useState<CashFlowModalState>({ open: false });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const requestId = useRef(0);
  const visibleRequestId = useRef(0);
  const eventRefreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const active = useRef(true);

  useEffect(() => {
    const requests = requestId;
    active.current = true;
    return () => {
      active.current = false;
      requests.current++;
    };
  }, []);

  const refresh = useCallback(
    async (nextRange?: CashFlowRange, options?: { silent?: boolean }) => {
      const id = ++requestId.current;
      const silent = options?.silent ?? false;

      if (!silent) {
        visibleRequestId.current = id;
        setPending(true);
      }

      setError(null);

      try {
        const result = await refreshCashFlow(validateCashFlowRange(nextRange ?? data.range));
        if (!active.current || id !== requestId.current) return;

        setData(result);

        if (nextRange) {
          setRange(result.range);
          setSelectedDate(null);
        }
      } catch {
        if (active.current && id === requestId.current)
          setError(
            "Cash Flow could not refresh. Showing the last loaded records. Check your connection and access, then try again."
          );
      } finally {
        if (!silent && active.current && visibleRequestId.current === id) {
          setPending(false);
        }
      }
    },
    [data.range]
  );

  useEffect(() => {
    const update = () => {
      if (eventRefreshTimer.current) clearTimeout(eventRefreshTimer.current);

      eventRefreshTimer.current = setTimeout(() => {
        eventRefreshTimer.current = null;
        void refresh(undefined, { silent: true });
      }, 200);
    };

    window.addEventListener(BOOKINGS_CHANGED_EVENT, update);

    return () => {
      window.removeEventListener(BOOKINGS_CHANGED_EVENT, update);

      if (eventRefreshTimer.current) {
        clearTimeout(eventRefreshTimer.current);
        eventRefreshTimer.current = null;
      }
    };
  }, [refresh]);

  const entries = useMemo(() => data.days.flatMap((day) => day.entries), [data.days]);
  const selectedEntry =
    [...data.today.entries, ...entries].find((entry) => entry.id === selectedId) ?? null;
  const selectedDay = data.days.find((day) => day.date === selectedDate);

  const handleCreateEntry = useCallback(
    (defaultEntryType?: CashFlowEntryType, relatedTransaction?: CashFlowEntry) => {
      setModalState({
        open: true,
        mode: "create",
        defaultEntryType: defaultEntryType ?? "expense",
        relatedTransaction,
      });
    },
    []
  );

  const handleCorrectEntry = useCallback((transaction: CashFlowEntry) => {
    setModalState({
      open: true,
      mode: "correct",
      transaction,
    });
  }, []);

  const handleCloseModal = useCallback(() => {
    setModalState({ open: false });
  }, []);

  return (
    <CrmOperationalPageShell
      title="Cash Flow"
      context={`CRADLE WELLNESS LIVING MAIN SPA · ${data.today.date}`}
      description="Financial activity and daily reconciliation"
      headerClassName="border-0 bg-transparent px-0 py-0 shadow-none"
      actions={
        <div className="flex items-center gap-2">
          <span className="inline-flex h-8.5 items-center rounded-lg border border-[var(--cs-border)] bg-white px-3 text-xs font-semibold text-[var(--cs-text)] shadow-xs">
            Open
          </span>
          {tab === "day-close" && (
            <Button
              variant="outline"
              size="sm"
              className="h-8.5 rounded-lg border-[var(--cs-border)] bg-white px-3 text-xs font-semibold text-[var(--cs-text)] shadow-xs"
              onClick={() => window.print()}
            >
              <Download className="mr-1.5 size-3.5" />
              Export Summary
            </Button>
          )}
          {tab === "history" && (
            <Button
              variant="outline"
              size="sm"
              className="h-8.5 rounded-lg border-[var(--cs-border)] bg-white px-3 text-xs font-semibold text-[var(--cs-text)] shadow-xs"
              onClick={() => exportDailyHistoryToCsv(data.days)}
            >
              <Download className="mr-1.5 size-3.5" />
              Export History
            </Button>
          )}
          <Button
            className="h-8.5 rounded-lg bg-[#1b4332] px-3.5 text-xs font-semibold text-white shadow-xs transition hover:bg-[#16382a] disabled:opacity-60"
            disabled={pending}
            onClick={() => void refresh()}
          >
            <RotateCw className={cn("mr-1.5 size-3.5", pending && "animate-spin")} />
            {pending ? "Refreshing…" : "Refresh"}
          </Button>
        </div>
      }
    >
      {error && (
        <WorkspaceNotice tone="error" title="Refresh unavailable">
          {error}
        </WorkspaceNotice>
      )}

      <Tabs value={tab} onValueChange={(value) => setTab(String(value))} className="min-w-0 gap-4">
        <TabsList
          aria-label="Cash Flow views"
          className="grid h-auto! min-h-10 w-full grid-cols-4 rounded-xl border border-[var(--cs-border-soft)] bg-[#ECE7DF] p-1 shadow-xs sm:w-fit"
        >
          {[
            ["today", "Today"],
            ["ledger", "Ledger"],
            ["day-close", "Day Close"],
            ["history", "History"],
          ].map(([value, label]) => (
            <TabsTrigger
              key={value}
              value={value}
              className="min-h-8.5 rounded-lg px-4 text-xs font-bold text-[var(--cs-text-secondary)] data-active:bg-white data-active:text-[var(--cs-text)] data-active:shadow-xs transition-all"
            >
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="today" keepMounted hidden={tab !== "today"}>
          <CashFlowToday
            day={data.today}
            days={data.days}
            onSelect={(entry) => setSelectedId(entry.id)}
            onViewAll={() => setTab("ledger")}
            onNewEntry={() => handleCreateEntry()}
            onSelectCoverage={(type) => handleCreateEntry(type)}
          />
        </TabsContent>

        <TabsContent value="ledger" keepMounted hidden={tab !== "ledger"}>
          <CashFlowLedger
            entries={entries}
            range={range}
            onRangeChange={(newRange) => void refresh(newRange)}
            onSelect={(entry) => setSelectedId(entry.id)}
            onNewEntry={() => handleCreateEntry()}
            onCorrectEntry={handleCorrectEntry}
            onAddRelatedEntry={(entry) =>
              handleCreateEntry(entry.source as CashFlowEntryType, entry)
            }
          />
        </TabsContent>

        <TabsContent value="day-close" keepMounted hidden={tab !== "day-close"}>
          <CashFlowDayClose
            branchId={data.branchId}
            day={data.today}
            onSaved={() => void refresh()}
            onOpenLedger={() => setTab("ledger")}
            onNewEntry={(type) => handleCreateEntry(type)}
            onCorrectEntry={handleCorrectEntry}
          />
        </TabsContent>

        <TabsContent value="history" keepMounted hidden={tab !== "history"}>
          {selectedDate && selectedDay ? (
            <div className="space-y-5">
              <Button
                variant="outline"
                className="h-8.5 rounded-lg border-[var(--cs-border)] px-3 text-xs font-semibold"
                onClick={() => setSelectedDate(null)}
              >
                Back to daily history
              </Button>
              <CashFlowCloseRecord day={selectedDay} />
              <CashFlowLedger
                key={selectedDay.date}
                entries={selectedDay.entries}
                date={selectedDay.date}
                onSelect={(entry) => setSelectedId(entry.id)}
                onNewEntry={() => handleCreateEntry()}
                onCorrectEntry={handleCorrectEntry}
                onAddRelatedEntry={(entry) =>
                  handleCreateEntry(entry.source as CashFlowEntryType, entry)
                }
              />
            </div>
          ) : (
            <CashFlowHistory
              days={data.days}
              range={range}
              onRangeChange={(newRange) => void refresh(newRange)}
              onSelect={setSelectedDate}
              onCorrectEntry={handleCorrectEntry}
            />
          )}
        </TabsContent>
      </Tabs>

      <CashFlowTransactionDetail entry={selectedEntry} onClose={() => setSelectedId(null)} />

      {/* Singleton Centralized Cash Flow Modal Dialog */}
      <CashFlowEntryDialog
        open={modalState.open}
        onOpenChange={(open) => {
          if (!open) handleCloseModal();
        }}
        mode={modalState.open ? modalState.mode : "create"}
        defaultEntryType={
          modalState.open && modalState.mode === "create"
            ? modalState.defaultEntryType
            : "expense"
        }
        transaction={
          modalState.open && modalState.mode === "correct"
            ? modalState.transaction
            : modalState.open && modalState.mode === "create"
              ? modalState.relatedTransaction
              : null
        }
        branchName="Cradle Wellness Living Main Spa"
      />
    </CrmOperationalPageShell>
  );
}
