"use client";

import { type ResourceConflict } from "./spaces-rules-utils";
import { AlertTriangle, CircleDashed, Wrench } from "lucide-react";

function ConflictRow({
  conflict,
}: {
  conflict: ResourceConflict;
}) {
  if (conflict.type === "missing_assignment") {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          padding: "0.75rem 1rem",
          borderRadius: 8,
          backgroundColor: "#FEF3C7",
          border: "1px solid #FDE68A",
        }}
      >
        <CircleDashed size={16} style={{ color: "#B45309", flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#78350F" }}>
            Missing Assignment
          </div>
          <div style={{ fontSize: "0.75rem", color: "#92400E" }}>
            {conflict.description}
          </div>
        </div>
        <div
          style={{
            fontSize: "0.6875rem",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            color: "#B45309",
            backgroundColor: "#FDE68A",
            padding: "2px 8px",
            borderRadius: 4,
          }}
        >
          Warning
        </div>
      </div>
    );
  }

  if (conflict.type === "overlap") {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          padding: "0.75rem 1rem",
          borderRadius: 8,
          backgroundColor: "#FEE2E2",
          border: "1px solid #FECACA",
        }}
      >
        <AlertTriangle size={16} style={{ color: "#DC2626", flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#7F1D1D" }}>
            Overlap
          </div>
          <div style={{ fontSize: "0.75rem", color: "#991B1B" }}>
            {conflict.description}
          </div>
        </div>
        <div
          style={{
            fontSize: "0.6875rem",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            color: "#991B1B",
            backgroundColor: "#FECACA",
            padding: "2px 8px",
            borderRadius: 4,
          }}
        >
          Critical
        </div>
      </div>
    );
  }

  // capacity_overflow
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        padding: "0.75rem 1rem",
        borderRadius: 8,
        backgroundColor: "#FEE2E2",
        border: "1px solid #FECACA",
      }}
    >
      <AlertTriangle size={16} style={{ color: "#DC2626", flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#7F1D1D" }}>
          Capacity Overflow
        </div>
        <div style={{ fontSize: "0.75rem", color: "#991B1B" }}>
          {conflict.description}
        </div>
      </div>
      <div
        style={{
          fontSize: "0.6875rem",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: "#991B1B",
          backgroundColor: "#FECACA",
          padding: "2px 8px",
          borderRadius: 4,
        }}
      >
        Critical
      </div>
    </div>
  );
}

export function ConflictsTab({
  conflicts,
}: {
  conflicts: ResourceConflict[];
  resources?: unknown;
  bookings?: unknown;
}) {
  if (conflicts.length === 0) {
    return (
      <div
        className="cs-card"
        style={{
          padding: "2rem",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "0.75rem",
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            backgroundColor: "var(--cs-surface-warm)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Wrench size={22} style={{ color: "var(--cs-text-muted)" }} />
        </div>
        <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--cs-text)" }}>
          No conflicts detected
        </div>
        <div style={{ fontSize: "0.8125rem", color: "var(--cs-text-muted)", maxWidth: 400 }}>
          All bookings have room assignments and no overlaps or capacity overflows are found for today.
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
      {conflicts.map((conflict) => (
        <ConflictRow key={conflict.id} conflict={conflict} />
      ))}
    </div>
  );
}
