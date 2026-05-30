"use client";

import Link from "next/link";
import { Search, Download, SlidersHorizontal } from "lucide-react";
import { CustomerTab } from "./customer-segment-tabs";

interface CustomerToolbarProps {
  tab: CustomerTab;
  search?: string;
}

export function CustomerToolbar({ tab, search }: CustomerToolbarProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
      <form
        method="GET"
        action="/crm/customers"
        className="flex w-full gap-2 sm:max-w-md"
      >
        <input type="hidden" name="tab" value={tab} />
        <div className="relative flex-1">
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--cs-text-subtle)]"
          />
          <input
            name="q"
            type="search"
            defaultValue={search ?? ""}
            placeholder="Search by name or phone…"
            className="h-9 w-full rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] pl-9 pr-3 text-sm text-[var(--cs-text)] placeholder:text-[var(--cs-text-subtle)] focus:border-[var(--cs-sand)] focus:outline-none focus:ring-2 focus:ring-[var(--cs-sand)]/20"
          />
        </div>
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

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled
          className="cs-btn cs-btn-secondary cs-btn-sm inline-flex items-center gap-1.5 opacity-50 cursor-not-allowed"
          title="Filters coming soon"
        >
          <SlidersHorizontal size={12} />
          Filters
        </button>
        <button
          type="button"
          disabled
          className="cs-btn cs-btn-secondary cs-btn-sm inline-flex items-center gap-1.5 opacity-50 cursor-not-allowed"
          title="Export coming soon"
        >
          <Download size={12} />
          Export
        </button>
      </div>
    </div>
  );
}
