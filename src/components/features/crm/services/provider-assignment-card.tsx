"use client";

/**
 * ProviderAssignmentCard
 *
 * Interactive client component for a single service's provider assignment row.
 * Handles assign/remove actions with inline status feedback.
 *
 * Parent (server): crm-service-therapist-panel.tsx
 * Actions: src/app/(dashboard)/crm/services/actions.ts
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ServiceRow } from "./types";
import type { StaffForServicePanel } from "@/lib/queries/crm-services";
import { SERVICE_STAFF_TYPES, STAFF_TYPE_LABELS } from "@/constants/staff-roles";
import type { ServiceStaffType } from "@/constants/staff-roles";
import {
  assignProviderToServiceAction,
  removeProviderFromServiceAction,
} from "@/app/(dashboard)/crm/services/actions";
import { ReadinessIssueCard } from "@/components/shared/readiness-issue-card";
import type { ReadinessIssue } from "@/types/readiness";

// ── Style helpers ─────────────────────────────────────────────────────────────

const VISIBILITY_LABEL: Record<string, string> = {
  public: "Public",
  csr_only: "CSR only",
  vip: "VIP",
};

const VISIBILITY_STYLE: Record<string, { color: string; bg: string }> = {
  public:   { color: "var(--cs-success,#27ae60)",  bg: "rgba(39,174,96,0.08)"   },
  csr_only: { color: "var(--cs-info,#2980b9)",      bg: "rgba(41,128,185,0.08)"  },
  vip:      { color: "var(--cs-brand,#8e44ad)",     bg: "rgba(142,68,173,0.08)"  },
};

const STAFF_TYPE_STYLE: Record<ServiceStaffType, { color: string; bg: string }> = {
  therapist:    { color: "var(--cs-sand)",              bg: "var(--cs-sand-mist)"    },
  nail_tech:    { color: "#7c3aed",                     bg: "rgba(124,58,237,0.08)"  },
  aesthetician: { color: "#db2777",                     bg: "rgba(219,39,119,0.08)"  },
  salon_head:   { color: "var(--cs-warning,#e67e22)",   bg: "rgba(230,126,34,0.08)"  },
};

const SERVICE_STAFF_TYPE_SET = new Set<string>(SERVICE_STAFF_TYPES);

// ── Readiness helper ──────────────────────────────────────────────────────────

/**
 * Builds a ReadinessIssue for the per-row "no providers" state.
 * Mirrors createNoProviderReadinessIssue in crm-service-therapist-panel.tsx
 * but lives here so ProviderAssignmentCard ("use client") stays self-contained.
 */
