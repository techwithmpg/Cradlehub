"use client";

import { useMemo, useState, useCallback } from "react";
import type {
  ServiceLite,
} from "@/app/(dashboard)/owner/branches/[branchId]/branch-services-panel";
import type { ActiveBranchService } from "@/components/features/manager-settings/types";
import type { StaffForServicePanel, ServiceAssignmentRow } from "@/lib/queries/crm-services";
import { ServiceCustomizationMetricGrid } from "./service-customization-metric-grid";
import { ServiceCustomizationFilterBar } from "./service-customization-filter-bar";
import { ServiceCustomizationTable } from "./service-customization-table";
import { SelectedServiceEditorRail } from "./selected-service-editor-rail";
import { buildCustomizationRows, type CustomizationRow } from "./customization-rows";

export type DeliveryMode = "in_spa" | "home_service" | "both" | "hidden";
export type StatusFilter = "all" | "public" | "hidden" | "inactive" | "ready" | "needs_setup";

export function ServiceCustomizationTab({
  branchId,
  branchName,
  services,
  staff,
  assignments,
}: {
  branchId: string;
  branchName: string;
  services: ServiceLite[];
  activeServices: ActiveBranchService[];
  staff: StaffForServicePanel[];
  assignments: ServiceAssignmentRow[];
}) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [modeFilter, setModeFilter] = useState<DeliveryMode | "all">("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);

  const rows = useMemo(
    () => buildCustomizationRows(services, staff, assignments),
    [services, staff, assignments]
  );

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      if (r.category) set.add(r.category);
    }
    return Array.from(set).sort();
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      const matchesSearch =
        !q ||
        r.name.toLowerCase().includes(q) ||
        (r.category?.toLowerCase().includes(q) ?? false);

      const matchesCategory =
        categoryFilter === "all" || r.category === categoryFilter;

      const matchesMode =
        modeFilter === "all" || r.deliveryMode === modeFilter;

      const matchesStatus = ((): boolean => {
        if (statusFilter === "all") return true;
        if (statusFilter === "public") return r.visibility === "public" && r.isActive;
        if (statusFilter === "hidden") return !r.isActive;
        if (statusFilter === "inactive") return !r.isActive;
        if (statusFilter === "ready") return r.isReady;
        if (statusFilter === "needs_setup") return !r.isReady && r.isActive;
        return true;
      })();

      return matchesSearch && matchesCategory && matchesMode && matchesStatus;
    });
  }, [rows, search, categoryFilter, modeFilter, statusFilter]);

  const selectedRow = useMemo(
    () => rows.find((r) => r.branchServiceId === selectedServiceId) ?? null,
    [rows, selectedServiceId]
  );

  const handleSelect = useCallback((row: CustomizationRow | null) => {
    setSelectedServiceId(row?.branchServiceId ?? null);
  }, []);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <main className="min-w-0 space-y-5">
        <ServiceCustomizationMetricGrid rows={rows} />
        <ServiceCustomizationFilterBar
          search={search}
          onSearchChange={setSearch}
          categories={categories}
          categoryFilter={categoryFilter}
          onCategoryChange={setCategoryFilter}
          modeFilter={modeFilter}
          onModeChange={setModeFilter}
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
        />
        <ServiceCustomizationTable
          branchId={branchId}
          rows={filteredRows}
          selectedRow={selectedRow}
          onSelect={handleSelect}
        />
      </main>

      <aside className="min-w-0 lg:sticky lg:top-20 lg:self-start">
        <SelectedServiceEditorRail
          branchId={branchId}
          branchName={branchName}
          row={selectedRow}
          onClose={() => setSelectedServiceId(null)}
        />
      </aside>
    </div>
  );
}
