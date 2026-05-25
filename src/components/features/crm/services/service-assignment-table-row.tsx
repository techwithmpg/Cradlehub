"use client";

/**
 * ServiceAssignmentTableRow
 *
 * Renders a single compact <tr> in the Therapist Assignments table.
 *
 * Assigned Therapists column shows a preview of max 3 provider chips plus a
 * "+N more" badge and total count. Full management opens in a right-side sheet.
 *
 * Clicking Manage or + Assign Therapist opens ProviderAssignmentSheet.
 */

import { useState } from "react";
import type { ServiceTableRow } from "./types";
import type { StaffForServicePanel } from "@/lib/queries/crm-services";
import { ProviderAssignmentSheet } from "./provider-assignment-sheet";

// ── How many chips to show inline before collapsing to "+N more" ──────────────
const MAX_PREVIEW = 3;

// ── Mini provider chip (no remove button, read-only preview) ─────────────────

function MiniChip({ member }: { member: StaffForServicePanel }) {
  const initials = member.full_name.charAt(0).toUpperCase();
  return (
    <span
      title={member.full_name}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "2px 8px 2px 4px",
        borderRadius: 20,
        background: "var(--cs-surface-warm)",
        border: "1px solid var(--cs-border-soft)",
        fontSize: "0.75rem",
        color: "var(--cs-text)",
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: 20,
          height: 20,
          borderRadius: "50%",
          background: "var(--cs-sand-mist)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "0.5625rem",
          fontWeight: 700,
          color: "var(--cs-sand)",
          flexShrink: 0,
        }}
      >
        {initials}
      </span>
      <span style={{ fontWeight: 500 }}>
        {/* First name only to stay compact */}
        {member.full_name.split(" ")[0]}
        {member.full_name.includes(" ") ? ` ${member.full_name.split(" ")[1]?.charAt(0)}.` : ""}
      </span>
    </span>
  );
}

// ── Service delivery badge ────────────────────────────────────────────────────

function DeliveryBadge({ inSpa, home }: { inSpa: boolean; home: boolean }) {
  const label = inSpa && home ? "In-spa & Home" : inSpa ? "In-spa" : home ? "Home" : "—";
  const isHome = home && !inSpa;
  return (
    <span
      style={{
        fontSize: "0.5625rem",
        fontWeight: 700,
        padding: "2px 6px",
        borderRadius: 3,
        textTransform: "uppercase" as const,
        letterSpacing: "0.04em",
        backgroundColor: isHome ? "#FFF7ED" : "var(--cs-sand-mist)",
        color: isHome ? "#92400E" : "var(--cs-sand)",
        whiteSpace: "nowrap" as const,
      }}
    >
      {label}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ServiceAssignmentTableRow({
  row,
  branchId,
}: {
  row: ServiceTableRow;
  branchId: string;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);

  const hasProviders = row.assignedProviders.length > 0;
  const preview = row.assignedProviders.slice(0, MAX_PREVIEW);
  const extraCount = row.assignedProviders.length - MAX_PREVIEW;

  return (
    <>
      <tr
        style={{
          borderBottom: "1px solid var(--cs-border-soft)",
          background: row.isCritical
            ? "rgba(192,57,43,0.018)"
            : row.isWarning
            ? "rgba(230,126,34,0.018)"
            : "transparent",
        }}
      >
        {/* ── Service ── */}
        <td style={{ padding: "0.625rem 1rem", verticalAlign: "middle" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span
                style={{
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  color: "var(--cs-text)",
                  whiteSpace: "nowrap",
                }}
              >
                {row.name}
              </span>
              <span
                style={{
                  fontSize: "0.5625rem",
                  fontWeight: 700,
                  padding: "2px 6px",
                  borderRadius: 20,
                  background: "#ECFDF5",
                  color: "#065F46",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  flexShrink: 0,
                }}
              >
                Active
              </span>
            </div>
            <div
              style={{
                fontSize: "0.6875rem",
                color: "var(--cs-text-muted)",
                display: "flex",
                alignItems: "center",
                gap: 5,
                flexWrap: "wrap",
              }}
            >
              <span>{row.duration} min</span>
              <span>·</span>
              <span>₱{row.price.toLocaleString()}</span>
              <DeliveryBadge inSpa={row.isInSpa} home={row.isHomeService} />
            </div>
          </div>
        </td>

        {/* ── Category ── */}
        <td
          style={{
            padding: "0.625rem 1rem",
            verticalAlign: "middle",
            fontSize: "0.8125rem",
            color: "var(--cs-text-secondary)",
            whiteSpace: "nowrap",
          }}
        >
          {row.category ?? <span style={{ color: "var(--cs-text-muted)" }}>—</span>}
        </td>

        {/* ── Assigned Therapists (compact preview) ── */}
        <td style={{ padding: "0.625rem 1rem", verticalAlign: "middle" }}>
          {hasProviders ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {/* Provider chip previews */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
                {preview.map((m) => (
                  <MiniChip key={m.id} member={m} />
                ))}
                {extraCount > 0 && (
                  <span
                    style={{
                      fontSize: "0.6875rem",
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: 20,
                      background: "var(--cs-sand-mist)",
                      color: "var(--cs-sand)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    +{extraCount} more
                  </span>
                )}
              </div>
              {/* Total count */}
              <div style={{ fontSize: "0.6875rem", color: "var(--cs-text-muted)" }}>
                {row.assignedProviders.length} assigned
              </div>
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                fontSize: "0.8125rem",
                color: "#991B1B",
                fontWeight: 500,
              }}
            >
              <span style={{ fontSize: 13 }}>⚠</span>
              No therapist assigned
            </div>
          )}
        </td>

        {/* ── Actions ── */}
        <td style={{ padding: "0.625rem 1rem", verticalAlign: "middle", whiteSpace: "nowrap" }}>
          {hasProviders ? (
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              style={{
                padding: "5px 12px",
                borderRadius: 6,
                border: "1px solid var(--cs-border)",
                background: "transparent",
                color: "var(--cs-text-secondary)",
                fontSize: "0.8125rem",
                fontWeight: 500,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                transition: "background 0.15s, color 0.15s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "var(--cs-sand-mist)";
                (e.currentTarget as HTMLButtonElement).style.color = "var(--cs-sand)";
                (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--cs-sand)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                (e.currentTarget as HTMLButtonElement).style.color = "var(--cs-text-secondary)";
                (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--cs-border)";
              }}
            >
              <span style={{ fontSize: 12 }}>⚙</span>
              Manage
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              style={{
                padding: "5px 12px",
                borderRadius: 6,
                border: "none",
                background: "#7c3aed",
                color: "#fff",
                fontSize: "0.8125rem",
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "#6d28d9";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "#7c3aed";
              }}
            >
              <span style={{ fontWeight: 700 }}>+</span>
              Assign Therapist
            </button>
          )}
        </td>
      </tr>

      {/* ── Management sheet (portal, renders outside table) ── */}
      <ProviderAssignmentSheet
        row={row}
        branchId={branchId}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
      />
    </>
  );
}
