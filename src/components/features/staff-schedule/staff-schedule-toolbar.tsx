"use client";

import { Search, SlidersHorizontal } from "lucide-react";

export type ScheduleFilter = "all" | "scheduled" | "not_scheduled" | "has_overrides" | "has_blocks" | "active" | "inactive";
export type ScheduleSort = "name" | "tier";

type Props = {
  search: string;
  onSearchChange: (value: string) => void;
  filter: ScheduleFilter;
  onFilterChange: (value: ScheduleFilter) => void;
  sort: ScheduleSort;
  onSortChange: (value: ScheduleSort) => void;
  resultCount: number;
};

const FILTERS: { value: ScheduleFilter; label: string }[] = [
  { value: "all", label: "All staff" },
  { value: "scheduled", label: "Scheduled" },
  { value: "not_scheduled", label: "Not scheduled" },
  { value: "has_overrides", label: "Has overrides" },
  { value: "has_blocks", label: "Has blocks" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

export function StaffScheduleToolbar({
  search,
  onSearchChange,
  filter,
  onFilterChange,
  sort,
  onSortChange,
  resultCount,
}: Props) {
  return (
    <div
      className="cs-card"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        padding: "0.625rem 0.875rem",
        marginBottom: "1rem",
        flexWrap: "wrap",
      }}
    >
      {/* Search */}
      <div style={{ position: "relative", flex: 1, minWidth: 180 }}>
        <Search
          className="h-4 w-4"
          style={{
            position: "absolute",
            left: 10,
            top: "50%",
            transform: "translateY(-50%)",
            color: "var(--cs-text-subtle)",
          }}
        />
        <input
          type="text"
          placeholder="Search staff by name or role..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          style={{
            width: "100%",
            height: 36,
            padding: "0 0.75rem 0 2.25rem",
            borderRadius: 6,
            border: "1px solid var(--cs-border)",
            backgroundColor: "var(--cs-surface)",
            color: "var(--cs-text)",
            fontSize: "0.8125rem",
            outline: "none",
          }}
        />
      </div>

      {/* Filter */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <SlidersHorizontal className="h-4 w-4" style={{ color: "var(--cs-text-muted)" }} />
        <select
          value={filter}
          onChange={(e) => onFilterChange(e.target.value as ScheduleFilter)}
          style={{
            height: 36,
            padding: "0 1.5rem 0 0.625rem",
            borderRadius: 6,
            border: "1px solid var(--cs-border)",
            backgroundColor: "var(--cs-surface)",
            color: "var(--cs-text)",
            fontSize: "0.8125rem",
            cursor: "pointer",
          }}
        >
          {FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      {/* Sort */}
      <select
        value={sort}
        onChange={(e) => onSortChange(e.target.value as ScheduleSort)}
        style={{
          height: 36,
          padding: "0 1.5rem 0 0.625rem",
          borderRadius: 6,
          border: "1px solid var(--cs-border)",
          backgroundColor: "var(--cs-surface)",
          color: "var(--cs-text)",
          fontSize: "0.8125rem",
          cursor: "pointer",
        }}
      >
        <option value="name">Sort by Name</option>
        <option value="tier">Sort by Tier</option>
      </select>

      <div
        style={{
          marginLeft: "auto",
          fontSize: "0.75rem",
          color: "var(--cs-text-muted)",
          whiteSpace: "nowrap",
        }}
      >
        {resultCount} result{resultCount !== 1 ? "s" : ""}
      </div>
    </div>
  );
}
