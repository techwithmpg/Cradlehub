"use client";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/features/attendance/attendance-ui";
import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUSES,
} from "@/lib/validations/booking";
import { formatTime12h } from "@/lib/utils/time-format";
import {
  filterCashFlowEntries,
  EMPTY_CASH_FLOW_FILTERS,
  type CashFlowEntry,
  type CashFlowFilters,
} from "@/lib/cash-flow/read-model";
import { CashFlowPanel, CashFlowStatus, fieldClass, peso } from "./cash-flow-ui";

export function CashFlowEntries({
  entries,
  onSelect,
}: {
  entries: CashFlowEntry[];
  onSelect: (entry: CashFlowEntry) => void;
}) {
  if (!entries.length)
    return (
      <EmptyState
        title="No matching booking records"
        detail="Try another date or filter. Recorded booking payments appear here automatically."
      />
    );
  return (
    <ul className="divide-y divide-[var(--cs-border)]">
      {entries.map((entry) => (
        <li key={entry.id}>
          <button
            type="button"
            onClick={() => onSelect(entry)}
            className="flex w-full flex-wrap items-center justify-between gap-3 rounded-lg px-2 py-4 text-left hover:bg-[var(--cs-surface-warm)] focus-visible:outline-2 focus-visible:outline-[var(--cs-brand)]"
            aria-label={`View ${entry.customer}, ${entry.service}, ${entry.date}`}
          >
            <div className="min-w-0 flex-1 basis-48">
              <p className="font-semibold text-[var(--cs-text)]">{entry.customer}</p>
              <p className="break-words text-sm text-[var(--cs-text-secondary)]">{entry.service}</p>
              <p className="mt-1 text-xs text-[var(--cs-text-muted)]">
                {entry.date} · {formatTime12h(entry.time)} booking time
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <CashFlowStatus>
                {entry.source === "home_service" ? "Home Service" : "Booking"}
              </CashFlowStatus>
              <CashFlowStatus>
                {PAYMENT_METHOD_LABELS[entry.method as keyof typeof PAYMENT_METHOD_LABELS] ??
                  entry.method}
              </CashFlowStatus>
              <CashFlowStatus>{entry.paymentStatus}</CashFlowStatus>
            </div>
            <div className="min-w-28 text-right">
              <p
                className="text-lg font-bold tabular-nums"
                style={{ color: entry.amount > 0 ? "var(--cs-success)" : "var(--cs-text-muted)" }}
              >
                {entry.amount > 0 ? "+" : ""}
                {peso(entry.amount)}
              </p>
              {entry.outstanding > 0 && (
                <p className="text-xs text-[var(--cs-text-muted)]">Due {peso(entry.outstanding)}</p>
              )}
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}
export function CashFlowLedger({
  entries,
  onSelect,
  date = "",
}: {
  entries: CashFlowEntry[];
  onSelect: (entry: CashFlowEntry) => void;
  date?: string;
}) {
  const [filters, setFilters] = useState<CashFlowFilters>({ ...EMPTY_CASH_FLOW_FILTERS, date });
  const [page, setPage] = useState(0);
  function change(field: keyof CashFlowFilters, value: string) {
    setFilters((prev) => ({ ...prev, [field]: value }));
    setPage(0);
  }
  const filtered = useMemo(() => filterCashFlowEntries(entries, filters), [entries, filters]);
  const currentPage = Math.min(page, Math.max(0, Math.ceil(filtered.length / 50) - 1));
  return (
    <CashFlowPanel
      title="Booking financial ledger"
      description="Current payment balances by booking date. Audit revisions are not counted as additional receipts."
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <label className="grid gap-1 text-sm">
          Search
          <input
            className={fieldClass}
            value={filters.search}
            onChange={(e) => change("search", e.target.value)}
            placeholder="Customer, service, reference"
          />
        </label>
        <label className="grid gap-1 text-sm">
          Booking date
          <input
            type="date"
            className={fieldClass}
            value={filters.date}
            onChange={(e) => change("date", e.target.value)}
          />
        </label>
        <label className="grid gap-1 text-sm">
          Source
          <select
            className={fieldClass}
            value={filters.source}
            onChange={(e) => change("source", e.target.value)}
          >
            <option value="">All sources</option>
            <option value="booking">Booking</option>
            <option value="home_service">Home Service</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Payment method
          <select
            className={fieldClass}
            value={filters.method}
            onChange={(e) => change("method", e.target.value)}
          >
            <option value="">All methods</option>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {PAYMENT_METHOD_LABELS[m]}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Payment status
          <select
            className={fieldClass}
            value={filters.status}
            onChange={(e) => change("status", e.target.value)}
          >
            <option value="">All statuses</option>
            {PAYMENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-[var(--cs-text-muted)]" role="status">
          {filtered.length} booking records
        </p>
        <Button
          variant="ghost"
          onClick={() => {
            setFilters(EMPTY_CASH_FLOW_FILTERS);
            setPage(0);
          }}
        >
          Clear filters
        </Button>
      </div>
      <CashFlowEntries
        entries={filtered.slice(currentPage * 50, (currentPage + 1) * 50)}
        onSelect={onSelect}
      />
      {filtered.length > 50 && (
        <div className="mt-3 flex items-center justify-between">
          <Button
            variant="outline"
            disabled={currentPage === 0}
            onClick={() => setPage(currentPage - 1)}
          >
            Previous
          </Button>
          <span className="text-sm">
            Page {currentPage + 1} of {Math.ceil(filtered.length / 50)}
          </span>
          <Button
            variant="outline"
            disabled={(currentPage + 1) * 50 >= filtered.length}
            onClick={() => setPage(currentPage + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </CashFlowPanel>
  );
}
