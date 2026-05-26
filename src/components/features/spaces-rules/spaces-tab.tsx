"use client";

import { Search } from "lucide-react";
import { BranchResourcesManager } from "@/app/(dashboard)/owner/branches/[branchId]/branch-resources-manager";
import { RESOURCE_TYPES } from "@/lib/validations/branch";
import {
  getResourceIcon,
  getResourceTypeLabel,
  getResourceStatus,
  getResourceStatusLabel,
  getResourceStatusColor,
  type ResourceRow,
  type ConflictBooking,
  type ResourceConflict,
} from "./spaces-rules-utils";

// ── Original Spaces Tab (Owner/Manager) ────────────────────────────────────────

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

// ── CRM Spaces Tab ─────────────────────────────────────────────────────────────

export type CrmSpacesTabProps = {
  branchId: string;
  resources: ResourceRow[];
  allResources: ResourceRow[];
  bookings: ConflictBooking[];
  conflicts: ResourceConflict[];
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

export function CrmSpacesTab({
  resources,
  allResources,
  bookings,
  conflicts,
  searchQuery,
  typeFilter,
  statusFilter,
  onSearchChange,
  onTypeFilterChange,
  onStatusFilterChange,
  selectedResourceId,
  onResourceClick,
}: CrmSpacesTabProps) {
  const typeCounts = new Map<string, number>();
  for (const r of allResources) {
    typeCounts.set(r.type, (typeCounts.get(r.type) ?? 0) + 1);
  }

  // Get booking counts per resource
  const resourceBookingCounts = new Map<string, number>();
  const activeBookings = bookings.filter(
    (b) =>
      b.status === "confirmed" ||
      b.status === "checked_in" ||
      b.status === "in_progress"
  );
  for (const b of activeBookings) {
    if (b.resource_id) {
      resourceBookingCounts.set(
        b.resource_id,
        (resourceBookingCounts.get(b.resource_id) ?? 0) + 1
      );
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {/* Compact filter bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            flex: 1,
            minWidth: 180,
            maxWidth: 280,
            padding: "0 0.625rem",
            height: 32,
            borderRadius: 6,
            border: "1px solid var(--cs-border)",
            backgroundColor: "var(--cs-surface)",
          }}
        >
          <Search size={13} style={{ color: "var(--cs-text-muted)", flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            style={{
              border: "none",
              background: "transparent",
              outline: "none",
              fontSize: "0.8125rem",
              color: "var(--cs-text)",
              width: "100%",
            }}
          />
        </div>

        <select
          value={typeFilter}
          onChange={(e) => onTypeFilterChange(e.target.value)}
          style={{
            height: 32,
            borderRadius: 6,
            border: "1px solid var(--cs-border)",
            backgroundColor: "var(--cs-surface)",
            color: "var(--cs-text)",
            padding: "0 0.5rem",
            fontSize: "0.8125rem",
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
            height: 32,
            borderRadius: 6,
            border: "1px solid var(--cs-border)",
            backgroundColor: "var(--cs-surface)",
            color: "var(--cs-text)",
            padding: "0 0.5rem",
            fontSize: "0.8125rem",
          }}
        >
          <option value="">All</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>

        <span
          style={{
            marginLeft: "auto",
            fontSize: "0.75rem",
            color: "var(--cs-text-muted)",
          }}
        >
          {resources.length} resource{resources.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Compact resource list */}
      <div
        style={{
          backgroundColor: "var(--cs-surface)",
          border: "1px solid var(--cs-border-soft)",
          borderRadius: "var(--cs-r-md)",
          overflow: "hidden",
        }}
      >
        {resources.length === 0 ? (
          <div
            style={{
              padding: "2rem 1rem",
              textAlign: "center",
              color: "var(--cs-text-muted)",
              fontSize: "0.8125rem",
            }}
          >
            No resources match your filters.
          </div>
        ) : (
          resources.map((resource, index) => {
            const status = getResourceStatus(resource, bookings, conflicts);
            const statusLabel = getResourceStatusLabel(status);
            const statusColor = getResourceStatusColor(status);
            const bookingCount = resourceBookingCounts.get(resource.id) ?? 0;
            const isSelected = selectedResourceId === resource.id;

            return (
              <div
                key={resource.id}
                onClick={() => onResourceClick(resource.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: "0.625rem 0.875rem",
                  borderBottom:
                    index < resources.length - 1
                      ? "1px solid var(--cs-border-soft)"
                      : "none",
                  backgroundColor: isSelected
                    ? "var(--cs-sand-tint)"
                    : "transparent",
                  cursor: "pointer",
                  transition: "background-color 0.15s ease",
                }}
              >
                {/* Icon */}
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 6,
                    backgroundColor: "var(--cs-surface-warm)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    fontSize: 14,
                    opacity: resource.is_active ? 1 : 0.5,
                  }}
                >
                  {getResourceIcon(resource.type)}
                </div>

                {/* Name and type */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: "0.8125rem",
                      fontWeight: 500,
                      color: resource.is_active
                        ? "var(--cs-text)"
                        : "var(--cs-text-muted)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {resource.name}
                  </div>
                  <div
                    style={{
                      fontSize: "0.6875rem",
                      color: "var(--cs-text-muted)",
                    }}
                  >
                    {getResourceTypeLabel(resource.type)} · Cap: {resource.capacity}
                  </div>
                </div>

                {/* Booking count badge */}
                {bookingCount > 0 && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "2px 8px",
                      borderRadius: 12,
                      backgroundColor: "rgba(176, 136, 80, 0.1)",
                      fontSize: "0.6875rem",
                      fontWeight: 600,
                      color: "#B08850",
                    }}
                  >
                    {bookingCount} booking{bookingCount !== 1 ? "s" : ""}
                  </div>
                )}

                {/* Status badge */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "2px 8px",
                    borderRadius: 12,
                    backgroundColor:
                      status === "available"
                        ? "rgba(74, 124, 89, 0.1)"
                        : status === "in_use"
                          ? "rgba(176, 136, 80, 0.1)"
                          : status === "conflict"
                            ? "rgba(220, 38, 38, 0.1)"
                            : "var(--cs-surface-warm)",
                    fontSize: "0.6875rem",
                    fontWeight: 600,
                    color: statusColor,
                    whiteSpace: "nowrap",
                  }}
                >
                  {statusLabel}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
