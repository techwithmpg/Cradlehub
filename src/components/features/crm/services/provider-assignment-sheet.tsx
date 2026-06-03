"use client";

/**
 * ProviderAssignmentSheet
 *
 * Centered task modal for managing all provider assignments for a single service.
 * Opens when CRM clicks Manage / Assign Provider in the service table row.
 *
 * Layout (flex column):
 *   - Fixed header: title + description
 *   - Fixed service summary bar
 *   - Scrollable body: assigned providers + searchable add-provider list + status
 *   - Fixed footer: assignment count + Done button
 *
 * Reuses existing server actions — no new mutations.
 */

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  AdminDialog,
  AdminOverlayHeader,
  AdminOverlayBody,
  AdminOverlayFooter,
} from "@/components/shared/overlays";
import { STAFF_TYPE_LABELS } from "@/constants/staff-roles";
import type { ServiceStaffType } from "@/constants/staff-roles";
import {
  assignProviderToServiceAction,
  removeProviderFromServiceAction,
} from "@/app/(dashboard)/crm/services/actions";
import type { ServiceTableRow } from "./types";
import type { StaffForServicePanel } from "@/lib/queries/crm-services";
import { getStaffAdminName } from "@/lib/staff/display-name";

// ── Style helpers ─────────────────────────────────────────────────────────────

const STAFF_TYPE_COLOR: Record<string, { bg: string; color: string }> = {
  therapist:    { bg: "var(--cs-sand-mist)",           color: "var(--cs-sand)"    },
  nail_tech:    { bg: "rgba(124,58,237,0.08)",          color: "#7c3aed"           },
  aesthetician: { bg: "rgba(219,39,119,0.08)",          color: "#db2777"           },
  salon_head:   { bg: "rgba(230,126,34,0.08)",          color: "#b45309"           },
};

const VISIBILITY_LABEL: Record<string, string> = {
  public:   "Public",
  csr_only: "CSR only",
  vip:      "VIP",
};

// ── Sub-components ────────────────────────────────────────────────────────────

function StaffTypeBadge({ staffType }: { staffType: string | null }) {
  const style = staffType
    ? (STAFF_TYPE_COLOR[staffType] ?? { bg: "var(--cs-surface-warm)", color: "var(--cs-text-muted)" })
    : { bg: "var(--cs-surface-warm)", color: "var(--cs-text-muted)" };
  const label = staffType
    ? (STAFF_TYPE_LABELS[staffType as ServiceStaffType] ?? staffType)
    : "Unknown";
  return (
    <span
      style={{
        fontSize: "0.625rem",
        fontWeight: 700,
        padding: "2px 7px",
        borderRadius: 20,
        background: style.bg,
        color: style.color,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

function StatusMessage({ type, text }: { type: "success" | "error"; text: string }) {
  return (
    <div
      style={{
        fontSize: "0.8125rem",
        padding: "10px 12px",
        borderRadius: 8,
        background: type === "success" ? "rgba(39,174,96,0.07)" : "rgba(192,57,43,0.07)",
        color: type === "success" ? "var(--cs-success,#27ae60)" : "var(--cs-error,#c0392b)",
        border: `1px solid ${type === "success" ? "rgba(39,174,96,0.25)" : "rgba(192,57,43,0.25)"}`,
        lineHeight: 1.5,
      }}
    >
      {text}
    </div>
  );
}

// ── Assigned provider row ─────────────────────────────────────────────────────

function AssignedProviderRow({
  member,
  onRemove,
  isPending,
}: {
  member: StaffForServicePanel;
  onRemove: () => void;
  isPending: boolean;
}) {
  const displayName = getStaffAdminName(member);
  const initials = displayName.slice(0, 2).toUpperCase();
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 0",
        borderBottom: "1px solid var(--cs-border-soft)",
      }}
    >
      {/* Avatar */}
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          background: "var(--cs-sand-mist)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "0.6875rem",
          fontWeight: 700,
          color: "var(--cs-sand)",
          flexShrink: 0,
        }}
      >
        {initials}
      </div>

      {/* Name + type */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: "0.875rem",
            fontWeight: 500,
            color: "var(--cs-text)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {displayName}
        </div>
        <StaffTypeBadge staffType={member.staff_type} />
      </div>

      {/* Remove button */}
      <button
        type="button"
        disabled={isPending}
        onClick={onRemove}
        aria-label={`Remove ${displayName}`}
        style={{
          padding: "4px 10px",
          borderRadius: 6,
          border: "1px solid var(--cs-border)",
          background: "transparent",
          color: "var(--cs-text-muted)",
          fontSize: "0.75rem",
          fontWeight: 500,
          cursor: isPending ? "not-allowed" : "pointer",
          flexShrink: 0,
          opacity: isPending ? 0.5 : 1,
          whiteSpace: "nowrap",
        }}
      >
        Remove
      </button>
    </div>
  );
}

