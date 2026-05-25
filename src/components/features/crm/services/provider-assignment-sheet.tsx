"use client";

/**
 * ProviderAssignmentSheet
 *
 * Right-side drawer for managing all provider assignments for a single service.
 * Opens when CRM clicks Manage / Assign Therapist in the compact table row.
 *
 * Contains:
 *   - Service summary (name, category, duration, price, delivery, visibility)
 *   - Full assigned-providers list with per-row Remove button
 *   - Add Provider select + Assign button
 *   - Inline status feedback
 *   - Eligibility reminder footer
 *
 * Reuses existing server actions — no new mutations.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { STAFF_TYPE_LABELS } from "@/constants/staff-roles";
import type { ServiceStaffType } from "@/constants/staff-roles";
import {
  assignProviderToServiceAction,
  removeProviderFromServiceAction,
} from "@/app/(dashboard)/crm/services/actions";
import type { ServiceTableRow } from "./types";
import type { StaffForServicePanel } from "@/lib/queries/crm-services";

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
  const style = staffType ? (STAFF_TYPE_COLOR[staffType] ?? { bg: "var(--cs-surface-warm)", color: "var(--cs-text-muted)" }) : { bg: "var(--cs-surface-warm)", color: "var(--cs-text-muted)" };
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
  const initials = member.full_name.slice(0, 2).toUpperCase();
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
          {member.full_name}
        </div>
        <StaffTypeBadge staffType={member.staff_type} />
      </div>

      {/* Remove button */}
      <button
        type="button"
        disabled={isPending}
        onClick={onRemove}
        aria-label={`Remove ${member.full_name}`}
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
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [status, setStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);

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
    if (!branchId) {
      setStatus({ type: "error", text: "Branch information is missing. Please reload the page and try again." });
      return;
    }
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
    if (!branchId) {
      setStatus({ type: "error", text: "Branch information is missing. Please reload the page and try again." });
      return;
    }
    runAction(() =>
      removeProviderFromServiceAction({ branchId, serviceId: row.serviceId, staffId })
    );
  }

  const hasProviders = row.assignedProviders.length > 0;

  return (
    <Sheet
      open={open}
      onOpenChange={(isOpen: boolean) => {
        if (!isOpen) {
          onClose();
          setStatus(null);
          setSelectedStaffId("");
        }
      }}
    >
      <SheetContent
        side="right"
        showCloseButton
        className="sm:max-w-[480px] p-0 gap-0 overflow-y-auto flex flex-col"
      >
        {/* Header */}
        <SheetHeader className="p-4 border-b border-[var(--cs-border-soft)] shrink-0">
          <SheetTitle className="text-base">
            Manage Providers — {row.name}
          </SheetTitle>
          <SheetDescription>
            Assign or remove eligible service providers for this service.
          </SheetDescription>
        </SheetHeader>

        {/* Service summary */}
        <ServiceSummary row={row} />

        {/* Body — scrollable */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "1rem",
            display: "flex",
            flexDirection: "column",
            gap: "1.25rem",
          }}
        >
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

          {/* ── Add Provider ── */}
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
                <select
                  value={selectedStaffId}
                  disabled={isPending}
                  onChange={(e) => setSelectedStaffId(e.target.value)}
                  aria-label="Select a provider to assign"
                  style={{
                    width: "100%",
                    height: 38,
                    padding: "0 12px",
                    borderRadius: 8,
                    border: "1px solid var(--cs-border)",
                    background: "var(--cs-surface)",
                    fontSize: "0.875rem",
                    color: "var(--cs-text)",
                    opacity: isPending ? 0.6 : 1,
                    cursor: isPending ? "not-allowed" : "default",
                  }}
                >
                  <option value="">Search eligible provider…</option>
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
                    height: 38,
                    borderRadius: 8,
                    border: "none",
                    background:
                      selectedStaffId && !isPending ? "var(--cs-sand)" : "var(--cs-border)",
                    color: selectedStaffId && !isPending ? "#fff" : "var(--cs-text-muted)",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    cursor: selectedStaffId && !isPending ? "pointer" : "not-allowed",
                    transition: "background 0.15s",
                  }}
                >
                  {isPending ? "Saving…" : "Assign Provider"}
                </button>
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
        </div>
      </SheetContent>
    </Sheet>
  );
}
