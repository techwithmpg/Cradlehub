"use client";

import { useMemo, useState, useCallback, useRef } from "react";
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
import { buildServiceTableRows } from "./crm-therapist-assignment-tab";
import { ProviderAssignmentSheet } from "./provider-assignment-sheet";
import { Button } from "@/components/ui/button";
import { CheckCircle2, CircleAlert, UsersRound } from "lucide-react";

export type DeliveryMode = "in_spa" | "home_service" | "both" | "hidden";
export type StatusFilter = "all" | "public" | "hidden" | "inactive" | "ready" | "needs_setup";

export function ServiceCustomizationTab({
  branchId,
  branchName,
  services,
  activeServices,
  staff,
  assignments,
  onServicePatch,
  onAssignmentChange,
}: {
  branchId: string;
  branchName: string;
  services: ServiceLite[];
  activeServices: ActiveBranchService[];
  staff: StaffForServicePanel[];
  assignments: ServiceAssignmentRow[];
  onServicePatch: (serviceId: string, patch: Partial<ServiceLite>) => void;
  onAssignmentChange?: (assignment: ServiceAssignmentRow, assigned: boolean) => void;
}) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [modeFilter, setModeFilter] = useState<DeliveryMode | "all">("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<"overview" | "providers" | "settings">("overview");
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const detailRef = useRef<HTMLElement>(null);

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
    () => rows.find((r) => r.branchServiceId === selectedServiceId) ?? rows[0] ?? null,
    [rows, selectedServiceId]
  );

  const assignmentRows = useMemo(
    () => buildServiceTableRows(activeServices, staff, assignments),
    [activeServices, staff, assignments]
  );
  const selectedAssignment = assignmentRows.find((row) => row.serviceId === selectedRow?.serviceId) ?? null;

  const handleSelect = useCallback((row: CustomizationRow | null) => {
    setSelectedServiceId(row?.branchServiceId ?? null);
    setDetailTab("overview");
    if (typeof window.matchMedia === "function" && window.matchMedia("(max-width: 1279px)").matches) {
      requestAnimationFrame(() => detailRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }));
    }
  }, []);

  return (
    <div className="space-y-4">
      <ServiceCustomizationMetricGrid rows={rows} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_350px]">
      <main className="min-w-0 space-y-4">
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
          onServicePatch={onServicePatch}
        />
      </main>

      <aside ref={detailRef} className="order-first min-w-0 scroll-mt-4 xl:order-last xl:sticky xl:top-20 xl:self-start">
        {selectedRow ? (
          <div className="overflow-hidden rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface)] shadow-[var(--cs-shadow-sm)]">
            <div className="border-b border-[var(--cs-border-soft)] p-4">
              <h2 className="m-0 text-lg font-semibold text-[var(--cs-text)]">{selectedRow.name}</h2>
              <p className="m-0 mt-1 text-xs text-[var(--cs-text-muted)]">{selectedRow.description ?? selectedRow.category ?? "Service details"}</p>
            </div>
            <div role="group" aria-label="Service details" className="flex border-b border-[var(--cs-border-soft)] px-3">
              {(["overview", "providers", "settings"] as const).map((tab) => (
                <button key={tab} type="button" aria-pressed={detailTab === tab}
                  onClick={() => setDetailTab(tab)}
                  className={`px-3 py-3 text-xs font-medium capitalize ${detailTab === tab ? "border-b-2 border-[var(--cs-success-text)] text-[var(--cs-text)]" : "text-[var(--cs-text-muted)]"}`}
                >{tab}</button>
              ))}
            </div>
            {detailTab === "overview" && (
              <div className="space-y-4 p-4 text-sm">
                <dl className="grid grid-cols-2 gap-3">
                  <div><dt className="text-xs text-[var(--cs-text-muted)]">Duration</dt><dd className="m-0 font-medium">{selectedRow.duration} minutes</dd></div>
                  <div><dt className="text-xs text-[var(--cs-text-muted)]">Price</dt><dd className="m-0 font-medium">₱{selectedRow.price.toLocaleString()}</dd></div>
                  <div><dt className="text-xs text-[var(--cs-text-muted)]">Category</dt><dd className="m-0 font-medium">{selectedRow.category ?? "—"}</dd></div>
                  <div><dt className="text-xs text-[var(--cs-text-muted)]">Providers</dt><dd className="m-0 font-medium">{selectedRow.providerCount}</dd></div>
                </dl>
                <div className="rounded-lg bg-[var(--cs-surface-warm)] p-3">
                  <p className="m-0 font-medium">Service setup</p>
                  <p className="m-0 mt-1 text-xs text-[var(--cs-text-muted)]">{selectedRow.isActive ? "Active" : "Inactive"} · {selectedRow.visibility === "public" ? "Public" : "Internal or hidden"} · {selectedRow.deliveryMode.replaceAll("_", " ")}</p>
                  <p className="m-0 mt-2 text-xs text-[var(--cs-text-muted)]">Live booking availability also depends on schedules, rooms, and booking rules.</p>
                </div>
                {selectedRow.readinessIssues.length > 0 ? selectedRow.readinessIssues.map((issue) => (
                  <p key={issue} className="m-0 flex items-center gap-2 text-xs text-[var(--cs-warning-text)]"><CircleAlert className="size-4" />{issue}</p>
                )) : <p className="m-0 flex items-center gap-2 text-xs text-[var(--cs-success-text)]"><CheckCircle2 className="size-4" />Basic service setup complete</p>}
                <Button type="button" className="w-full" disabled={!selectedAssignment} onClick={() => setAssignmentOpen(true)}><UsersRound className="mr-2 size-4" />Manage providers</Button>
              </div>
            )}
            {detailTab === "providers" && (
              <div className="space-y-3 p-4">
                <p className="m-0 text-xs text-[var(--cs-text-muted)]">{selectedRow.providerCount} assigned eligible provider{selectedRow.providerCount === 1 ? "" : "s"}</p>
                {selectedRow.assignedProviders.map((provider) => <p key={provider.id} className="m-0 rounded-lg border border-[var(--cs-border-soft)] px-3 py-2 text-sm">{provider.full_name}</p>)}
                <Button type="button" className="w-full" disabled={!selectedAssignment} onClick={() => setAssignmentOpen(true)}>Assign providers</Button>
              </div>
            )}
            {detailTab === "settings" && <SelectedServiceEditorRail branchId={branchId} branchName={branchName} row={selectedRow} onClose={() => setDetailTab("overview")} onServicePatch={onServicePatch} onManageProviders={() => setAssignmentOpen(true)} />}
          </div>
        ) : <div className="rounded-xl border border-dashed border-[var(--cs-border)] p-6 text-sm text-[var(--cs-text-muted)]">No services found for this branch.</div>}
      </aside>
      {selectedAssignment && onAssignmentChange && (
        <ProviderAssignmentSheet row={selectedAssignment} branchId={branchId} open={assignmentOpen} onClose={() => setAssignmentOpen(false)} onAssignmentChange={onAssignmentChange} />
      )}
      </div>
    </div>
  );
}