function buildNoProviderIssue(row: ServiceRow): ReadinessIssue | null {
  if (row.assignedProviders.length > 0) return null;

  if (row.isCritical) {
    return {
      id: `service:${row.serviceId}:no-public-provider`,
      scope: "service",
      severity: "critical",
      title: "Public service has no valid provider",
      problem: `"${row.name}" is visible to customers but has no eligible provider assigned.`,
      impact: "Customers may not be able to choose a therapist or complete a booking for this service online.",
      fix: "Assign at least one eligible service provider (therapist, nail tech, aesthetician, or salon head) before relying on this service in online booking.",
      actionLabel: "Assign provider",
      actionHref: "/crm/services",
      source: "ProviderAssignmentCard",
      entityType: "service",
      entityIds: [row.serviceId],
      count: 1,
    };
  }

  return {
    id: `service:${row.serviceId}:no-internal-provider`,
    scope: "service",
    severity: "warning",
    title: "Service has no valid provider",
    problem: `"${row.name}" has no eligible provider assigned yet.`,
    impact: "CRM may not be able to assign this service during in-house or internal booking.",
    fix: "Assign an eligible provider using the dropdown, or disable the service until it is ready.",
    actionLabel: "Assign provider",
    actionHref: "/crm/services",
    source: "ProviderAssignmentCard",
    entityType: "service",
    entityIds: [row.serviceId],
    count: 1,
  };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function VisibilityBadge({ visibility }: { visibility: string }) {
  const style = VISIBILITY_STYLE[visibility] ?? {
    color: "var(--cs-text-muted)",
    bg: "var(--cs-surface-warm)",
  };
  return (
    <span
      style={{
        fontSize: "0.6875rem",
        fontWeight: 700,
        padding: "2px 7px",
        borderRadius: 20,
        color: style.color,
        background: style.bg,
        whiteSpace: "nowrap",
      }}
    >
      {VISIBILITY_LABEL[visibility] ?? visibility}
    </span>
  );
}

function EligibilityPill({ label, active }: { label: string; active: boolean }) {
  return (
    <span
      style={{
        fontSize: "0.6875rem",
        fontWeight: 600,
        padding: "2px 7px",
        borderRadius: 20,
        border: `1px solid ${active ? "rgba(39,174,96,0.3)" : "var(--cs-border-soft)"}`,
        color: active ? "var(--cs-success,#27ae60)" : "var(--cs-text-muted)",
        background: active ? "rgba(39,174,96,0.06)" : "transparent",
        whiteSpace: "nowrap",
      }}
    >
      {active ? "✓ " : "— "}{label}
    </span>
  );
}

function StaffTypeBadge({ staffType }: { staffType: string | null }) {
  const key = staffType as ServiceStaffType;
  const style = SERVICE_STAFF_TYPE_SET.has(staffType ?? "")
    ? (STAFF_TYPE_STYLE[key] ?? { color: "var(--cs-text-muted)", bg: "var(--cs-surface-warm)" })
    : { color: "var(--cs-text-muted)", bg: "var(--cs-surface-warm)" };
  const label = staffType ? (STAFF_TYPE_LABELS[key] ?? staffType) : "Unknown";
  return (
    <span
      style={{
        fontSize: "0.625rem",
        fontWeight: 700,
        padding: "1px 6px",
        borderRadius: 20,
        color: style.color,
        background: style.bg,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

function ProviderChip({
  member,
  onRemove,
  isPending,
}: {
  member: StaffForServicePanel;
  onRemove: () => void;
  isPending: boolean;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 6px 3px 6px",
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
        {member.full_name.charAt(0).toUpperCase()}
      </span>
      <span style={{ fontWeight: 500 }}>{member.full_name}</span>
      <StaffTypeBadge staffType={member.staff_type} />
      <button
        type="button"
        disabled={isPending}
        onClick={onRemove}
        aria-label={`Remove ${member.full_name} as provider`}
        title={`Remove ${member.full_name}`}
        style={{
          marginLeft: 2,
          padding: "1px 5px",
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

// ── Status inline message ─────────────────────────────────────────────────────

function StatusMessage({ type, text }: { type: "success" | "error"; text: string }) {
  return (
    <div
      style={{
        fontSize: "0.75rem",
        padding: "6px 10px",
        borderRadius: "var(--cs-r-sm,6px)",
        background: type === "success" ? "rgba(39,174,96,0.08)" : "rgba(192,57,43,0.08)",
        color: type === "success" ? "var(--cs-success,#27ae60)" : "var(--cs-error,#c0392b)",
        border: `1px solid ${type === "success" ? "rgba(39,174,96,0.2)" : "rgba(192,57,43,0.2)"}`,
        lineHeight: 1.5,
      }}
    >
      {text}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ProviderAssignmentCard({
  row,
  branchId,
}: {
  row: ServiceRow;
  branchId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const noProviderIssue = buildNoProviderIssue(row);

  function runAction(action: () => Promise<{ ok: boolean; message: string }>) {
    setStatus(null);
    startTransition(async () => {
      const result = await action();
      setStatus({ type: result.ok ? "success" : "error", text: result.message });
      if (result.ok) {
        router.refresh();
      }
    });
  }

  function handleAssign() {
    if (!selectedStaffId) return;
    const idToAssign = selectedStaffId;
    runAction(async () => {
      const res = await assignProviderToServiceAction({
        branchId,
        serviceId: row.serviceId,
        staffId: idToAssign,
      });
      if (res.ok) setSelectedStaffId("");
      return res;
    });
  }

  function handleRemove(staffId: string) {
    runAction(() =>
      removeProviderFromServiceAction({
        branchId,
        serviceId: row.serviceId,
        staffId,
      })
    );
  }

  const rowBg = row.isCritical
    ? "rgba(192,57,43,0.025)"
    : row.isWarning
    ? "rgba(230,126,34,0.025)"
    : "transparent";

  return (
    <div
      style={{
        padding: "1rem",
        borderBottom: "1px solid var(--cs-border-soft)",
        background: rowBg,
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
      }}
    >
      {/* ── Service header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 160 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
            <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--cs-text)" }}>
              {row.name}
            </span>
            {row.isCritical && (
              <span
                style={{ fontSize: 14 }}
                title="Public service with no valid providers — online booking cannot show therapists"
              >
                ⛔
              </span>
            )}
            {!row.isCritical && row.isWarning && (
              <span style={{ fontSize: 14 }} title="No providers assigned">⚠️</span>
            )}
          </div>
          {row.category && (
            <div style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)", marginBottom: 4 }}>
              {row.category}
            </div>
          )}
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            <EligibilityPill label="In-spa" active={row.isInSpa} />
            <EligibilityPill label="Home" active={row.isHomeService} />
            <VisibilityBadge visibility={row.visibility} />
          </div>
        </div>

        <div
          style={{
            fontSize: "0.6875rem",
            color: "var(--cs-text-muted)",
            paddingTop: 2,
            whiteSpace: "nowrap",
          }}
        >
          {row.assignedProviders.length === 0
            ? "0 providers"
            : `${row.assignedProviders.length} provider${row.assignedProviders.length > 1 ? "s" : ""}`}
        </div>
      </div>

      {/* ── Assigned providers ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {row.assignedProviders.length > 0 ? (
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
        ) : noProviderIssue !== null ? (
          <ReadinessIssueCard issue={noProviderIssue} compact />
        ) : null}
      </div>

      {/* ── Add provider control ── */}
      {row.assignableProviders.length > 0 && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <select
            value={selectedStaffId}
            disabled={isPending}
            onChange={(e) => setSelectedStaffId(e.target.value)}
            aria-label={`Add provider to ${row.name}`}
            style={{
              flex: "1 1 180px",
              minWidth: 0,
              height: 34,
              padding: "0 10px",
              borderRadius: "var(--cs-r-sm,6px)",
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
              borderRadius: "var(--cs-r-sm,6px)",
              border: "none",
              background: selectedStaffId && !isPending ? "var(--cs-sand)" : "var(--cs-border)",
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
      )}

      {row.assignableProviders.length === 0 && row.assignedProviders.length === 0 && (
        <div style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)", fontStyle: "italic" }}>
          No eligible service-provider staff found at this branch. Add therapists, nail technicians, aestheticians, or salon heads to your branch staff first.
        </div>
      )}

      {/* ── Status message ── */}
      {status && <StatusMessage type={status.type} text={status.text} />}
    </div>
  );
}
