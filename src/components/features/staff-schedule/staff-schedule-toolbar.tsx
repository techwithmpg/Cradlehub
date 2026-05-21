"use client";

import { Search, SlidersHorizontal, ArrowDownAZ, Award } from "lucide-react";

export type ScheduleFilter =
  | "all"
  | "scheduled"
  | "not_scheduled"
  | "has_overrides"
  | "has_blocks"
  | "active"
  | "inactive";

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
  { value: "all", label: "All" },
  { value: "scheduled", label: "Scheduled" },
  { value: "not_scheduled", label: "Not Scheduled" },
  { value: "has_overrides", label: "Overrides" },
  { value: "has_blocks", label: "Blocks" },
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
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
      }}
    >
      {/* Top row: search + sort */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          flexWrap: "wrap",
        }}
      >
        {/* Search */}
        <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
          <Search
            size={15}
            style={{
              position: "absolute",
              left: 12,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--cs-text-subtle)",
              pointerEvents: "none",
            }}
          />
          <input
            type="text"
            placeholder="Search staff by name, role, or tier..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            style={{
              width: "100%",
              height: 38,
              padding: "0 0.875rem 0 2.5rem",
              borderRadius: "var(--cs-r-md)",
              border: "1px solid var(--cs-border-soft)",
              backgroundColor: "var(--cs-surface)",
              color: "var(--cs-text)",
              fontSize: "0.8125rem",
              outline: "none",
              transition: "border-color 150ms ease, box-shadow 150ms ease",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "var(--cs-sand)";
              e.currentTarget.style.boxShadow = "var(--cs-focus-ring)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "var(--cs-border-soft)";
              e.currentTarget.style.boxShadow = "none";
            }}
          />
        </div>

        {/* Sort */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          {sort === "name" ? (
            <ArrowDownAZ size={14} style={{ color: "var(--cs-text-muted)" }} />
          ) : (
            <Award size={14} style={{ color: "var(--cs-text-muted)" }} />
          )}
          <select
            value={sort}
            onChange={(e) => onSortChange(e.target.value as ScheduleSort)}
            style={{
              height: 38,
              padding: "0 1.75rem 0 0.625rem",
              borderRadius: "var(--cs-r-md)",
              border: "1px solid var(--cs-border-soft)",
              backgroundColor: "var(--cs-surface)",
              color: "var(--cs-text)",
              fontSize: "0.8125rem",
              cursor: "pointer",
              outline: "none",
              appearance: "none",
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239C8878' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right 8px center",
            }}
          >
            <option value="name">Sort by Name</option>
            <option value="tier">Sort by Tier</option>
          </select>
        </div>

        <div
          style={{
            fontSize: "0.75rem",
            color: "var(--cs-text-muted)",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          {resultCount} result{resultCount !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Filter pills */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          flexWrap: "wrap",
        }}
      >
        <SlidersHorizontal size={13} style={{ color: "var(--cs-text-muted)", flexShrink: 0 }} />
        {FILTERS.map((f) => {
          const isActive = filter === f.value;
          return (
            <button
              key={f.value}
              type="button"
              onClick={() => onFilterChange(f.value)}
              style={{
                padding: "5px 12px",
                borderRadius: "var(--cs-r-pill)",
                fontSize: 11.5,
                fontWeight: isActive ? 600 : 400,
                border: isActive ? "1px solid var(--cs-sand)" : "1px solid var(--cs-border-soft)",
                background: isActive ? "var(--cs-sand-mist)" : "var(--cs-surface)",
                color: isActive ? "var(--cs-sand-dark)" : "var(--cs-text-muted)",
                cursor: "pointer",
                transition: "all 150ms ease",
                whiteSpace: "nowrap",
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = "var(--cs-surface-warm)";
                  e.currentTarget.style.borderColor = "var(--cs-border)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = "var(--cs-surface)";
                  e.currentTarget.style.borderColor = "var(--cs-border-soft)";
                }
              }}
            >
              {f.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
