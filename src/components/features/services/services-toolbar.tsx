"use client";

import { Search, SlidersHorizontal } from "lucide-react";

export type ServiceFilter = "all" | "active" | "inactive";
export type ServiceSort = "name" | "price_asc" | "price_desc" | "duration";

type Props = {
  search: string;
  onSearchChange: (value: string) => void;
  filter: ServiceFilter;
  onFilterChange: (value: ServiceFilter) => void;
  sort: ServiceSort;
  onSortChange: (value: ServiceSort) => void;
  resultCount: number;
  categories: { id: string; name: string }[];
  categoryFilter: string | null;
  onCategoryFilterChange: (value: string | null) => void;
};

const FILTERS: { value: ServiceFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

export function ServicesToolbar({
  search,
  onSearchChange,
  filter,
  onFilterChange,
  sort,
  onSortChange,
  resultCount,
  categories,
  categoryFilter,
  onCategoryFilterChange,
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
          placeholder="Search services..."
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

      {/* Category filter */}
      {categories.length > 0 && (
        <select
          value={categoryFilter ?? ""}
          onChange={(e) => onCategoryFilterChange(e.target.value || null)}
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
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      )}

      {/* Status filter */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <SlidersHorizontal className="h-4 w-4" style={{ color: "var(--cs-text-muted)" }} />
        <select
          value={filter}
          onChange={(e) => onFilterChange(e.target.value as ServiceFilter)}
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
        onChange={(e) => onSortChange(e.target.value as ServiceSort)}
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
        <option value="name">Name</option>
        <option value="price_asc">Price: Low to High</option>
        <option value="price_desc">Price: High to Low</option>
        <option value="duration">Duration</option>
      </select>

      <div
        style={{
          marginLeft: "auto",
          fontSize: "0.75rem",
          color: "var(--cs-text-muted)",
          whiteSpace: "nowrap",
        }}
      >
        {resultCount} service{resultCount !== 1 ? "s" : ""}
      </div>
    </div>
  );
}
