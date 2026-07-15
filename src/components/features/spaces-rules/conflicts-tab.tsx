"use client";

import { ReadinessIssueList } from "@/components/shared/readiness-issue-list";
import { mapResourceConflictToReadinessIssue } from "./spaces-readiness-utils";
import { type ResourceConflict, type ResourceRow } from "./spaces-rules-utils";
import { AlertTriangle, AlertCircle, Info } from "lucide-react";

// ── Original Conflicts Tab (Owner/Manager) ─────────────────────────────────────

export function ConflictsTab({
  conflicts,
}: {
  conflicts: ResourceConflict[];
  resources?: unknown;
  bookings?: unknown;
}) {
  const issues = conflicts.map((conflict, index) =>
    mapResourceConflictToReadinessIssue(conflict, index)
  );

  return (
    <ReadinessIssueList
      issues={issues}
      emptyTitle="No conflicts detected"
      emptyDescription="All bookings have room assignments and no overlaps or capacity overflows are found for today."
    />
  );
}

// ── CRM Conflicts Tab ──────────────────────────────────────────────────────────

export function CrmConflictsTab({
  conflicts,
  resources,
}: {
  conflicts: ResourceConflict[];
  resources: ResourceRow[];
}) {
  // Group conflicts by severity
  const criticalConflicts = conflicts.filter((c) => c.severity === "critical");
  const warningConflicts = conflicts.filter((c) => c.severity === "warning");

  // Further categorize critical conflicts
  const overlapConflicts = criticalConflicts.filter((c) => c.type === "overlap");
  const capacityConflicts = criticalConflicts.filter(
    (c) => c.type === "capacity_overflow"
  );
  const missingAssignments = warningConflicts.filter(
    (c) => c.type === "missing_assignment"
  );

  const hasConflicts =
    overlapConflicts.length > 0 ||
    capacityConflicts.length > 0 ||
    missingAssignments.length > 0;

  if (!hasConflicts) {
    return (
      <div
        className="cs-card"
        style={{
          padding: "2rem",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            backgroundColor: "rgba(74, 124, 89, 0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 1rem",
          }}
        >
          <AlertTriangle size={20} style={{ color: "#4A7C59" }} />
        </div>
        <div
          style={{
            fontSize: "0.9375rem",
            fontWeight: 600,
            color: "#4A7C59",
            marginBottom: 4,
          }}
        >
          No resource conflicts for today
        </div>
        <div
          style={{
            fontSize: "0.8125rem",
            color: "var(--cs-text-muted)",
            maxWidth: 320,
            margin: "0 auto",
          }}
        >
          All bookings have room assignments and no overlaps or capacity issues detected.
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* Critical: Overlaps */}
      {overlapConflicts.length > 0 && (
        <ConflictGroup
          title="Critical: Booking Overlaps"
          icon={AlertTriangle}
          iconColor="#DC2626"
          bgTint="rgba(220, 38, 38, 0.04)"
          borderColor="rgba(220, 38, 38, 0.2)"
          conflicts={overlapConflicts}
          resources={resources}
        />
      )}

      {/* Critical: Capacity */}
      {capacityConflicts.length > 0 && (
        <ConflictGroup
          title="Critical: Capacity Overflow"
          icon={AlertCircle}
          iconColor="#DC2626"
          bgTint="rgba(220, 38, 38, 0.04)"
          borderColor="rgba(220, 38, 38, 0.2)"
          conflicts={capacityConflicts}
          resources={resources}
        />
      )}

      {/* Warning: Missing Assignments */}
      {missingAssignments.length > 0 && (
        <ConflictGroup
          title="Warning: Missing Room Assignments"
          icon={Info}
          iconColor="#D97706"
          bgTint="rgba(217, 119, 6, 0.04)"
          borderColor="rgba(217, 119, 6, 0.2)"
          conflicts={missingAssignments}
          resources={resources}
        />
      )}
    </div>
  );
}