// ── Eligible provider row (for add list) ──────────────────────────────────────

function EligibleProviderRow({
  member,
  onAdd,
  isPending,
}: {
  member: StaffForServicePanel;
  onAdd: () => void;
  isPending: boolean;
}) {
  const displayName = getStaffAdminName(member);
  const initials = displayName.slice(0, 2).toUpperCase();
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 0",
        borderBottom: "1px solid var(--cs-border-soft)",
      }}
    >
      {/* Avatar */}
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          background: "var(--cs-sand-mist)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "0.6875rem",
          fontWeight: 700,
          color: "var(--cs-sand)",
          flexShrink: 0,
        }}
      >
        {initials}
      </div>

      {/* Name + type */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: "0.875rem",
            fontWeight: 500,
            color: "var(--cs-text)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {displayName}
        </div>
        <StaffTypeBadge staffType={member.staff_type} />
      </div>

      {/* Add button */}
      <button
        type="button"
        disabled={isPending}
        onClick={onAdd}
        aria-label={`Assign ${displayName}`}
        style={{
          padding: "4px 12px",
          borderRadius: 6,
          border: "none",
          background: isPending ? "var(--cs-border)" : "var(--cs-sand)",
          color: isPending ? "var(--cs-text-muted)" : "#fff",
          fontSize: "0.75rem",
          fontWeight: 600,
          cursor: isPending ? "not-allowed" : "pointer",
          flexShrink: 0,
          opacity: isPending ? 0.6 : 1,
          whiteSpace: "nowrap",
          transition: "background 0.15s",
        }}
      >
        {isPending ? "Saving…" : "Add"}
      </button>
    </div>
  );
}

// ── Service summary bar ───────────────────────────────────────────────────────

