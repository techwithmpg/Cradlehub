"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { refreshCashFlow } from "@/app/(dashboard)/crm/cash-flow/actions";
import { CrmOperationalPageShell } from "@/components/features/crm/operational/crm-operational-page-shell";
import { WorkspaceNotice } from "@/components/features/attendance/attendance-ui";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { BOOKINGS_CHANGED_EVENT } from "@/lib/bookings/bookings-client-events";
import {
  validateCashFlowRange,
  type CashFlowRange,
  type CashFlowWorkspaceData,
} from "@/lib/cash-flow/read-model";
import { CashFlowToday } from "./cash-flow-today";
import { CashFlowLedger } from "./cash-flow-ledger";
import { CashFlowDayClose, CashFlowCloseRecord } from "./cash-flow-day-close";
import { CashFlowHistory } from "./cash-flow-history";
import { CashFlowTransactionDetail } from "./cash-flow-transaction-detail";
import { CashFlowStatus, fieldClass } from "./cash-flow-ui";

export function CashFlowWorkspace({ initialData }: { initialData: CashFlowWorkspaceData }) {
  const [data, setData] = useState(initialData);
  const [tab, setTab] = useState("today");
  const [range, setRange] = useState(initialData.range);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const requestId = useRef(0);
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
    async (nextRange?: CashFlowRange) => {
      const id = ++requestId.current;
      setPending(true);
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
        if (active.current && id === requestId.current) setPending(false);
      }
    },
    [data.range]
  );
  useEffect(() => {
    const update = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener(BOOKINGS_CHANGED_EVENT, update);
    window.addEventListener("focus", update);
    return () => {
      window.removeEventListener(BOOKINGS_CHANGED_EVENT, update);
      window.removeEventListener("focus", update);
    };
  }, [refresh]);
  const entries = useMemo(() => data.days.flatMap((day) => day.entries), [data.days]);
  const selectedEntry =
    [...data.today.entries, ...entries].find((entry) => entry.id === selectedId) ?? null;
  const selectedDay = data.days.find((day) => day.date === selectedDate);
  return (
    <CrmOperationalPageShell
      title="Cash Flow"
      context={`${data.branchName} · ${data.today.date}`}
      description="Booking payments and Day Close"
      actions={
        <>
          <CashFlowStatus>{data.today.reconciliation?.status ?? "Open"}</CashFlowStatus>
          <Button variant="outline" disabled={pending} onClick={() => void refresh()}>
            {pending ? "Refreshing…" : "Refresh"}
          </Button>
          <Button disabled title="Manual entries are planned for a later authorized stage">
            + New Entry
          </Button>
        </>
      }
    >
      <p className="text-xs text-[var(--cs-text-muted)]">
        Manual entries are not available yet. Loaded{" "}
        {new Date(data.loadedAt).toLocaleString("en-PH", { timeZone: "Asia/Manila" })} (Philippine
        time).
      </p>
      {error && (
        <WorkspaceNotice tone="error" title="Refresh unavailable">
          {error}
        </WorkspaceNotice>
      )}
      <Tabs value={tab} onValueChange={(value) => setTab(String(value))} className="min-w-0 gap-5">
        <TabsList
          aria-label="Cash Flow views"
          className="grid h-auto! min-h-11 w-full grid-cols-4 sm:w-fit"
        >
          {[
            ["today", "Today"],
            ["ledger", "Ledger"],
            ["day-close", "Day Close"],
            ["history", "History"],
          ].map(([value, label]) => (
            <TabsTrigger key={value} value={value} className="min-h-11 px-3">
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
        {(tab === "ledger" || tab === "history") && (
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              try {
                validateCashFlowRange(range);
                void refresh(range);
              } catch {
                setError("Choose a valid date range of up to 31 days.");
              }
            }}
          >
            <label className="grid flex-1 gap-1 text-sm sm:flex-none">
              From
              <input
                type="date"
                required
                className={fieldClass}
                value={range.from}
                onChange={(event) => setRange((value) => ({ ...value, from: event.target.value }))}
              />
            </label>
            <label className="grid flex-1 gap-1 text-sm sm:flex-none">
              Through
              <input
                type="date"
                required
                className={fieldClass}
                value={range.to}
                onChange={(event) => setRange((value) => ({ ...value, to: event.target.value }))}
              />
            </label>
            <Button type="submit" variant="outline" disabled={pending}>
              Load dates
            </Button>
            <p className="w-full text-xs text-[var(--cs-text-muted)]">
              Loaded {data.range.from} – {data.range.to} · up to 31 days at a time.
            </p>
          </form>
        )}
        <TabsContent value="today" keepMounted hidden={tab !== "today"}>
          <CashFlowToday
            day={data.today}
            onSelect={(entry) => setSelectedId(entry.id)}
            onDayClose={() => setTab("day-close")}
          />
        </TabsContent>
        <TabsContent value="ledger" keepMounted hidden={tab !== "ledger"}>
          <CashFlowLedger entries={entries} onSelect={(entry) => setSelectedId(entry.id)} />
        </TabsContent>
        <TabsContent value="day-close" keepMounted hidden={tab !== "day-close"}>
          <CashFlowDayClose
            branchId={data.branchId}
            day={data.today}
            onSaved={() => void refresh()}
          />
        </TabsContent>
        <TabsContent value="history" keepMounted hidden={tab !== "history"}>
          {selectedDay ? (
            <div className="space-y-5">
              <Button variant="outline" onClick={() => setSelectedDate(null)}>
                Back to daily history
              </Button>
              <CashFlowCloseRecord day={selectedDay} />
              <CashFlowLedger
                key={selectedDay.date}
                entries={selectedDay.entries}
                date={selectedDay.date}
                onSelect={(entry) => setSelectedId(entry.id)}
              />
            </div>
          ) : (
            <CashFlowHistory days={data.days} onSelect={setSelectedDate} />
          )}
        </TabsContent>
      </Tabs>
      <CashFlowTransactionDetail entry={selectedEntry} onClose={() => setSelectedId(null)} />
    </CrmOperationalPageShell>
  );
}
