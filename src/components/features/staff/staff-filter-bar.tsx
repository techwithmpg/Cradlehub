"use client";

import { Search, X } from "lucide-react";
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
  hideBranchFilter?: boolean;
};

const selectClassName =
  "h-9 w-full min-w-0 rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 text-xs text-[var(--cs-text)] outline-none transition focus:border-[var(--cs-sand)] focus:ring-2 focus:ring-[rgba(166,123,91,0.18)]";

export function StaffFilterBar({
  filters,
  branchOptions,
  roleOptions,
  statusOptions,
  onFiltersChange,
  onClear,
  hideBranchFilter,
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
    <section className="space-y-2" aria-label="Staff filters">
      <div className="relative min-w-0">
        <label htmlFor="staff-search" className="sr-only">Search staff</label>
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--cs-text-muted)]" aria-hidden="true" />
        <Input
          id="staff-search"
          value={filters.search}
          onChange={(event) => updateFilter("search", event.target.value)}
          placeholder="Search staff by name or phone..."
          className="h-9 bg-[var(--cs-surface)] pl-9 text-sm"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {!hideBranchFilter && (
          <div className="min-w-[130px] flex-1">
            <FilterSelect label="Branch" value={filters.branchId} options={branchOptions} onChange={(value) => updateFilter("branchId", value)} />
          </div>
        )}
        <div className="min-w-[125px] flex-1">
          <FilterSelect label="Workspace Access" value={filters.role} options={roleOptions} onChange={(value) => updateFilter("role", value)} />
        </div>
        <div className="min-w-[125px] flex-1">
          <FilterSelect label="Status" value={filters.status} options={statusOptions} onChange={(value) => updateFilter("status", value)} />
        </div>
        {hasFilters && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClear}
            aria-label="Reset staff filters"
            className="h-9 shrink-0 text-[var(--cs-text-secondary)]"
          >
            <X className="size-3.5" aria-hidden="true" />
            Clear
          </Button>
        )}
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
  const id = `staff-filter-${label.toLowerCase().replace(/\s+/g, "-")}`;

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
