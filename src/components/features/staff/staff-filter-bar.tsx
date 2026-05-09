"use client";

import { Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { StaffFilters } from "./staff-management-utils";

type FilterOption = {
  value: string;
  label: string;
};

type StaffFilterBarProps = {
  filters: StaffFilters;
  branchOptions: FilterOption[];
  roleOptions: FilterOption[];
  statusOptions: FilterOption[];
  onFiltersChange: (filters: StaffFilters) => void;
  onClear: () => void;
};

const selectClassName =
  "h-9 w-full min-w-0 rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 text-sm text-[var(--cs-text)] outline-none transition focus:border-[var(--cs-sand)] focus:ring-2 focus:ring-[rgba(166,123,91,0.18)]";

export function StaffFilterBar({
  filters,
  branchOptions,
  roleOptions,
  statusOptions,
  onFiltersChange,
  onClear,
}: StaffFilterBarProps) {
  const hasFilters =
    filters.search.trim().length > 0 ||
    filters.branchId !== "all" ||
    filters.role !== "all" ||
    filters.status !== "all";

  function updateFilter(key: keyof StaffFilters, value: string) {
    onFiltersChange({ ...filters, [key]: value });
  }

  return (
    <section
      className="rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-3 shadow-[var(--cs-shadow-xs)]"
      aria-label="Staff filters"
    >
      <div className="grid gap-2 lg:grid-cols-[minmax(220px,1fr)_180px_170px_170px_auto_auto]">
        <div className="relative min-w-0">
          <label htmlFor="staff-search" className="sr-only">
            Search staff
          </label>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--cs-text-muted)]"
            aria-hidden="true"
          />
          <Input
            id="staff-search"
            value={filters.search}
            onChange={(event) => updateFilter("search", event.target.value)}
            placeholder="Search staff by name or phone..."
            className="h-9 bg-[var(--cs-surface-warm)] pl-9 text-sm"
          />
        </div>

        <FilterSelect
          label="Branch"
          value={filters.branchId}
          options={branchOptions}
          onChange={(value) => updateFilter("branchId", value)}
        />
        <FilterSelect
          label="Role"
          value={filters.role}
          options={roleOptions}
          onChange={(value) => updateFilter("role", value)}
        />
        <FilterSelect
          label="Status"
          value={filters.status}
          options={statusOptions}
          onChange={(value) => updateFilter("status", value)}
        />

        <Button
          type="button"
          variant="outline"
          size="icon-lg"
          onClick={onClear}
          aria-label="Reset staff filters"
          title="Reset staff filters"
          className="border-[var(--cs-border)] bg-[var(--cs-surface)] text-[var(--cs-text-muted)]"
        >
          <SlidersHorizontal className="size-4" aria-hidden="true" />
        </Button>

        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={onClear}
          disabled={!hasFilters}
          className="border-[var(--cs-border)] bg-[var(--cs-surface)] text-[var(--cs-text-secondary)]"
        >
          <X className="size-4" aria-hidden="true" />
          Clear
        </Button>
      </div>
    </section>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
}) {
  const id = `staff-filter-${label.toLowerCase()}`;

  return (
    <div className="min-w-0">
      <label htmlFor={id} className="sr-only">
        Filter by {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={selectClassName}
        aria-label={`Filter by ${label}`}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
