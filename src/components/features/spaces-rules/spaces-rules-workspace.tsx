"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { SpacesRulesHeader } from "./spaces-rules-header";
import { SpacesRulesKpiCards, CrmOperationalKpiStrip } from "./spaces-rules-kpi-cards";
import { SpacesRulesTabs, CrmSpacesTabs } from "./spaces-rules-tabs";
import { OverviewTab, CrmOverviewTab } from "./overview-tab";
import { SpacesTab, CrmSpacesTab } from "./spaces-tab";
import { BookingRulesTab } from "./booking-rules-tab";
import { ConflictsTab, CrmConflictsTab } from "./conflicts-tab";
import { SpaceDetailPanel, CrmSpaceDetailPanel } from "./space-detail-panel";
import { CrmSpacesQuickActions } from "./crm-spaces-quick-actions";
import {
  computeResourceConflicts,
  computeKpiData,
  computeCrmOperationalKpi,
  type ResourceRow,
  type ConflictBooking,
  type SpacesRulesTab,
  type CrmSpacesTab as CrmTabType,
} from "./spaces-rules-utils";
import type { BranchBookingRules } from "@/lib/validations/booking-rules";

export type SpacesRulesWorkspaceProps = {
  workspaceContext: "owner" | "manager" | "crm";
  viewerRole: string;
  branchId: string;
  branchName: string;
  branches?: { id: string; name: string }[];
  resources: ResourceRow[];
  rules: BranchBookingRules;
  bookings: ConflictBooking[];
  canSwitchBranch: boolean;
  canManageResources: boolean;
  canEditRules: boolean;
  /** Optional starting tab — used when embedded inside Setup Center workspace. */
  initialTab?: SpacesRulesTab;
};

