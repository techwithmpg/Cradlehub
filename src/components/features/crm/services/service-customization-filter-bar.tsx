"use client";

import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { DeliveryMode, StatusFilter } from "./service-customization-tab";

const MODE_OPTIONS: { value: DeliveryMode | "all"; label: string }[] = [
  { value: "all", label: "All Delivery Modes" },
  { value: "in_spa", label: "In-Spa" },
  { value: "home_service", label: "Home-Service" },
  { value: "both", label: "Both" },
  { value: "hidden", label: "Hidden" },
];

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All Statuses" },
  { value: "public", label: "Public" },
  { value: "hidden", label: "Hidden" },
  { value: "inactive", label: "Inactive" },
  { value: "ready", label: "Ready" },
  { value: "needs_setup", label: "Needs Setup" },
];

const selectClassName =
  "h-9 w-full min-w-0 rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 text-sm text-[var(--cs-text)] outline-none transition focus:border-[var(--cs-sand)] focus:ring-2 focus:ring-[rgba(166,123,91,0.18)]";

export function ServiceCustomizationFilterBar({
  search,
  onSearchChange,
  categories,
  categoryFilter,
  onCategoryChange,
  modeFilter,
  onModeChange,
  statusFilter,
  onStatusChange,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  categories: string[];
  categoryFilter: string;
  onCategoryChange: (value: string) => void;
  modeFilter: DeliveryMode | "all";
  onModeChange: (value: DeliveryMode | "all") => void;
  statusFilter: StatusFilter;
  onStatusChange: (value: StatusFilter) => void;
}) {
  const hasFilters =
    search.trim().length > 0 ||
    categoryFilter !== "all" ||
    modeFilter !== "all" ||
    statusFilter !== "all";

  return (
    <section
      className="rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-3 shadow-[var(--cs-shadow-xs)]"
      aria-label="Service filters"
    >
      <div className="grid gap-2 lg:grid-cols-[minmax(220px,1fr)_160px_160px_160px_auto]">
        <div className="relative min-w-0">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--cs-text-muted)]"
            aria-hidden="true"
          />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search services..."
            className="h-9 bg-[var(--cs-surface-warm)] pl-9 text-sm"
          />
        </div>

        <FilterSelect
          label="Category"
          value={categoryFilter}
          options={[{ value: "all", label: "All Categories" }, ...categories.map((c) => ({ value: c, label: c }))]}
          onChange={onCategoryChange}
        />

        <FilterSelect
          label="Delivery Mode"
          value={modeFilter}
          options={MODE_OPTIONS}
          onChange={(v) => onModeChange(v as DeliveryMode | "all")}
        />

        <FilterSelect
          label="Status"
          value={statusFilter}
          options={STATUS_OPTIONS}
          onChange={(v) => onStatusChange(v as StatusFilter)}
        />

        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => {
            onSearchChange("");
            onCategoryChange("all");
            onModeChange("all");
            onStatusChange("all");
          }}
          disabled={!hasFilters}
          className="h-9 border-[var(--cs-border)] bg-[var(--cs-surface)] text-[var(--cs-text-secondary)]"
        >
          <X className="mr-1.5 size-4" aria-hidden="true" />
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
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const id = `svc-filter-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="sr-only">
        Filter by {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={selectClassName}
        aria-label={`Filter by ${label}`}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
