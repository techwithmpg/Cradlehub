"use client";

import { useState, useCallback, useMemo } from "react";
import { SpacesRulesHeader } from "./spaces-rules-header";
import { SpacesRulesKpiCards } from "./spaces-rules-kpi-cards";
import { SpacesRulesTabs } from "./spaces-rules-tabs";
import { OverviewTab } from "./overview-tab";
import { SpacesTab } from "./spaces-tab";
import { BookingRulesTab } from "./booking-rules-tab";
import { ConflictsTab } from "./conflicts-tab";
import { SpaceDetailPanel } from "./space-detail-panel";
import {
  computeResourceConflicts,
  computeKpiData,
  type ResourceRow,
  type ConflictBooking,
  type SpacesRulesTab,
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
}: SpacesRulesWorkspaceProps) {
  const canViewBookingRules = workspaceContext !== "crm";
  const showActiveRulesKpi = workspaceContext !== "crm";

  const [activeTab, setActiveTab] = useState<SpacesRulesTab>("overview");
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(
    null
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  const handleBranchChange = useCallback(
    (nextBranchId: string) => {
      const params = new URLSearchParams(window.location.search);
      params.set("branchId", nextBranchId);
      window.location.search = params.toString();
    },
    []
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

  const selectedResource = useMemo(() => {
    if (!selectedResourceId) return null;
    return resources.find((r) => r.id === selectedResourceId) ?? null;
  }, [selectedResourceId, resources]);

  const handleResourceClick = useCallback((resourceId: string) => {
    setSelectedResourceId((current) =>
      current === resourceId ? null : resourceId
    );
  }, []);

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
        activeTab={activeTab}
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
            <BookingRulesTab
              rules={rules}
              canEdit={canEditRules}
            />
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