export function SpacesRulesWorkspace({
  workspaceContext,
  branchId,
  branchName,
  branches,
  resources,
  rules,
  bookings,
  canSwitchBranch,
  canManageResources,
  canEditRules,
  initialTab,
}: SpacesRulesWorkspaceProps) {
  // CRM gets a simplified operational view for spaces. The separate Booking
  // Rules tab in Setup Center still uses the full workspace so `initialTab`
  // remains authoritative.
  const isCrmOperationalView =
    workspaceContext === "crm" && initialTab !== "rules";

  const router = useRouter();
  const [activeTab, setActiveTab] = useState<SpacesRulesTab | CrmTabType>(
    initialTab ?? "overview"
  );
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  const handleBranchChange = useCallback(
    (nextBranchId: string) => {
      const params = new URLSearchParams(window.location.search);
      params.set("branchId", nextBranchId);
      router.push(`?${params.toString()}`);
    },
    [router]
  );

  const filteredResources = useMemo(() => {
    let result = resources;
    if (searchQuery.trim()) {
      const term = searchQuery.toLowerCase();
      result = result.filter((r) => r.name.toLowerCase().includes(term));
    }
    if (typeFilter) {
      result = result.filter((r) => r.type === typeFilter);
    }
    if (statusFilter === "active") {
      result = result.filter((r) => r.is_active);
    } else if (statusFilter === "inactive") {
      result = result.filter((r) => !r.is_active);
    }
    return result;
  }, [resources, searchQuery, typeFilter, statusFilter]);

  const conflicts = useMemo(
    () => computeResourceConflicts(bookings, resources),
    [bookings, resources]
  );

  const kpiData = useMemo(
    () => computeKpiData(resources, rules, conflicts),
    [resources, rules, conflicts]
  );

  const crmKpiData = useMemo(
    () => computeCrmOperationalKpi(resources, bookings, conflicts),
    [resources, bookings, conflicts]
  );

  const selectedResource = useMemo(() => {
    if (!selectedResourceId) return null;
    return resources.find((r) => r.id === selectedResourceId) ?? null;
  }, [selectedResourceId, resources]);

  const handleResourceClick = useCallback((resourceId: string) => {
    setSelectedResourceId((current) =>
      current === resourceId ? null : resourceId
    );
  }, []);

  // ── CRM Layout ───────────────────────────────────────────────────────────────
  if (isCrmOperationalView) {
    return (
      <div className="crm-spaces-availability">
        {/* Compact header with branch-locked badge */}
        <SpacesRulesHeader
          workspaceContext="crm"
          branchId={branchId}
          branchName={branchName}
          branches={branches}
          canSwitchBranch={false}
          onBranchChange={handleBranchChange}
        />

        {/* Operational KPI strip */}
        <div style={{ marginTop: "1rem" }}>
          <CrmOperationalKpiStrip data={crmKpiData} />
        </div>

        {/* CRM tabs: Overview, Spaces, Conflicts */}
        <div style={{ marginTop: "1rem" }}>
          <CrmSpacesTabs
            activeTab={activeTab as CrmTabType}
            onTabChange={setActiveTab}
            conflictCount={conflicts.filter((c) => c.severity === "critical").length}
          />
        </div>

        {/* Main content area */}
        <div
          style={{
            marginTop: "1rem",
            display: "grid",
            gridTemplateColumns: "1fr 320px",
            gap: "1rem",
            alignItems: "start",
          }}
          className="crm-spaces-grid"
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem", minWidth: 0 }}>
            {activeTab === "overview" && (
              <CrmOverviewTab
                resources={resources}
                bookings={bookings}
                conflicts={conflicts}
              />
            )}

            {activeTab === "spaces" && (
              <CrmSpacesTab
                branchId={branchId}
                resources={filteredResources}
                allResources={resources}
                bookings={bookings}
                conflicts={conflicts}
                canManage={canManageResources}
                searchQuery={searchQuery}
                typeFilter={typeFilter}
                statusFilter={statusFilter}
                onSearchChange={setSearchQuery}
                onTypeFilterChange={setTypeFilter}
                onStatusFilterChange={setStatusFilter}
                selectedResourceId={selectedResourceId}
                onResourceClick={handleResourceClick}
              />
            )}

            {activeTab === "conflicts" && (
              <CrmConflictsTab conflicts={conflicts} resources={resources} />
            )}
          </div>

          {/* Right sidebar */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <CrmSpaceDetailPanel
              resource={selectedResource}
              branchName={branchName}
              bookings={bookings}
              conflicts={conflicts}
              canManage={canManageResources}
              onClose={() => setSelectedResourceId(null)}
            />
            <CrmSpacesQuickActions />
          </div>
        </div>

        {/* Responsive styles */}
        <style>{`
          @media (max-width: 900px) {
            .crm-spaces-grid {
              grid-template-columns: 1fr !important;
            }
          }
        `}</style>
      </div>
    );
  }

  // ── Owner / Manager Layout (unchanged) ───────────────────────────────────────
  // All contexts can view booking rules (read-only for non-edit roles)
  const canViewBookingRules = true;
  const showActiveRulesKpi = true;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <SpacesRulesHeader
        workspaceContext={workspaceContext}
        branchId={branchId}
        branchName={branchName}
        branches={branches}
        canSwitchBranch={canSwitchBranch}
        onBranchChange={handleBranchChange}
      />

      <SpacesRulesKpiCards data={kpiData} showActiveRules={showActiveRulesKpi} />

      <SpacesRulesTabs
        activeTab={activeTab as SpacesRulesTab}
        onTabChange={setActiveTab}
        canViewBookingRules={canViewBookingRules}
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) 320px",
          gap: "1rem",
          alignItems: "start",
        }}
      >
        <div
          style={{ display: "flex", flexDirection: "column", gap: "1rem", minWidth: 0 }}
        >
          {activeTab === "overview" && (
            <OverviewTab
              resources={resources}
              rules={rules}
              conflicts={conflicts}
              bookings={bookings}
            />
          )}

          {activeTab === "spaces" && (
            <SpacesTab
              branchId={branchId}
              resources={filteredResources}
              allResources={resources}
              canManage={canManageResources}
              searchQuery={searchQuery}
              typeFilter={typeFilter}
              statusFilter={statusFilter}
              onSearchChange={setSearchQuery}
              onTypeFilterChange={setTypeFilter}
              onStatusFilterChange={setStatusFilter}
              selectedResourceId={selectedResourceId}
              onResourceClick={handleResourceClick}
            />
          )}

          {activeTab === "rules" && canViewBookingRules && (
            <BookingRulesTab rules={rules} canEdit={canEditRules} />
          )}

          {activeTab === "conflicts" && (
            <ConflictsTab
              conflicts={conflicts}
              resources={resources}
              bookings={bookings}
            />
          )}
        </div>

        <SpaceDetailPanel
          resource={selectedResource}
          branchName={branchName}
          bookings={bookings}
          canManage={canManageResources}
          onClose={() => setSelectedResourceId(null)}
        />
      </div>
    </div>
  );
}
