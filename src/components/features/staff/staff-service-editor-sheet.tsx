"use client";

import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-3xl max-h-[85vh] p-0 gap-0 overflow-hidden flex flex-col max-sm:max-w-none max-sm:rounded-none max-sm:h-[100dvh]"
      >
        {/* ── Header ── */}
        <DialogHeader className="shrink-0 p-5 pb-4 border-b border-[var(--cs-border)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <DialogTitle className="text-base font-bold text-[var(--cs-text)]">
                Edit Service Capabilities
              </DialogTitle>
              <p className="mt-0.5 text-[0.8125rem] text-[var(--cs-text-muted)]">
                {selectedIds.length > 0
                  ? `${selectedIds.length} service${selectedIds.length !== 1 ? "s" : ""} selected`
                  : "No services assigned yet"}
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="flex items-center justify-center w-[30px] h-[30px] rounded-[6px] border border-[var(--cs-border)] bg-transparent cursor-pointer text-[var(--cs-text-muted)] text-sm shrink-0 mt-0.5"
            >
              ✕
            </button>
          </div>

          {/* Search */}
          <div className="mt-3 relative">
            <span
              aria-hidden
              className="absolute left-[10px] top-1/2 -translate-y-1/2 text-sm text-[var(--cs-text-muted)] pointer-events-none"
            >
              🔍
            </span>
            <input
              aria-label="Search services"
              placeholder="Search services…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setFilterMode("all"); }}
              className="w-full h-9 pl-8 pr-2 rounded-md border border-[var(--cs-border)] text-sm bg-[var(--cs-surface)] text-[var(--cs-text)] box-border"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-none border-none cursor-pointer text-[var(--cs-text-muted)] text-xs py-0.5 px-1"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filter chips */}
          <div className="flex gap-1.5 mt-2 flex-wrap">
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
        </DialogHeader>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto px-5 py-3 flex flex-col gap-2">
          {displayGroups.length === 0 && (
            <div
              className="text-center py-12 px-4"
              style={{ color: "var(--cs-text-muted)" }}
            >
              <p className="text-2xl mb-2">🔍</p>
              <p className="text-sm">
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
                className="border border-[var(--cs-border)] rounded-lg overflow-hidden"
              >
                {/* Category row header */}
                <button
                  onClick={() => {
                    if (!isSearchMode && !isSelectedMode) toggleExpanded(category);
                  }}
                  aria-expanded={isExpanded}
                  aria-label={`${category}, ${selCount} selected of ${totalCount}`}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 border-none text-left"
                  style={{
                    backgroundColor: isExpanded ? "var(--cs-bg)" : "var(--cs-surface)",
                    cursor: isSearchMode || isSelectedMode ? "default" : "pointer",
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-semibold text-[var(--cs-text)]">
                      {category}
                    </span>
                    <span className="text-[0.8125rem] text-[var(--cs-text-muted)] ml-2">
                      {selCount > 0 ? `${selCount} / ${totalCount}` : `${totalCount} available`}
                    </span>
                  </div>
                  {selCount > 0 && (
                    <span
                      className="text-[0.7rem] font-bold rounded-full py-[0.1rem] px-[0.45rem] shrink-0"
                      style={{
                        backgroundColor: "var(--cs-sand)",
                        color: "#fff",
                      }}
                    >
                      {selCount}
                    </span>
                  )}
                  {!isSearchMode && !isSelectedMode && (
                    <span className="text-[0.7rem] text-[var(--cs-text-muted)] shrink-0">
                      {isExpanded ? "▲" : "▼"}
                    </span>
                  )}
                </button>

                {/* Expanded body */}
                {isExpanded && (
                  <div
                    className="px-3.5 py-2.5 border-t border-[var(--cs-border)]"
                    style={{ backgroundColor: "var(--cs-surface)" }}
                  >
                    {/* Quick actions (accordion only) */}
                    {!isSearchMode && !isSelectedMode && (
                      <div className="flex gap-3.5 mb-2.5">
                        <button onClick={() => selectAll(category)} style={quickActionBtn}>
                          Select all
                        </button>
                        <button onClick={() => clearAll(category)} style={quickActionBtn}>
                          Clear
                        </button>
                      </div>
                    )}

                    {/* Service chips */}
                    <div className="flex flex-wrap gap-1.5">
                      {visible.map((s) => {
                        const isSel = selectedSet.has(s.id);
                        return (
                          <button
                            key={s.id}
                            onClick={() => onToggle(s.id)}
                            aria-pressed={isSel}
                            style={serviceChipStyle(isSel)}
                          >
                            {isSel && <span aria-hidden className="text-[0.625rem]">✓</span>}
                            {s.name}
                          </button>
                        );
                      })}
                    </div>

                    {/* Show more */}
                    {hasMore && (
                      <button
                        onClick={() => expandMore(category, sorted.length)}
                        className="mt-2 block"
                        style={quickActionBtn}
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
        <DialogFooter className="shrink-0 border-t border-[var(--cs-border)] p-4 mx-0 mb-0 bg-popover">
          <button
            onClick={onClose}
            className="w-full py-2.5 px-4 rounded-lg font-bold text-[0.9375rem] cursor-pointer border-none"
            style={{
              backgroundColor: "var(--cs-sand)",
              color: "#fff",
            }}
          >
            Done — {selectedIds.length} service{selectedIds.length !== 1 ? "s" : ""} selected
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
