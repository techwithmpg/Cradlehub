"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarDays, ChevronDown, Filter, Search } from "lucide-react";
import type { Branch } from "./booking-workspace-types";
import type { BookingQuickFilter } from "@/lib/bookings/bookings-workspace-filters";

type PreservedQuery = {
  bookingId?: string;
  branchId?: string;
  highlight?: string;
  page?: string;
};

type BookingsListToolbarProps = {
  basePath: string;
  date: string;
  quickFilter: BookingQuickFilter;
  search?: string;
  status?: string;
  source?: string;
  delivery?: string;
  payment?: string;
  assignment?: string;
  branch?: string;
  branches?: Branch[];
  preservedQuery: PreservedQuery;
};

function clearFiltersHref(
  basePath: string,
  date: string,
  quickFilter: BookingQuickFilter,
  preservedQuery: PreservedQuery
): string {
  const params = new URLSearchParams({ date, tab: quickFilter });
  for (const [key, value] of Object.entries(preservedQuery)) {
    if (value) params.set(key, value);
  }
  return `${basePath}?${params.toString()}`;
}

function FilterSelect({
  label,
  name,
  value,
  children,
}: {
  label: string;
  name: string;
  value?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--cs-text-muted)]">
        {label}
      </span>
      <select
        name={name}
        defaultValue={value ?? ""}
        className="h-10 rounded-lg border border-[var(--cs-border)] bg-white px-3 text-sm text-[var(--cs-text)] outline-none focus:border-emerald-800"
      >
        {children}
      </select>
    </label>
  );
}

export function BookingsListToolbar(props: BookingsListToolbarProps) {
  const [showFilters, setShowFilters] = useState(
    Boolean(
      props.status ||
        props.source ||
        props.delivery ||
        props.payment ||
        props.assignment ||
        props.branch
    )
  );

  return (
    <form method="get" className="grid gap-3 px-5 pb-1">
      <input type="hidden" name="tab" value={props.quickFilter} />
      {Object.entries(props.preservedQuery).map(([key, value]) =>
        value ? <input key={key} type="hidden" name={key} value={value} /> : null
      )}
      {!showFilters ? (
        <>
          {props.status ? <input type="hidden" name="status" value={props.status} /> : null}
          {props.source ? <input type="hidden" name="type" value={props.source} /> : null}
          {props.delivery ? <input type="hidden" name="delivery" value={props.delivery} /> : null}
          {props.payment ? <input type="hidden" name="payment" value={props.payment} /> : null}
          {props.assignment ? <input type="hidden" name="assignment" value={props.assignment} /> : null}
          {props.branch ? <input type="hidden" name="branch" value={props.branch} /> : null}
        </>
      ) : null}

      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
        <label className="relative flex h-11 items-center rounded-lg border border-[var(--cs-border)] bg-white px-3">
          <CalendarDays className="mr-2 size-4 text-[var(--cs-text-secondary)]" />
          <span className="sr-only">Selected date</span>
          <input
            type="date"
            name="date"
            defaultValue={props.date}
            className="min-w-0 flex-1 bg-transparent text-sm font-medium text-[var(--cs-text)] outline-none"
          />
        </label>

        <button
          type="button"
          onClick={() => setShowFilters((current) => !current)}
          aria-expanded={showFilters}
          className="inline-flex h-11 items-center gap-2 rounded-lg border border-[var(--cs-border)] bg-white px-4 text-sm font-semibold text-[var(--cs-text)] transition hover:bg-[var(--cs-surface-warm)]"
        >
          <Filter className="size-4" />
          Filters
          <ChevronDown className={`size-4 transition-transform ${showFilters ? "rotate-180" : ""}`} />
        </button>

        <label className="col-span-2 flex h-11 min-w-0 items-center rounded-lg border border-[var(--cs-border)] bg-white px-3">
          <Search className="mr-2 size-4 shrink-0 text-[var(--cs-text-secondary)]" />
          <span className="sr-only">Search bookings</span>
          <input
            type="search"
            name="search"
            defaultValue={props.search ?? ""}
            placeholder="Search bookings…"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--cs-text-muted)]"
          />
        </label>
      </div>

      {showFilters ? (
        <div className="grid grid-cols-2 gap-3 rounded-xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)] p-3 shadow-sm">
          <FilterSelect label="Status" name="status" value={props.status}>
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="checked_in">Checked in</option>
            <option value="in_service">In service</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="no_show">No-show</option>
          </FilterSelect>
          <FilterSelect label="Source" name="type" value={props.source}>
            <option value="">All sources</option>
            <option value="online">Online</option>
            <option value="walkin">Walk-in</option>
            <option value="phone">Phone</option>
          </FilterSelect>
          <FilterSelect label="Location" name="delivery" value={props.delivery}>
            <option value="">All locations</option>
            <option value="in_spa">In-spa</option>
            <option value="home_service">Home service</option>
          </FilterSelect>
          <FilterSelect label="Payment" name="payment" value={props.payment}>
            <option value="">All payment states</option>
            <option value="unpaid">Unpaid</option>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
            <option value="refunded">Refunded</option>
          </FilterSelect>
          <FilterSelect label="Assignment" name="assignment" value={props.assignment}>
            <option value="">All assignments</option>
            <option value="staff_assigned">Staff assigned</option>
            <option value="staff_unassigned">Staff unassigned</option>
            <option value="room_assigned">Room assigned</option>
            <option value="room_unassigned">Room unassigned</option>
          </FilterSelect>
          {props.branches?.length ? (
            <FilterSelect label="Branch" name="branch" value={props.branch}>
              <option value="">All branches</option>
              {props.branches.map((branch) => (
                <option key={branch.id} value={branch.id}>{branch.name}</option>
              ))}
            </FilterSelect>
          ) : null}

          <div className="col-span-2 flex justify-end gap-2 border-t border-[var(--cs-border-soft)] pt-3">
            <Link
              href={clearFiltersHref(props.basePath, props.date, props.quickFilter, props.preservedQuery)}
              className="inline-flex h-9 items-center rounded-lg px-3 text-sm font-semibold text-[var(--cs-text-secondary)] hover:bg-white"
            >
              Clear filters
            </Link>
            <button
              type="submit"
              className="inline-flex h-9 items-center rounded-lg bg-emerald-900 px-4 text-sm font-semibold text-white hover:bg-emerald-800"
            >
              Apply filters
            </button>
          </div>
        </div>
      ) : null}
    </form>
  );
}
