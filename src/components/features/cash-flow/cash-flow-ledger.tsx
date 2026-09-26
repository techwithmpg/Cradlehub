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
import {
  CashFlowPanel,
  CashFlowStatus,
  fieldClass,
  peso,
} from "./cash-flow-ui";

function paymentStatusTone(
  status: string
): "neutral" | "success" | "warning" | "info" {
  if (status === "paid") return "success";
  if (status === "pending" || status === "unpaid") return "warning";
  if (status === "refunded") return "neutral";
  return "info";
}

export function CashFlowEntries({
  entries,
  onSelect,
}: {
  entries: CashFlowEntry[];
  onSelect: (entry: CashFlowEntry) => void;
}) {
  if (!entries.length) {
    return (
      <EmptyState
        title="No matching booking records"
        detail="Try another date or filter. Recorded booking payments appear here automatically."
      />
    );
  }

  return (
    <ul className="overflow-hidden rounded-xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface)]">
      {entries.map((entry) => {
        const refunded = entry.paymentStatus === "refunded";
        const positive = entry.amount > 0 && !refunded;

        return (
          <li
            key={entry.id}
            className="border-t border-[var(--cs-border-soft)] first:border-t-0"
          >
            <button
              type="button"
              onClick={() => onSelect(entry)}
              className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 px-4 py-3 text-left transition-colors hover:bg-[var(--cs-surface-warm)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--cs-sand)] sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_auto]"
              aria-label={`View ${entry.customer}, ${entry.service}, ${entry.date}`}
            >
              <div className="min-w-0">
                <p className="truncate font-semibold text-[var(--cs-text)]">
                  {entry.customer}
                </p>

                <p className="truncate text-sm text-[var(--cs-text-secondary)]">
                  {entry.service}
                </p>

                <p className="mt-1 text-xs text-[var(--cs-text-muted)]">
                  {entry.date} · {formatTime12h(entry.time)} booking time
                </p>
              </div>

              <div className="col-span-2 flex min-w-0 flex-wrap gap-1.5 sm:col-span-1">
                <CashFlowStatus>
                  {entry.source === "home_service" ? "Home Service" : "Booking"}
                </CashFlowStatus>

                <CashFlowStatus>
                  {PAYMENT_METHOD_LABELS[
                    entry.method as keyof typeof PAYMENT_METHOD_LABELS
                  ] ?? entry.method}
                </CashFlowStatus>

                <CashFlowStatus tone={paymentStatusTone(entry.paymentStatus)}>
                  {entry.paymentStatus}
                </CashFlowStatus>
              </div>

              <div className="col-start-2 row-start-1 min-w-24 text-right sm:col-start-3 sm:row-auto">
                <p
                  className={`text-base font-bold tabular-nums sm:text-lg ${
                    refunded
                      ? "text-[var(--cs-text-secondary)]"
                      : positive
                        ? "text-[var(--cs-success-text)]"
                        : "text-[var(--cs-text-muted)]"
                  }`}
                >
                  {positive ? "+" : ""}
                  {peso(entry.amount)}
                </p>

                {refunded ? (
                  <p className="mt-0.5 text-[11px] font-semibold text-[var(--cs-text-muted)]">
                    Refunded snapshot
                  </p>
                ) : entry.outstanding > 0 ? (
                  <p className="mt-0.5 text-[11px] font-semibold text-amber-800">
                    Due {peso(entry.outstanding)}
                  </p>
                ) : (
                  <p className="mt-0.5 text-[11px] text-[var(--cs-text-muted)]">
                    Recorded
                  </p>
                )}
              </div>
            </button>
          </li>
        );
      })}
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
  const [filters, setFilters] = useState<CashFlowFilters>({
    ...EMPTY_CASH_FLOW_FILTERS,
    date,
  });

  const [page, setPage] = useState(0);

  function change(field: keyof CashFlowFilters, value: string) {
    setFilters((prev) => ({ ...prev, [field]: value }));
    setPage(0);
  }

  const filtered = useMemo(
    () => filterCashFlowEntries(entries, filters),
    [entries, filters]
  );

  const currentPage = Math.min(
    page,
    Math.max(0, Math.ceil(filtered.length / 50) - 1)
  );

  return (
    <CashFlowPanel
      title="Ledger"
      description="Current booking payment balances by booking date. Audit revisions are not counted as additional receipts."
    >
      <div className="mb-4 rounded-xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)] p-3">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <label className="grid gap-1.5 text-xs font-bold text-[var(--cs-text-secondary)]">
            Search
            <input
              className={fieldClass}
              value={filters.search}
              onChange={(event) => change("search", event.target.value)}
              placeholder="Customer, service, reference"
            />
          </label>

          <label className="grid gap-1.5 text-xs font-bold text-[var(--cs-text-secondary)]">
            Booking date
            <input
              type="date"
              className={fieldClass}
              value={filters.date}
              onChange={(event) => change("date", event.target.value)}
            />
          </label>

          <label className="grid gap-1.5 text-xs font-bold text-[var(--cs-text-secondary)]">
            Source
            <select
              className={fieldClass}
              value={filters.source}
              onChange={(event) => change("source", event.target.value)}
            >
              <option value="">All sources</option>
              <option value="booking">Booking</option>
              <option value="home_service">Home Service</option>
            </select>
          </label>

          <label className="grid gap-1.5 text-xs font-bold text-[var(--cs-text-secondary)]">
            Payment method
            <select
              className={fieldClass}
              value={filters.method}
              onChange={(event) => change("method", event.target.value)}
            >
              <option value="">All methods</option>

              {PAYMENT_METHODS.map((method) => (
                <option key={method} value={method}>
                  {PAYMENT_METHOD_LABELS[method]}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1.5 text-xs font-bold text-[var(--cs-text-secondary)]">
            Payment status
            <select
              className={fieldClass}
              value={filters.status}
              onChange={(event) => change("status", event.target.value)}
            >
              <option value="">All statuses</option>

              {PAYMENT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between gap-3">
        <p
          className="text-sm font-medium text-[var(--cs-text-muted)]"
          role="status"
        >
          {filtered.length} booking records
        </p>

        <Button
          variant="ghost"
          className="h-9"
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

      {filtered.length > 50 ? (
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-[var(--cs-border-soft)] pt-4">
          <Button
            variant="outline"
            disabled={currentPage === 0}
            onClick={() => setPage(currentPage - 1)}
          >
            Previous
          </Button>

          <span className="text-sm font-medium text-[var(--cs-text-secondary)]">
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
      ) : null}
    </CashFlowPanel>
  );
}