function ServiceSummary({ row }: { row: ServiceTableRow }) {
  const deliveryLabel =
    row.isInSpa && row.isHomeService
      ? "In-spa & Home"
      : row.isInSpa
      ? "In-spa"
      : row.isHomeService
      ? "Home"
      : "—";

  return (
    <div
      className="shrink-0"
      style={{
        padding: "12px 16px",
        background: "var(--cs-surface-warm)",
        borderBottom: "1px solid var(--cs-border-soft)",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--cs-text)" }}>
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
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
          fontSize: "0.75rem",
          color: "var(--cs-text-muted)",
        }}
      >
        {row.category && <span>{row.category}</span>}
        {row.category && <span>·</span>}
        <span>{row.duration} min</span>
        <span>·</span>
        <span>₱{row.price.toLocaleString()}</span>
        <span>·</span>
        <span
          style={{
            fontSize: "0.5625rem",
            fontWeight: 700,
            padding: "2px 6px",
            borderRadius: 3,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            backgroundColor: row.isHomeService && !row.isInSpa ? "#FFF7ED" : "var(--cs-sand-mist)",
            color: row.isHomeService && !row.isInSpa ? "#92400E" : "var(--cs-sand)",
          }}
        >
          {deliveryLabel}
        </span>
        {row.visibility && row.visibility !== "public" && (
          <>
            <span>·</span>
            <span style={{ color: "var(--cs-info,#2980b9)", fontWeight: 600 }}>
              {VISIBILITY_LABEL[row.visibility] ?? row.visibility}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main sheet ────────────────────────────────────────────────────────────────

export function ProviderAssignmentSheet({
  row,
  branchId,
  open,
  onClose,
}: {
  row: ServiceTableRow;
  branchId: string;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [providerSearch, setProviderSearch] = useState("");

  function runAction(action: () => Promise<{ ok: boolean; message: string }>) {
    setStatus(null);
    startTransition(async () => {
      const result = await action();
      setStatus({ type: result.ok ? "success" : "error", text: result.message });
      if (result.ok) router.refresh();
    });
  }

  function handleAssign(staffId: string) {
    if (!branchId) {
      setStatus({
        type: "error",
        text: "Branch information is missing. Please reload the page and try again.",
      });
      return;
    }
    runAction(async () => {
      const res = await assignProviderToServiceAction({
        branchId,
        serviceId: row.serviceId,
        staffId,
      });
      return res;
    });
  }

  function handleRemove(staffId: string) {
    if (!branchId) {
      setStatus({
        type: "error",
        text: "Branch information is missing. Please reload the page and try again.",
      });
      return;
    }
    runAction(() =>
      removeProviderFromServiceAction({ branchId, serviceId: row.serviceId, staffId })
    );
  }

  const hasProviders = row.assignedProviders.length > 0;

  // Searchable assignable providers
  const searchQuery = providerSearch.toLowerCase().trim();
  const filteredAssignable = useMemo(() => {
    if (!searchQuery) return row.assignableProviders;
    return row.assignableProviders.filter((p) =>
      getStaffAdminName(p).toLowerCase().includes(searchQuery)
    );
  }, [row.assignableProviders, searchQuery]);

  return (
    <AdminDialog
      open={open}
      onOpenChange={(isOpen: boolean) => {
        if (!isOpen) {
          onClose();
          setStatus(null);
          setProviderSearch("");
        }
      }}
      size="lg"
    >
      <AdminOverlayHeader
        title={`Manage Providers — ${row.name}`}
        description="Assign or remove eligible service providers for this service."
      />

      {/* ── Fixed service summary ── */}
      <ServiceSummary row={row} />

      <AdminOverlayBody className="flex flex-col gap-5">
          {/* ── Assigned Providers ── */}
          <div>
            <div
              style={{
                fontSize: "0.75rem",
                fontWeight: 700,
                color: "var(--cs-text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: 8,
              }}
            >
              Assigned Providers ({row.assignedProviders.length})
            </div>

            {hasProviders ? (
              <div>
                {row.assignedProviders.map((member) => (
                  <AssignedProviderRow
                    key={member.id}
                    member={member}
                    isPending={isPending}
                    onRemove={() => handleRemove(member.id)}
                  />
                ))}
              </div>
            ) : (
              <div
                style={{
                  padding: "1rem",
                  textAlign: "center",
                  borderRadius: 8,
                  border: "1px dashed var(--cs-border)",
                  background: "rgba(192,57,43,0.03)",
                }}
              >
                <div style={{ fontSize: "1.25rem", marginBottom: 4 }}>⚠️</div>
                <div style={{ fontSize: "0.8125rem", fontWeight: 500, color: "#991B1B" }}>
                  No providers assigned
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)", marginTop: 2 }}>
                  {row.visibility === "public"
                    ? "This public service cannot show therapists to customers until a provider is assigned."
                    : "Assign an eligible provider to enable CRM booking for this service."}
                </div>
              </div>
            )}
          </div>

          {/* ── Add Provider (searchable list) ── */}
          <div>
            <div
              style={{
                fontSize: "0.75rem",
                fontWeight: 700,
                color: "var(--cs-text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: 8,
              }}
            >
              Add Provider
            </div>

            {row.assignableProviders.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {/* Search input */}
                <div style={{ position: "relative" }}>
                  <span
                    style={{
                      position: "absolute",
                      left: 10,
                      top: "50%",
                      transform: "translateY(-50%)",
                      fontSize: 13,
                      color: "var(--cs-text-muted)",
                      pointerEvents: "none",
                    }}
                  >
                    🔍
                  </span>
                  <input
                    type="text"
                    placeholder="Search eligible provider…"
                    value={providerSearch}
                    onChange={(e) => setProviderSearch(e.target.value)}
                    style={{
                      width: "100%",
                      height: 38,
                      paddingLeft: 30,
                      paddingRight: 10,
                      borderRadius: 8,
                      border: "1px solid var(--cs-border)",
                      background: "var(--cs-surface)",
                      fontSize: "0.875rem",
                      color: "var(--cs-text)",
                      outline: "none",
                    }}
                  />
                </div>

                {/* Provider list */}
                {filteredAssignable.length > 0 ? (
                  <div>
                    {filteredAssignable.map((member) => (
                      <EligibleProviderRow
                        key={member.id}
                        member={member}
                        isPending={isPending}
                        onAdd={() => handleAssign(member.id)}
                      />
                    ))}
                  </div>
                ) : (
                  <div
                    style={{
                      padding: "0.875rem",
                      borderRadius: 8,
                      background: "var(--cs-surface-warm)",
                      border: "1px solid var(--cs-border-soft)",
                      fontSize: "0.8125rem",
                      color: "var(--cs-text-muted)",
                      fontStyle: "italic",
                    }}
                  >
                    No providers match “{providerSearch}”.
                  </div>
                )}
              </div>
            ) : (
              <div
                style={{
                  padding: "0.875rem",
                  borderRadius: 8,
                  background: "var(--cs-surface-warm)",
                  border: "1px solid var(--cs-border-soft)",
                  fontSize: "0.8125rem",
                  color: "var(--cs-text-muted)",
                  fontStyle: "italic",
                }}
              >
                {row.assignedProviders.length === 0
                  ? "No eligible providers found for this branch. Add therapists, nail technicians, aestheticians, or salon heads to your branch staff first."
                  : "All eligible providers at this branch are already assigned to this service."}
              </div>
            )}
          </div>

          {/* ── Status message ── */}
          {status && <StatusMessage type={status.type} text={status.text} />}

          {/* ── Eligibility note ── */}
          <div
            style={{
              padding: "10px 12px",
              borderRadius: 8,
              background: "rgba(41,128,185,0.04)",
              border: "1px solid rgba(41,128,185,0.16)",
              fontSize: "0.75rem",
              color: "var(--cs-text-muted)",
              lineHeight: 1.6,
            }}
          >
            Only eligible provider staff are shown. Drivers, utility staff, CRM/front-desk staff,
            inactive staff, and staff from other branches are excluded automatically.
          </div>
        </AdminOverlayBody>

        <AdminOverlayFooter className="flex flex-row justify-between items-center">
          <div style={{ fontSize: "0.8125rem", color: "var(--cs-text-secondary)" }}>
            <strong style={{ color: "var(--cs-text)" }}>{row.assignedProviders.length}</strong>{" "}
            provider{row.assignedProviders.length !== 1 ? "s" : ""} assigned
          </div>
          <button
            type="button"
            onClick={() => {
              onClose();
              setStatus(null);
              setProviderSearch("");
            }}
            style={{
              padding: "6px 16px",
              borderRadius: 8,
              border: "1px solid var(--cs-border)",
              background: "var(--cs-surface)",
              color: "var(--cs-text-secondary)",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: "pointer",
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "var(--cs-surface-warm)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "var(--cs-surface)";
            }}
          >
            Done
          </button>
        </AdminOverlayFooter>
      </AdminDialog>
    );
}
