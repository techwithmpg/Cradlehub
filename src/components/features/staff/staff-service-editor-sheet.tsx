"use client";

import { useState, useMemo } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import type { Database } from "@/types/supabase";

type ServiceRow = Database["public"]["Tables"]["services"]["Row"] & {
  service_categories: { id: string; name: string } | null;
};

// ── Types ─────────────────────────────────────────────────────────────────────

type CategoryGroup = {
  category: string;
  services: ServiceRow[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const INITIAL_LIMIT = 8;

function groupByCategory(services: ServiceRow[]): CategoryGroup[] {
  const map = new Map<string, ServiceRow[]>();
  for (const s of services) {
    const cat = s.service_categories?.name ?? "Uncategorized";
    const list = map.get(cat) ?? [];
    list.push(s);
    map.set(cat, list);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([category, svcList]) => ({ category, services: svcList }));
}

function sortGroupServices(services: ServiceRow[], selectedSet: Set<string>): ServiceRow[] {
  return [...services].sort((a, b) => {
    const aS = selectedSet.has(a.id) ? 0 : 1;
    const bS = selectedSet.has(b.id) ? 0 : 1;
    if (aS !== bS) return aS - bS;
    return a.name.localeCompare(b.name);
  });
}

// ── Chip styles ───────────────────────────────────────────────────────────────

function filterChipStyle(active: boolean): React.CSSProperties {
  return {
    fontSize: "0.8125rem",
    padding: "0.25rem 0.75rem",
    borderRadius: 999,
    border: `1px solid ${active ? "var(--cs-sand)" : "var(--cs-border)"}`,
    backgroundColor: active ? "var(--cs-sand)" : "transparent",
    color: active ? "#fff" : "var(--cs-text-muted)",
    cursor: "pointer",
    fontWeight: active ? 600 : 400,
    whiteSpace: "nowrap",
  };
}

function serviceChipStyle(selected: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.25rem",
    fontSize: "0.8125rem",
    padding: "0.25rem 0.625rem",
    borderRadius: 999,
    border: `1px solid ${selected ? "var(--cs-sand)" : "var(--cs-border)"}`,
    backgroundColor: selected ? "var(--cs-sand)" : "transparent",
    color: selected ? "#fff" : "var(--cs-text)",
    cursor: "pointer",
    fontWeight: selected ? 600 : 400,
  };
}

const quickActionBtn: React.CSSProperties = {
  fontSize: "0.75rem",
  color: "var(--cs-text-muted)",
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: 0,
  textDecoration: "underline",
};

// ── Main export ───────────────────────────────────────────────────────────────

export function StaffServiceEditorSheet({
  open,
  services,
  selectedIds,
  onToggle,
  onClose,
}: {
  open: boolean;
  services: ServiceRow[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [showMoreMap, setShowMoreMap] = useState<Record<string, number>>({});
  const [filterMode, setFilterMode] = useState<"all" | "selected">("all");

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const grouped = useMemo(() => groupByCategory(services), [services]);

  const searchQuery = search.trim().toLowerCase();
  const isSearchMode = searchQuery.length > 0;
  const isSelectedMode = filterMode === "selected" && !isSearchMode;

  // Which groups to display
  const displayGroups = useMemo<CategoryGroup[]>(() => {
    if (isSearchMode) {
      return grouped
        .map(({ category, services: s }) => ({
          category,
          services: s.filter((svc) => svc.name.toLowerCase().includes(searchQuery)),
        }))
        .filter((g) => g.services.length > 0);
    }
    if (isSelectedMode) {
      return grouped
        .map(({ category, services: s }) => ({
          category,
          services: s.filter((svc) => selectedSet.has(svc.id)),
        }))
        .filter((g) => g.services.length > 0);
    }
    return grouped;
  }, [grouped, isSearchMode, isSelectedMode, searchQuery, selectedSet]);

  const getLimit = (cat: string) => showMoreMap[cat] ?? INITIAL_LIMIT;

  const expandMore = (cat: string, total: number) =>
    setShowMoreMap((p) => ({ ...p, [cat]: total }));

  const toggleExpanded = (cat: string) =>
    setExpandedCategory((p) => (p === cat ? null : cat));

  const selectAll = (cat: string) => {
    const g = grouped.find((g) => g.category === cat);
    if (!g) return;
    for (const s of g.services) {
      if (!selectedSet.has(s.id)) onToggle(s.id);
    }
  };

  const clearAll = (cat: string) => {
    const g = grouped.find((g) => g.category === cat);
    if (!g) return;
    for (const s of g.services) {
      if (selectedSet.has(s.id)) onToggle(s.id);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="sm:max-w-xl flex flex-col p-0 gap-0"
      >
        {/* ── Header ── */}
        <SheetHeader
          style={{
            padding: "1rem 1.25rem",
            borderBottom: "1px solid var(--cs-border)",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.75rem" }}>
            <div>
              <SheetTitle style={{ fontSize: "1rem", fontWeight: 700, color: "var(--cs-text)" }}>
                Edit Service Capabilities
              </SheetTitle>
              <p style={{ margin: "0.125rem 0 0", fontSize: "0.8125rem", color: "var(--cs-text-muted)" }}>
                {selectedIds.length > 0
                  ? `${selectedIds.length} service${selectedIds.length !== 1 ? "s" : ""} selected`
                  : "No services assigned yet"}
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 30,
                height: 30,
                borderRadius: 6,
                border: "1px solid var(--cs-border)",
                backgroundColor: "transparent",
                cursor: "pointer",
                color: "var(--cs-text-muted)",
                fontSize: "0.875rem",
                flexShrink: 0,
                marginTop: 2,
              }}
            >
              ✕
            </button>
          </div>

          {/* Search */}
          <div style={{ marginTop: "0.75rem", position: "relative" }}>
            <span
              aria-hidden
              style={{
                position: "absolute",
                left: 10,
                top: "50%",
                transform: "translateY(-50%)",
                fontSize: "0.875rem",
                color: "var(--cs-text-muted)",
                pointerEvents: "none",
              }}
            >
              🔍
            </span>
            <input
              aria-label="Search services"
              placeholder="Search services…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setFilterMode("all"); }}
              style={{
                width: "100%",
                height: 36,
                paddingLeft: 32,
                paddingRight: 8,
                borderRadius: 7,
                border: "1px solid var(--cs-border)",
                fontSize: "0.875rem",
                backgroundColor: "var(--cs-surface)",
                color: "var(--cs-text)",
                boxSizing: "border-box",
              }}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                aria-label="Clear search"
                style={{
                  position: "absolute",
                  right: 8,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--cs-text-muted)",
                  fontSize: "0.75rem",
                  padding: "0.125rem 0.25rem",
                }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Filter chips */}
          <div style={{ display: "flex", gap: "0.375rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
            <button
              onClick={() => { setFilterMode("all"); setSearch(""); }}
              aria-pressed={filterMode === "all" && !isSearchMode}
              style={filterChipStyle(filterMode === "all" && !isSearchMode)}
            >
              All services
            </button>
            <button
              onClick={() => { setFilterMode("selected"); setSearch(""); }}
              aria-pressed={filterMode === "selected"}
              style={filterChipStyle(filterMode === "selected")}
            >
              Selected ({selectedIds.length})
            </button>
          </div>
        </SheetHeader>

        {/* ── Body ── */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "0.75rem 1.25rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
          }}
        >
          {displayGroups.length === 0 && (
            <div
              style={{
                textAlign: "center",
                padding: "3rem 1rem",
                color: "var(--cs-text-muted)",
              }}
            >
              <p style={{ fontSize: "1.5rem", margin: "0 0 0.5rem" }}>🔍</p>
              <p style={{ fontSize: "0.875rem", margin: 0 }}>
                {isSearchMode
                  ? `No services match "${search}"`
                  : "No services assigned yet."}
              </p>
            </div>
          )}

          {displayGroups.map(({ category, services: catSvcs }) => {
            const isExpanded = isSearchMode || isSelectedMode || expandedCategory === category;
            const selCount = catSvcs.filter((s) => selectedSet.has(s.id)).length;
            const totalCount = catSvcs.length;
            const sorted = sortGroupServices(catSvcs, selectedSet);
            const limit = getLimit(category);
            const visible = isSearchMode || isSelectedMode ? sorted : sorted.slice(0, limit);
            const hasMore = !isSearchMode && !isSelectedMode && sorted.length > limit;

            return (
              <div
                key={category}
                style={{
                  border: "1px solid var(--cs-border)",
                  borderRadius: 8,
                  overflow: "hidden",
                }}
              >
                {/* Category row header */}
                <button
                  onClick={() => {
                    if (!isSearchMode && !isSelectedMode) toggleExpanded(category);
                  }}
                  aria-expanded={isExpanded}
                  aria-label={`${category}, ${selCount} selected of ${totalCount}`}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.625rem",
                    padding: "0.625rem 0.875rem",
                    backgroundColor: isExpanded ? "var(--cs-bg)" : "var(--cs-surface)",
                    border: "none",
                    cursor: isSearchMode || isSelectedMode ? "default" : "pointer",
                    textAlign: "left",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--cs-text)" }}>
                      {category}
                    </span>
                    <span style={{ fontSize: "0.8125rem", color: "var(--cs-text-muted)", marginLeft: "0.5rem" }}>
                      {selCount > 0 ? `${selCount} / ${totalCount}` : `${totalCount} available`}
                    </span>
                  </div>
                  {selCount > 0 && (
                    <span
                      style={{
                        fontSize: "0.7rem",
                        fontWeight: 700,
                        backgroundColor: "var(--cs-sand)",
                        color: "#fff",
                        borderRadius: 999,
                        padding: "0.1rem 0.45rem",
                        flexShrink: 0,
                      }}
                    >
                      {selCount}
                    </span>
                  )}
                  {!isSearchMode && !isSelectedMode && (
                    <span style={{ fontSize: "0.7rem", color: "var(--cs-text-muted)", flexShrink: 0 }}>
                      {isExpanded ? "▲" : "▼"}
                    </span>
                  )}
                </button>

                {/* Expanded body */}
                {isExpanded && (
                  <div
                    style={{
                      padding: "0.625rem 0.875rem",
                      borderTop: "1px solid var(--cs-border)",
                      backgroundColor: "var(--cs-surface)",
                    }}
                  >
                    {/* Quick actions (accordion only) */}
                    {!isSearchMode && !isSelectedMode && (
                      <div
                        style={{
                          display: "flex",
                          gap: "0.875rem",
                          marginBottom: "0.625rem",
                        }}
                      >
                        <button onClick={() => selectAll(category)} style={quickActionBtn}>
                          Select all
                        </button>
                        <button onClick={() => clearAll(category)} style={quickActionBtn}>
                          Clear
                        </button>
                      </div>
                    )}

                    {/* Service chips */}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
                      {visible.map((s) => {
                        const isSel = selectedSet.has(s.id);
                        return (
                          <button
                            key={s.id}
                            onClick={() => onToggle(s.id)}
                            aria-pressed={isSel}
                            style={serviceChipStyle(isSel)}
                          >
                            {isSel && <span aria-hidden style={{ fontSize: "0.625rem" }}>✓</span>}
                            {s.name}
                          </button>
                        );
                      })}
                    </div>

                    {/* Show more */}
                    {hasMore && (
                      <button
                        onClick={() => expandMore(category, sorted.length)}
                        style={{ ...quickActionBtn, marginTop: "0.5rem", display: "block" }}
                      >
                        Show {sorted.length - limit} more in {category}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Footer ── */}
        <SheetFooter
          style={{
            padding: "0.875rem 1.25rem",
            borderTop: "1px solid var(--cs-border)",
            flexShrink: 0,
          }}
        >
          <button
            onClick={onClose}
            style={{
              width: "100%",
              padding: "0.625rem 1rem",
              borderRadius: 8,
              backgroundColor: "var(--cs-sand)",
              color: "#fff",
              border: "none",
              fontWeight: 700,
              fontSize: "0.9375rem",
              cursor: "pointer",
            }}
          >
            Done — {selectedIds.length} service{selectedIds.length !== 1 ? "s" : ""} selected
          </button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
