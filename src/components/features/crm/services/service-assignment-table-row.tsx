"use client";

/**
 * ServiceAssignmentTableRow
 *
 * Renders a single <tr> in the Therapist Assignments table.
 * Clicking Manage / Assign Therapist expands an inline detail row
 * containing the full assignment controls (add + remove).
 *
 * Mirrors the logic in ProviderAssignmentCard but styled for table layout.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ServiceTableRow } from "./types";
import type { StaffForServicePanel } from "@/lib/queries/crm-services";
import { STAFF_TYPE_LABELS } from "@/constants/staff-roles";
import type { ServiceStaffType } from "@/constants/staff-roles";
import {
  assignProviderToServiceAction,
  removeProviderFromServiceAction,
} from "@/app/(dashboard)/crm/services/actions";

// ── Inline status message ─────────────────────────────────────────────────────

function StatusMessage({ type, text }: { type: "success" | "error"; text: string }) {
  return (
    <div
      style={{
        fontSize: "0.75rem",
        padding: "6px 10px",
        borderRadius: 6,
        background: type === "success" ? "rgba(39,174,96,0.08)" : "rgba(192,57,43,0.08)",
        color: type === "success" ? "var(--cs-success,#27ae60)" : "var(--cs-error,#c0392b)",
        border: `1px solid ${type === "success" ? "rgba(39,174,96,0.2)" : "rgba(192,57,43,0.2)"}`,
        lineHeight: 1.5,
        marginTop: 8,
      }}
    >
      {text}
    </div>
  );
}

// ── Provider chip (compact, table-friendly) ───────────────────────────────────

function ProviderChip({
  member,
  onRemove,
  isPending,
}: {
  member: StaffForServicePanel;
  onRemove: () => void;
  isPending: boolean;
}) {
  const initials = member.full_name.charAt(0).toUpperCase();
  const staffLabel = member.staff_type
    ? (STAFF_TYPE_LABELS[member.staff_type as ServiceStaffType] ?? member.staff_type)
    : null;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 8px 2px 4px",
        borderRadius: 20,
        background: "var(--cs-surface-warm)",
        border: "1px solid var(--cs-border-soft)",
        fontSize: "0.75rem",
        color: "var(--cs-text)",
        whiteSpace: "nowrap",
      }}
    >
      {/* Avatar */}
      <span
        style={{
          width: 22,
          height: 22,
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
      <span style={{ fontWeight: 500 }}>{member.full_name}</span>
      {staffLabel && (
        <span
          style={{
            fontSize: "0.625rem",
            fontWeight: 700,
            padding: "1px 5px",
            borderRadius: 20,
            background: "var(--cs-sand-mist)",
            color: "var(--cs-sand)",
          }}
        >
          {staffLabel}
        </span>
      )}
      <button
        type="button"
        disabled={isPending}
        onClick={onRemove}
        aria-label={`Remove ${member.full_name}`}
        style={{
          marginLeft: 2,
          padding: "1px 4px",
          borderRadius: 20,
          border: "1px solid var(--cs-border-soft)",
          background: "transparent",
          color: "var(--cs-text-muted)",
          fontSize: "0.6875rem",
          cursor: isPending ? "not-allowed" : "pointer",
          lineHeight: 1,
          opacity: isPending ? 0.5 : 1,
        }}
      >
        ✕
      </button>
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
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        backgroundColor: isHome ? "#FFF7ED" : "var(--cs-sand-mist)",
        color: isHome ? "#92400E" : "var(--cs-sand)",
        whiteSpace: "nowrap",
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
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [status, setStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const hasProviders = row.assignedProviders.length > 0;

  function runAction(action: () => Promise<{ ok: boolean; message: string }>) {
    setStatus(null);
    startTransition(async () => {
      const result = await action();
      setStatus({ type: result.ok ? "success" : "error", text: result.message });
      if (result.ok) router.refresh();
    });
  }

  function handleAssign() {
    if (!selectedStaffId) return;
    const id = selectedStaffId;
    runAction(async () => {
      const res = await assignProviderToServiceAction({
        branchId,
        serviceId: row.serviceId,
        staffId: id,
      });
      if (res.ok) setSelectedStaffId("");
      return res;
    });
  }

  function handleRemove(staffId: string) {
    runAction(() =>
      removeProviderFromServiceAction({ branchId, serviceId: row.serviceId, staffId })
    );
  }

  const rowBg = row.isCritical
    ? "rgba(192,57,43,0.018)"
    : row.isWarning
    ? "rgba(230,126,34,0.018)"
    : "transparent";

  return (
    <>
      {/* ── Primary row ── */}
      <tr
        style={{
          borderBottom: expanded ? "none" : "1px solid var(--cs-border-soft)",
          background: rowBg,
          transition: "background 0.1s",
        }}
      >
        {/* Service */}
        <td style={{ padding: "0.75rem 1rem", verticalAlign: "middle" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span
                style={{
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  color: "var(--cs-text)",
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
                }}
              >
                Active
              </span>
            </div>
            <div
              style={{
                fontSize: "0.75rem",
                color: "var(--cs-text-muted)",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span>{row.duration} min</span>
              <span>·</span>
              <span>₱{row.price.toLocaleString()}</span>
              <DeliveryBadge inSpa={row.isInSpa} home={row.isHomeService} />
            </div>
          </div>
        </td>

        {/* Category */}
        <td
          style={{
            padding: "0.75rem 1rem",
            verticalAlign: "middle",
            fontSize: "0.8125rem",
            color: "var(--cs-text-secondary)",
          }}
        >
          {row.category ?? <span style={{ color: "var(--cs-text-muted)" }}>—</span>}
        </td>

        {/* Assigned Therapists */}
        <td style={{ padding: "0.75rem 1rem", verticalAlign: "middle" }}>
          {hasProviders ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {row.assignedProviders.map((m) => (
                <ProviderChip
                  key={m.id}
                  member={m}
                  isPending={isPending}
                  onRemove={() => handleRemove(m.id)}
                />
              ))}
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: "0.8125rem",
                color: "#991B1B",
                fontWeight: 500,
              }}
            >
              <span style={{ fontSize: 14 }}>⚠</span>
              No therapist assigned
            </div>
          )}
        </td>

        {/* Actions */}
        <td style={{ padding: "0.75rem 1rem", verticalAlign: "middle", whiteSpace: "nowrap" }}>
          {hasProviders ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              style={{
                padding: "5px 12px",
                borderRadius: 6,
                border: "1px solid var(--cs-border)",
                background: expanded ? "var(--cs-sand-mist)" : "transparent",
                color: expanded ? "var(--cs-sand)" : "var(--cs-text-secondary)",
                fontSize: "0.8125rem",
                fontWeight: 500,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                transition: "background 0.15s",
              }}
            >
              <span style={{ fontSize: 12 }}>⚙</span>
              Manage
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              style={{
                padding: "5px 12px",
                borderRadius: 6,
                border: "none",
                background: expanded ? "#6d28d9" : "#7c3aed",
                color: "#fff",
                fontSize: "0.8125rem",
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                transition: "background 0.15s",
              }}
            >
              <span style={{ fontWeight: 700 }}>+</span>
              Assign Therapist
            </button>
          )}
        </td>
      </tr>

      {/* ── Expanded assignment panel ── */}
      {expanded && (
        <tr
          style={{
            background: "var(--cs-surface-warm)",
            borderBottom: "1px solid var(--cs-border-soft)",
          }}
        >
          <td
            colSpan={4}
            style={{ padding: "0.75rem 1rem 1rem", borderTop: "1px solid var(--cs-border-soft)" }}
          >
            <div
              style={{
                fontSize: "0.8125rem",
                fontWeight: 600,
                color: "var(--cs-text-secondary)",
                marginBottom: 10,
              }}
            >
              {hasProviders ? "Manage Providers" : "Assign a Provider"} — {row.name}
            </div>

            {/* Add provider row */}
            {row.assignableProviders.length > 0 ? (
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <select
                  value={selectedStaffId}
                  disabled={isPending}
                  onChange={(e) => setSelectedStaffId(e.target.value)}
                  aria-label={`Add provider to ${row.name}`}
                  style={{
                    flex: "1 1 200px",
                    minWidth: 0,
                    maxWidth: 320,
                    height: 34,
                    padding: "0 10px",
                    borderRadius: 6,
                    border: "1px solid var(--cs-border)",
                    background: "var(--cs-surface)",
                    fontSize: "0.8125rem",
                    color: "var(--cs-text)",
                    opacity: isPending ? 0.6 : 1,
                    cursor: isPending ? "not-allowed" : "default",
                  }}
                >
                  <option value="">Select provider to add…</option>
                  {row.assignableProviders.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name}
                      {s.staff_type
                        ? ` · ${STAFF_TYPE_LABELS[s.staff_type as ServiceStaffType] ?? s.staff_type}`
                        : ""}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!selectedStaffId || isPending}
                  onClick={handleAssign}
                  style={{
                    height: 34,
                    padding: "0 14px",
                    borderRadius: 6,
                    border: "none",
                    background:
                      selectedStaffId && !isPending ? "var(--cs-sand)" : "var(--cs-border)",
                    color: selectedStaffId && !isPending ? "#fff" : "var(--cs-text-muted)",
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    cursor: selectedStaffId && !isPending ? "pointer" : "not-allowed",
                    whiteSpace: "nowrap",
                    transition: "background 0.15s",
                  }}
                >
                  {isPending ? "Saving…" : "Assign Provider"}
                </button>
              </div>
            ) : (
              <p style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)", fontStyle: "italic" }}>
                No additional eligible providers available. Add therapists, nail technicians,
                aestheticians, or salon heads to your branch staff first.
              </p>
            )}

            {/* Already-assigned chips with remove buttons (only when managing) */}
            {hasProviders && (
              <div style={{ marginTop: 10 }}>
                <div
                  style={{
                    fontSize: "0.6875rem",
                    fontWeight: 600,
                    color: "var(--cs-text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    marginBottom: 6,
                  }}
                >
                  Currently Assigned
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {row.assignedProviders.map((m) => (
                    <ProviderChip
                      key={m.id}
                      member={m}
                      isPending={isPending}
                      onRemove={() => handleRemove(m.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {status && <StatusMessage type={status.type} text={status.text} />}
          </td>
        </tr>
      )}
    </>
  );
}
