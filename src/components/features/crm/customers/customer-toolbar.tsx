"use client";

import { FormEvent, useEffect, useState } from "react";
import { Search } from "lucide-react";
import { CustomerTab } from "./customer-segment-tabs";
import { normalizeCustomerSearch } from "./customer-workspace-data";

interface CustomerToolbarProps {
  tab: CustomerTab;
  search?: string;
  onSearch: (search: string | undefined) => void;
  onClear: () => void;
}

export function CustomerToolbar({
  tab,
  search,
  onSearch,
  onClear,
}: CustomerToolbarProps) {
  const [query, setQuery] = useState(search ?? "");

  useEffect(() => {
    setQuery(search ?? "");
  }, [search, tab]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSearch(normalizeCustomerSearch(query));
  }

  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <form
        onSubmit={handleSubmit}
        className="flex w-full flex-col gap-2 sm:max-w-md sm:flex-row sm:items-end"
      >
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
              value={query}
              onChange={(event) => setQuery(event.target.value)}
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
          <button
            type="button"
            onClick={() => {
              setQuery("");
              onClear();
            }}
            className="cs-btn cs-btn-ghost h-9 px-3 text-xs"
          >
            Clear
          </button>
        )}
      </form>
    </div>
  );
}
