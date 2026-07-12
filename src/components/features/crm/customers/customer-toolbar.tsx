"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { CustomerTab } from "./customer-segment-tabs";

interface CustomerToolbarProps {
  tab: CustomerTab;
  search?: string;
}

export function CustomerToolbar({ tab, search }: CustomerToolbarProps) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <form
        method="GET"
        action="/crm/customers"
        className="flex w-full flex-col gap-2 sm:max-w-md sm:flex-row sm:items-end"
      >
        <input type="hidden" name="tab" value={tab} />
        <label className="grid min-w-0 flex-1 gap-1">
          <span className="text-[0.68rem] font-bold uppercase tracking-wide text-[var(--cs-text-muted)]">
            Search customers
          </span>
          <span className="relative">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--cs-text-subtle)]"
            />
            <input
              name="q"
              type="search"
              defaultValue={search ?? ""}
              placeholder="Search by name or phone..."
              className="h-9 w-full rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] pl-9 pr-3 text-sm text-[var(--cs-text)] placeholder:text-[var(--cs-text-subtle)] focus:border-[var(--cs-sand)] focus:outline-none focus:ring-2 focus:ring-[var(--cs-sand)]/20"
            />
          </span>
        </label>
        <button
          type="submit"
          className="cs-btn cs-btn-secondary h-9 px-3 text-xs"
        >
          Search
        </button>
        {search && (
          <Link
            href={`/crm/customers?tab=${tab}`}
            className="cs-btn cs-btn-ghost h-9 px-3 text-xs"
          >
            Clear
          </Link>
        )}
      </form>
    </div>
  );
}