function ConflictGroup({
  title,
  icon: Icon,
  iconColor,
  bgTint,
  borderColor,
  conflicts,
  resources,
}: {
  title: string;
  icon: typeof AlertTriangle;
  iconColor: string;
  bgTint: string;
  borderColor: string;
  conflicts: ResourceConflict[];
  resources: ResourceRow[];
}) {
  return (
    <div
      style={{
        borderRadius: "var(--cs-r-md)",
        border: `1px solid ${borderColor}`,
        backgroundColor: bgTint,
        overflow: "hidden",
      }}
    >
      {/* Group header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "0.75rem 1rem",
          borderBottom: `1px solid ${borderColor}`,
        }}
      >
        <Icon size={16} style={{ color: iconColor, flexShrink: 0 }} />
        <span
          style={{
            fontSize: "0.8125rem",
            fontWeight: 600,
            color: iconColor,
            flex: 1,
          }}
        >
          {title}
        </span>
        <span
          style={{
            fontSize: "0.6875rem",
            fontWeight: 700,
            color: iconColor,
            backgroundColor: "rgba(255, 255, 255, 0.6)",
            padding: "2px 8px",
            borderRadius: 10,
          }}
        >
          {conflicts.length}
        </span>
      </div>

      {/* Conflict rows */}
      <div style={{ backgroundColor: "var(--cs-surface)" }}>
        {conflicts.map((conflict, index) => (
          <ConflictRow
            key={conflict.id}
            conflict={conflict}
            resources={resources}
            isLast={index === conflicts.length - 1}
          />
        ))}
      </div>
    </div>
  );
}

function ConflictRow({
  conflict,
  resources,
  isLast,
}: {
  conflict: ResourceConflict;
  resources: ResourceRow[];
  isLast: boolean;
}) {
  const resourceName =
    conflict.type === "overlap" || conflict.type === "capacity_overflow"
      ? conflict.resourceName
      : null;

  const resource =
    conflict.type === "overlap" || conflict.type === "capacity_overflow"
      ? resources.find((r) => r.id === conflict.resourceId)
      : null;

  return (
    <div
      style={{
        padding: "0.75rem 1rem",
        borderBottom: isLast ? "none" : "1px solid var(--cs-border-soft)",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <div
        style={{
          fontSize: "0.8125rem",
          fontWeight: 500,
          color: "var(--cs-text)",
        }}
      >
        {conflict.description}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        {resourceName && (
          <span
            style={{
              fontSize: "0.75rem",
              color: "var(--cs-text-muted)",
            }}
          >
            Resource: <strong>{resourceName}</strong>
            {resource && ` (Cap: ${resource.capacity})`}
          </span>
        )}

        <span
          style={{
            fontSize: "0.75rem",
            color: "var(--cs-text-muted)",
          }}
        >
          Type:{" "}
          <strong>
            {conflict.type === "overlap"
              ? "Double booking"
              : conflict.type === "capacity_overflow"
                ? "Over capacity"
                : "Missing room"}
          </strong>
        </span>

        <span
          style={{
            marginLeft: "auto",
            fontSize: "0.6875rem",
            fontWeight: 600,
            color:
              conflict.severity === "critical" ? "#DC2626" : "#D97706",
            backgroundColor:
              conflict.severity === "critical"
                ? "rgba(220, 38, 38, 0.1)"
                : "rgba(217, 119, 6, 0.1)",
            padding: "2px 8px",
            borderRadius: 10,
          }}
        >
          {conflict.severity === "critical" ? "Critical" : "Warning"}
        </span>
      </div>

      {/* Recommended action */}
      <div
        style={{
          fontSize: "0.75rem",
          color: "var(--cs-text-secondary)",
          fontStyle: "italic",
          marginTop: 2,
        }}
      >
        {conflict.type === "overlap"
          ? "→ Reassign one booking to a different room or reschedule."
          : conflict.type === "capacity_overflow"
            ? "→ Reduce concurrent bookings or check resource capacity setting."
            : "→ Assign a room to this booking before customer arrives."}
      </div>
    </div>
  );
}
