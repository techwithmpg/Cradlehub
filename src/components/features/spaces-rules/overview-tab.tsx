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
import { Clock } from "lucide-react";

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
