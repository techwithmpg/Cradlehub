"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  AdminDialog,
  AdminOverlayHeader,
  AdminOverlayToolbar,
  AdminOverlayBody,
  AdminOverlayFooter,
  ConfirmUnsavedChangesDialog,
} from "@/components/shared/overlays";
import type { Database } from "@/types/supabase";

type ServiceRow = Database["public"]["Tables"]["services"]["Row"] & {
  service_categories: { id: string; name: string } | null;
};

type CategoryGroup = {
  category: string;
  services: ServiceRow[];
};

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

function sortGroupServices(
  services: ServiceRow[],
  selectedSet: Set<string>
): ServiceRow[] {
  return [...services].sort((a, b) => {
    const aS = selectedSet.has(a.id) ? 0 : 1;
    const bS = selectedSet.has(b.id) ? 0 : 1;
    if (aS !== bS) return aS - bS;
    return a.name.localeCompare(b.name);
  });
}

export function StaffServiceEditorSheet({
  open,
  services,
  selectedIds,
  onToggle,
  onClose,
  onSave,
  saving,
  staffName,
}: {
  open: boolean;
  services: ServiceRow[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onClose: () => void;
  onSave?: (ids: string[]) => void;
  saving?: boolean;
  staffName?: string;
}) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<"all" | "selected">("all");
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [baselineIds, setBaselineIds] = useState<string[]>([]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const grouped = useMemo(() => groupByCategory(services), [services]);

  const searchQuery = search.trim().toLowerCase();
  const isSearchMode = searchQuery.length > 0;
  const isSelectedMode = filterMode === "selected" && !isSearchMode;

  const handleDialogOpenChange = (o: boolean) => {
    if (o) {
      setBaselineIds([...selectedIds]);
      setSearch("");
      setFilterMode("all");
      setActiveCategory(grouped[0]?.category ?? null);
    } else {
      const hasChanges =
        baselineIds.length !== selectedIds.length ||
        baselineIds.some((id) => !selectedIds.includes(id)) ||
        selectedIds.some((id) => !baselineIds.includes(id));
      if (hasChanges) {
        setShowDiscardDialog(true);
        return;
      }
      onClose();
    }
  };

  const handleCancel = () => handleDialogOpenChange(false);

  const handleSave = () => {
    if (onSave) {
      onSave(selectedIds);
    } else {
      onClose();
    }
  };

  const hasChanges = useMemo(() => {
    return (
      baselineIds.length !== selectedIds.length ||
      baselineIds.some((id) => !selectedIds.includes(id)) ||
      selectedIds.some((id) => !baselineIds.includes(id))
    );
  }, [baselineIds, selectedIds]);

  const displayGroups = useMemo<CategoryGroup[]>(() => {
    if (isSearchMode) {
      return grouped
        .map(({ category, services: s }) => ({
          category,
          services: s.filter((svc) =>
            svc.name.toLowerCase().includes(searchQuery)
          ),
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

  const activeGroup = grouped.find((g) => g.category === activeCategory) ?? null;

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
    <>
      <AdminDialog
        open={open}
        onOpenChange={handleDialogOpenChange}
        size="wide"
      >
        <AdminOverlayHeader
          title="Edit Service Capabilities"
          description={`${staffName ? `${staffName} · ` : ""}${
            selectedIds.length > 0
              ? `${selectedIds.length} service${selectedIds.length !== 1 ? "s" : ""} selected`
              : "No services assigned yet"
          }`}
        />

        <AdminOverlayToolbar>
          <div className="flex flex-col gap-2">
            <div className="relative">
              <span
                aria-hidden
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-[var(--cs-text-muted)] pointer-events-none"
              >
                🔍
              </span>
              <input
                aria-label="Search services"
                placeholder="Search services…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setFilterMode("all");
                }}
                className="w-full h-9 pl-8 pr-2 rounded-md border border-[var(--cs-border)] text-sm bg-[var(--cs-surface)] text-[var(--cs-text)] box-border"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-transparent border-none cursor-pointer text-[var(--cs-text-muted)] text-xs py-0.5 px-1"
                >
                  ✕
                </button>
              )}
            </div>
            <div className="flex gap-1.5 flex-wrap">
              <button
                onClick={() => {
                  setFilterMode("all");
                  setSearch("");
                }}
                aria-pressed={filterMode === "all" && !isSearchMode}
                className={cn(
                  "text-[0.8125rem] px-3 rounded-full border cursor-pointer font-medium whitespace-nowrap transition",
                  filterMode === "all" && !isSearchMode
                    ? "border-[var(--cs-sand)] bg-[var(--cs-sand)] text-white"
                    : "border-[var(--cs-border)] bg-transparent text-[var(--cs-text-muted)]"
                )}
              >
                All services
              </button>
              <button
                onClick={() => {
                  setFilterMode("selected");
                  setSearch("");
                }}
                aria-pressed={filterMode === "selected"}
                className={cn(
                  "text-[0.8125rem] px-3 rounded-full border cursor-pointer font-medium whitespace-nowrap transition",
                  filterMode === "selected"
                    ? "border-[var(--cs-sand)] bg-[var(--cs-sand)] text-white"
                    : "border-[var(--cs-border)] bg-transparent text-[var(--cs-text-muted)]"
                )}
              >
                Selected ({selectedIds.length})
              </button>
            </div>
          </div>
        </AdminOverlayToolbar>

        <AdminOverlayBody className="overflow-hidden p-0 flex flex-col">
          {displayGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 px-4 text-[var(--cs-text-muted)]">
              <p className="text-2xl mb-2">🔍</p>
              <p className="text-sm text-center">
                {isSearchMode
                  ? `No services match "${search}"`
                  : isSelectedMode
                    ? "No services selected yet. Choose services from All Services."
                    : "No services available."}
              </p>
            </div>
          ) : (
            <div className="flex flex-1 min-h-0 flex-col sm:grid sm:grid-cols-[220px_1fr]">
              {/* Category rail */}
              <aside className="shrink-0 sm:min-h-0 overflow-x-auto sm:overflow-y-auto border-b sm:border-b-0 sm:border-r border-[var(--cs-border)] bg-[var(--cs-bg)] px-3 py-2 sm:py-3 flex sm:flex-col gap-1">
                {grouped.map(({ category, services: catSvcs }) => {
                  const selCount = catSvcs.filter((s) =>
                    selectedSet.has(s.id)
                  ).length;
                  const totalCount = catSvcs.length;
                  const isActive = activeCategory === category;
                  const hasMatch =
                    isSearchMode || isSelectedMode
                      ? displayGroups.some((g) => g.category === category)
                      : true;

                  if ((isSearchMode || isSelectedMode) && !hasMatch) {
                    return null;
                  }

                  return (
                    <button
                      key={category}
                      onClick={() => setActiveCategory(category)}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition whitespace-nowrap sm:whitespace-normal",
                        isActive
                          ? "bg-[var(--cs-sand)] text-white"
                          : "bg-transparent text-[var(--cs-text)] hover:bg-[var(--cs-surface)]"
                      )}
                    >
                      <span className="flex-1 min-w-0 truncate">
                        {category}
                      </span>
                      <span
                        className={cn(
                          "text-[0.7rem] font-bold rounded-full py-0.5 px-1.5 shrink-0",
                          selCount > 0
                            ? isActive
                              ? "bg-white/20 text-white"
                              : "bg-[var(--cs-sand)] text-white"
                            : isActive
                              ? "bg-white/20 text-white"
                              : "bg-[var(--cs-border)] text-[var(--cs-text-muted)]"
                        )}
                      >
                        {selCount > 0
                          ? `${selCount} / ${totalCount}`
                          : totalCount}
                      </span>
                    </button>
                  );
                })}
              </aside>

              {/* Service list */}
              <section className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                {isSearchMode && (
                  <div className="flex flex-col gap-4">
                    {displayGroups.map(({ category, services: catSvcs }) => {
                      const sorted = sortGroupServices(catSvcs, selectedSet);
                      return (
                        <div key={category}>
                          <h3 className="text-sm font-semibold text-[var(--cs-text)] mb-2">
                            {category}
                          </h3>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {sorted.map((s) => (
                              <ServiceCheckbox
                                key={s.id}
                                service={s}
                                selected={selectedSet.has(s.id)}
                                onToggle={() => onToggle(s.id)}
                              />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {isSelectedMode && (
                  <div className="flex flex-col gap-4">
                    {displayGroups.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-[var(--cs-text-muted)]">
                        <p className="text-2xl mb-2">🔍</p>
                        <p className="text-sm text-center">
                          No services selected yet. Choose services from All
                          Services.
                        </p>
                      </div>
                    ) : (
                      displayGroups.map(({ category, services: catSvcs }) => {
                        const sorted = sortGroupServices(catSvcs, selectedSet);
                        return (
                          <div key={category}>
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="text-sm font-semibold text-[var(--cs-text)]">
                                {category}
                              </h3>
                              <button
                                onClick={() => clearAll(category)}
                                className="text-[0.75rem] text-[var(--cs-text-muted)] underline cursor-pointer bg-transparent border-none p-0"
                              >
                                Remove all
                              </button>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {sorted.map((s) => (
                                <ServiceCheckbox
                                  key={s.id}
                                  service={s}
                                  selected={selectedSet.has(s.id)}
                                  onToggle={() => onToggle(s.id)}
                                />
                              ))}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {!isSearchMode && !isSelectedMode && activeGroup && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="text-base font-semibold text-[var(--cs-text)]">
                          {activeGroup.category}
                        </h3>
                        <p className="text-[0.8125rem] text-[var(--cs-text-muted)]">
                          {
                            activeGroup.services.filter((s) =>
                              selectedSet.has(s.id)
                            ).length
                          }{" "}
                          of {activeGroup.services.length} selected
                        </p>
                      </div>
                      <div className="flex gap-3.5">
                        <button
                          onClick={() => selectAll(activeGroup.category)}
                          className="text-[0.75rem] text-[var(--cs-text-muted)] underline cursor-pointer bg-transparent border-none p-0"
                        >
                          Select all
                        </button>
                        <button
                          onClick={() => clearAll(activeGroup.category)}
                          className="text-[0.75rem] text-[var(--cs-text-muted)] underline cursor-pointer bg-transparent border-none p-0"
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {sortGroupServices(
                        activeGroup.services,
                        selectedSet
                      ).map((s) => (
                        <ServiceCheckbox
                          key={s.id}
                          service={s}
                          selected={selectedSet.has(s.id)}
                          onToggle={() => onToggle(s.id)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {!isSearchMode && !isSelectedMode && !activeGroup && (
                  <div className="flex flex-col items-center justify-center h-full text-[var(--cs-text-muted)]">
                    <p className="text-sm">Select a category to view services.</p>
                  </div>
                )}
              </section>
            </div>
          )}
        </AdminOverlayBody>

        <AdminOverlayFooter className="flex flex-row justify-end gap-3">
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-2.5 rounded-lg text-sm font-medium border border-[var(--cs-border)] bg-transparent cursor-pointer text-[var(--cs-text)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="px-4 py-2.5 rounded-lg text-sm font-bold border-none cursor-pointer disabled:opacity-60 bg-[var(--cs-sand)] text-white"
          >
            {saving
              ? "Saving…"
              : `Save ${selectedIds.length} service${selectedIds.length !== 1 ? "s" : ""}`}
          </button>
        </AdminOverlayFooter>
      </AdminDialog>

      <ConfirmUnsavedChangesDialog
        open={showDiscardDialog}
        onOpenChange={setShowDiscardDialog}
        onConfirm={onClose}
        description="You have unsaved service selections. If you close now, your changes will be lost."
      />
    </>
  );
}

function ServiceCheckbox({
  service,
  selected,
  onToggle,
}: {
  service: ServiceRow;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <label
      className={cn(
        "flex items-center gap-2.5 px-2.5 py-2 rounded-md border cursor-pointer transition",
        selected
          ? "border-[var(--cs-sand)] bg-[rgba(200,169,107,0.08)]"
          : "border-[var(--cs-border)] bg-[var(--cs-surface)]"
      )}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        className="shrink-0 accent-[var(--cs-sand)]"
      />
      <span className="text-[0.8125rem] text-[var(--cs-text)] leading-tight">
        {service.name}
      </span>
      {service.duration_minutes ? (
        <span className="ml-auto text-[0.6875rem] text-[var(--cs-text-muted)] shrink-0">
          {service.duration_minutes}m
        </span>
      ) : null}
    </label>
  );
}
