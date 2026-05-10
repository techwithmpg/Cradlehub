"use client";

import { Search } from "lucide-react";
import { BranchResourcesManager } from "@/app/(dashboard)/owner/branches/[branchId]/branch-resources-manager";
import { RESOURCE_TYPES } from "@/lib/validations/branch";
import type { ResourceRow } from "./spaces-rules-utils";

export type SpacesTabProps = {
  branchId: string;
  resources: ResourceRow[];
  allResources: ResourceRow[];
  canManage: boolean;
  searchQuery: string;
  typeFilter: string;
  statusFilter: string;
  onSearchChange: (value: string) => void;
  onTypeFilterChange: (value: string) => void;
  onStatusFilterChange: (value: string) => void;
  selectedResourceId: string | null;
  onResourceClick: (resourceId: string) => void;
};

export function SpacesTab({
  branchId,
  resources,
  allResources,
  canManage,
  searchQuery,
  typeFilter,
  statusFilter,
  onSearchChange,
  onTypeFilterChange,
  onStatusFilterChange,
  onResourceClick,
}: SpacesTabProps) {
  const typeCounts = new Map<string, number>();
  for (const r of allResources) {
    typeCounts.set(r.type, (typeCounts.get(r.type) ?? 0) + 1);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* Filter bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            flex: 1,
            minWidth: 200,
            maxWidth: 320,
            padding: "0 0.75rem",
            height: 36,
            borderRadius: 8,
            border: "1px solid var(--cs-border)",
            backgroundColor: "var(--cs-surface)",
          }}
        >
          <Search size={14} style={{ color: "var(--cs-text-muted)", flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Search spaces..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            style={{
              border: "none",
              background: "transparent",
              outline: "none",
              fontSize: "0.875rem",
              color: "var(--cs-text)",
              width: "100%",
            }}
          />
        </div>

        <select
          value={typeFilter}
          onChange={(e) => onTypeFilterChange(e.target.value)}
          style={{
            height: 36,
            borderRadius: 8,
            border: "1px solid var(--cs-border)",
            backgroundColor: "var(--cs-surface)",
            color: "var(--cs-text)",
            padding: "0 0.5rem",
            fontSize: "0.875rem",
          }}
        >
          <option value="">All types</option>
          {RESOURCE_TYPES.map((t) => (
            <option key={t} value={t}>
              {t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
              {typeCounts.get(t) ? ` (${typeCounts.get(t)})` : ""}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value)}
          style={{
            height: 36,
            borderRadius: 8,
            border: "1px solid var(--cs-border)",
            backgroundColor: "var(--cs-surface)",
            color: "var(--cs-text)",
            padding: "0 0.5rem",
            fontSize: "0.875rem",
          }}
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>

        {canManage && (
          <div style={{ marginLeft: "auto" }}>
            {/* BranchResourcesManager has its own Add Space button */}
          </div>
        )}
      </div>

      {/* Resource manager */}
      <BranchResourcesManager
        branchId={branchId}
        resources={resources}
        onRowClick={onResourceClick}
        readOnly={!canManage}
      />
    </div>
  );
}
