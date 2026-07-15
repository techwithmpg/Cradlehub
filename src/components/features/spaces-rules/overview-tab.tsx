"use client";

import {
  getResourceIcon,
  getResourceTypeLabel,
  computeResourceInventory,
  type ResourceRow,
  type ResourceConflict,
  type ConflictBooking,
} from "./spaces-rules-utils";
import { buildConflictSummaryIssues } from "./spaces-readiness-utils";
import { ReadinessIssueList } from "@/components/shared/readiness-issue-list";
import { Clock, CheckCircle2, Users, AlertTriangle, CircleDashed } from "lucide-react";

// ── Original Overview Tab (Owner/Manager) ──────────────────────────────────────

export function OverviewTab({
  resources,
  conflicts,
  bookings,
}: {
  resources: ResourceRow[];
  rules?: unknown;
  conflicts: ResourceConflict[];
  bookings: ConflictBooking[];
}) {
  const inventory = computeResourceInventory(resources);
  const todayBookings = bookings.filter(
    (b) => b.status === "confirmed" || b.status === "checked_in"
  );
  const upcoming = [...todayBookings]
    .sort((a, b) => a.start_time.localeCompare(b.start_time))
    .slice(0, 5);

  const alertIssues = buildConflictSummaryIssues(conflicts);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
        gap: "1rem",
      }}
    >
      {/* Inventory breakdown */}
      <div className="cs-card" style={{ padding: "1.25rem" }}>
        <div
          style={{
            fontSize: "0.8125rem",
            fontWeight: 600,
            color: "var(--cs-text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: "1rem",
          }}
        >
          Inventory Breakdown
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
          {inventory.map((item) => {
            const pct = item.total > 0 ? (item.active / item.total) * 100 : 0;
            return (
              <div key={item.type}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "0.8125rem",
                    marginBottom: 4,
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 14 }}>{getResourceIcon(item.type)}</span>
                    {getResourceTypeLabel(item.type)}
                  </span>
                  <span style={{ color: "var(--cs-text-muted)" }}>
                    {item.active}/{item.total}
                  </span>
                </div>
                <div
                  style={{
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: "var(--cs-surface-warm)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${pct}%`,
                      height: "100%",
                      borderRadius: 3,
                      backgroundColor: "var(--cs-sand)",
                      transition: "width 0.3s ease",
                    }}
                  />
                </div>
              </div>
            );
          })}
          {inventory.length === 0 && (
            <div style={{ fontSize: "0.8125rem", color: "var(--cs-text-muted)" }}>
              No resources yet.
            </div>
          )}
        </div>
      </div>

      {/* Today's schedule preview */}
      <div className="cs-card" style={{ padding: "1.25rem" }}>
        <div
          style={{
            fontSize: "0.8125rem",
            fontWeight: 600,
            color: "var(--cs-text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: "1rem",
          }}
        >
          Today&apos;s Schedule
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {upcoming.map((b) => (
            <div
              key={b.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.5rem 0.625rem",
                borderRadius: 6,
                backgroundColor: "var(--cs-surface-warm)",
              }}
            >
              <Clock size={13} style={{ color: "var(--cs-text-muted)", flexShrink: 0 }} />
              <span style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)", width: 70 }}>
                {b.start_time.slice(0, 5)}
              </span>
              <span style={{ fontSize: "0.8125rem", fontWeight: 500, flex: 1, minWidth: 0 }}>
                {b.service_name ?? "Booking"}
              </span>
              <span style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)" }}>
                {b.customer_name ?? "Guest"}
              </span>
            </div>
          ))}
          {upcoming.length === 0 && (
            <div style={{ fontSize: "0.8125rem", color: "var(--cs-text-muted)" }}>
              No confirmed bookings today.
            </div>
          )}
        </div>
      </div>

      {/* Alerts summary */}
      <div className="cs-card" style={{ padding: "1.25rem" }}>
        <div
          style={{
            fontSize: "0.8125rem",
            fontWeight: 600,
            color: "var(--cs-text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: "0.75rem",
          }}
        >
          Alerts
        </div>
        <ReadinessIssueList
          issues={alertIssues}
          compact
          emptyTitle="No alerts right now"
          emptyDescription="All bookings have room assignments and no overlaps detected."
        />
      </div>
    </div>
  );
}

// ── CRM Overview Tab ───────────────────────────────────────────────────────────

export function CrmOverviewTab({
  resources,
  bookings,
  conflicts,
}: {
  resources: ResourceRow[];
  bookings: ConflictBooking[];
  conflicts: ResourceConflict[];
}) {
  const activeResources = resources.filter((r) => r.is_active);
  const inventory = computeResourceInventory(resources);

  // Calculate occupancy
  const activeBookings = bookings.filter(
    (b) =>
      b.status === "confirmed" ||
      b.status === "checked_in" ||
      b.status === "in_progress"
  );
  const occupiedResourceIds = new Set(
    activeBookings.filter((b) => b.resource_id).map((b) => b.resource_id)
  );
  const occupiedCount = activeResources.filter((r) =>
    occupiedResourceIds.has(r.id)
  ).length;
  const availableCount = activeResources.length - occupiedCount;

  const criticalConflicts = conflicts.filter((c) => c.severity === "critical").length;
  const missingAssignments = conflicts.filter(
    (c) => c.type === "missing_assignment"
  ).length;

  const alertIssues = buildConflictSummaryIssues(conflicts);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "1rem",
      }}
      className="crm-overview-grid"
    >
      {/* Today's Resource Readiness */}
      <div
        className="cs-card"
        style={{
          padding: "1.25rem",
          gridColumn: "span 2",
        }}
      >
        <div
          style={{
            fontSize: "0.75rem",
            fontWeight: 700,
            color: "var(--cs-text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: "1rem",
          }}
        >
          Today&apos;s Resource Readiness
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "0.75rem",
          }}
          className="crm-readiness-grid"
        >
          <ReadinessCard
            label="Available"
            value={availableCount}
            icon={CheckCircle2}
            color="#4A7C59"
            bgTint="rgba(74, 124, 89, 0.06)"
          />
          <ReadinessCard
            label="Occupied"
            value={occupiedCount}
            icon={Users}
            color="#B08850"
            bgTint={occupiedCount > 0 ? "rgba(176, 136, 80, 0.06)" : undefined}
          />
          <ReadinessCard
            label="Conflicts"
            value={criticalConflicts}
            icon={AlertTriangle}
            color={criticalConflicts > 0 ? "#DC2626" : "var(--cs-text-muted)"}
            bgTint={criticalConflicts > 0 ? "rgba(220, 38, 38, 0.06)" : undefined}
          />
          <ReadinessCard
            label="Missing Room"
            value={missingAssignments}
            icon={CircleDashed}
            color={missingAssignments > 0 ? "#D97706" : "var(--cs-text-muted)"}
            bgTint={missingAssignments > 0 ? "rgba(217, 119, 6, 0.06)" : undefined}
          />
        </div>
      </div>

      {/* Resource Type Summary */}
      <div className="cs-card" style={{ padding: "1.25rem" }}>
        <div
          style={{
            fontSize: "0.75rem",
            fontWeight: 700,
            color: "var(--cs-text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: "1rem",
          }}
        >
          Resource Types
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {inventory.map((item) => (
            <div
              key={item.type}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0.5rem 0.75rem",
                borderRadius: 6,
                backgroundColor: "var(--cs-surface-warm)",
              }}
            >
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: "0.8125rem",
                  fontWeight: 500,
                }}
              >
                <span style={{ fontSize: 14 }}>{getResourceIcon(item.type)}</span>
                {getResourceTypeLabel(item.type)}
              </span>
              <span
                style={{
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  color: item.active === item.total ? "#4A7C59" : "var(--cs-text-secondary)",
                }}
              >
                {item.active}/{item.total}
              </span>
            </div>
          ))}
          {inventory.length === 0 && (
            <div
              style={{
                padding: "1rem",
                textAlign: "center",
                fontSize: "0.8125rem",
                color: "var(--cs-text-muted)",
              }}
            >
              No resources configured yet.
            </div>
          )}
        </div>
      </div>

      {/* Alerts Summary */}
      <div className="cs-card" style={{ padding: "1.25rem" }}>
        <div
          style={{
            fontSize: "0.75rem",
            fontWeight: 700,
            color: "var(--cs-text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: "0.75rem",
          }}
        >
          Alerts
        </div>
        <ReadinessIssueList
          issues={alertIssues}
          compact
          maxItems={3}
          emptyTitle="All clear"
          emptyDescription="No resource conflicts or missing assignments."
        />
      </div>

      <style>{`
        @media (max-width: 768px) {
          .crm-overview-grid {
            grid-template-columns: 1fr !important;
          }
          .crm-overview-grid > div {
            grid-column: span 1 !important;
          }
          .crm-readiness-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
      `}</style>
    </div>
  );
}

function ReadinessCard({
  label,
  value,
  icon: Icon,
  color,
  bgTint,
}: {
  label: string;
  value: number;
  icon: typeof CheckCircle2;
  color: string;
  bgTint?: string;
}) {
  return (
    <div
      style={{
        padding: "0.875rem 1rem",
        borderRadius: "var(--cs-r-md)",
        border: "1px solid var(--cs-border-soft)",
        backgroundColor: bgTint ?? "var(--cs-surface)",
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          backgroundColor: "var(--cs-surface-warm)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon size={16} style={{ color }} />
      </div>
      <div>
        <div
          style={{
            fontSize: "1.25rem",
            fontWeight: 700,
            color,
            lineHeight: 1.2,
          }}
        >
          {value}
        </div>
        <div
          style={{
            fontSize: "0.6875rem",
            color: "var(--cs-text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          {label}
        </div>
      </div>
    </div>
  );
}
