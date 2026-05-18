"use client";

import { useState, useEffect, useTransition, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { updateStaffAction } from "@/app/(dashboard)/owner/staff/actions";
import { STAFF_TYPES, STAFF_TYPE_LABELS } from "@/constants/staff";
import {
  getStaffStatus,
  getStaffStatusLabel,
  readBranchName,
  getInitials,
} from "./staff-management-utils";
import { StaffServiceEditorSheet } from "./staff-service-editor-sheet";
import type { StaffMember } from "./staff-management-utils";
import type { Database } from "@/types/supabase";

type ServiceRow = Database["public"]["Tables"]["services"]["Row"] & {
  service_categories: { id: string; name: string } | null;
};
type BranchRow = Database["public"]["Tables"]["branches"]["Row"];

// ── Constants ─────────────────────────────────────────────────────────────────

const MANAGER_ROLE_OPTIONS = [
  { value: "crm",      label: "CRM" },
  { value: "csr_head", label: "CSR Head" },
  { value: "csr_staff",label: "CSR Staff" },
  { value: "csr",      label: "CSR (legacy)" },
  { value: "staff",    label: "Staff" },
  { value: "driver",   label: "Driver" },
] as const;

const SENSITIVE_SYSTEM_ROLES = new Set([
  "owner", "manager", "assistant_manager", "store_manager",
  "super_admin", "platform_admin", "branch_manager",
]);

const SERVICE_CAPABLE_TYPES = new Set([
  "therapist", "nail_tech", "aesthetician", "salon_head",
]);

const STATUS_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  active:   { bg: "#F0FDF4", color: "#15803D", border: "#BBF7D0" },
  awaiting: { bg: "#FFFBEB", color: "#92400E", border: "#FDE68A" },
  invited:  { bg: "#EFF6FF", color: "#1D4ED8", border: "#BFDBFE" },
  inactive: { bg: "#F9FAFB", color: "#6B7280", border: "#E5E7EB" },
};

const PREVIEW_CHIP_MAX = 6;

// ── Draft types ───────────────────────────────────────────────────────────────

type Draft = {
  fullName:   string;
  nickname:   string;
  phone:      string;
  systemRole: string;
  staffType:  string;
  isHead:     boolean;
  tier:       string;
  isActive:   boolean;
  serviceIds: string[];
};

type ActionResult = { success: boolean; error?: string };

// ── Draft helpers ─────────────────────────────────────────────────────────────

function draftKey(staffId: string) {
  return `manager-staff-edit-draft:${staffId}`;
}

function fromMember(member: StaffMember, serviceIds: string[]): Draft {
  return {
    fullName:   member.full_name,
    nickname:   member.nickname ?? "",
    phone:      member.phone ?? "",
    systemRole: member.system_role,
    staffType:  member.staff_type ?? "therapist",
    isHead:     member.is_head ?? false,
    tier:       member.tier ?? "n/a",
    isActive:   member.is_active,
    serviceIds: [...serviceIds],
  };
}

function draftsEqual(a: Draft, b: Draft): boolean {
  return (
    a.fullName   === b.fullName   &&
    a.nickname   === b.nickname   &&
    a.phone      === b.phone      &&
    a.systemRole === b.systemRole &&
    a.staffType  === b.staffType  &&
    a.isHead     === b.isHead     &&
    a.tier       === b.tier       &&
    a.isActive   === b.isActive   &&
    [...a.serviceIds].sort().join(",") === [...b.serviceIds].sort().join(",")
  );
}

// ── Shared primitive styles ───────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 34,
  borderRadius: 6,
  border: "1px solid var(--cs-border)",
  padding: "0 0.5rem",
  fontSize: "0.875rem",
  backgroundColor: "var(--cs-surface)",
  color: "var(--cs-text)",
  boxSizing: "border-box",
};

const selectStyle: React.CSSProperties = { ...inputStyle, cursor: "pointer" };

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.inactive!;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "0.125rem 0.625rem",
        borderRadius: 999,
        fontSize: "0.75rem",
        fontWeight: 600,
        backgroundColor: s.bg,
        color: s.color,
        border: `1px solid ${s.border}`,
      }}
    >
      {getStaffStatusLabel(status as "active" | "awaiting" | "invited" | "inactive")}
    </span>
  );
}

// ── Page header ───────────────────────────────────────────────────────────────

function PageHeader({
  staffMember,
  isDirty,
  onBack,
}: {
  staffMember: StaffMember;
  isDirty: boolean;
  onBack: () => void;
}) {
  const status = getStaffStatus(staffMember);
  const branchName = readBranchName(staffMember.branches);

  return (
    <div style={{ marginBottom: "1.25rem" }}>
      <button
        onClick={onBack}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          fontSize: "0.8125rem",
          color: "var(--cs-text-muted)",
          padding: "0.25rem 0",
          marginBottom: "0.75rem",
          display: "inline-flex",
          alignItems: "center",
          gap: "0.375rem",
        }}
      >
        ← Back to staff list
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
        {/* Avatar */}
        <div
          aria-hidden
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            backgroundColor: "var(--cs-sand)",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "0.9375rem",
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {getInitials(staffMember.full_name)}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
            <h1
              style={{
                margin: 0,
                fontSize: "1.125rem",
                fontWeight: 700,
                color: "var(--cs-text)",
                lineHeight: 1.3,
              }}
            >
              {staffMember.full_name}
            </h1>
            <StatusBadge status={status} />
            {isDirty && (
              <span
                style={{
                  fontSize: "0.6875rem",
                  fontWeight: 600,
                  color: "#92400E",
                  backgroundColor: "#FFFBEB",
                  border: "1px solid #FDE68A",
                  borderRadius: 999,
                  padding: "0.1rem 0.5rem",
                }}
              >
                Unsaved changes
              </span>
            )}
          </div>
          <p
            style={{
              margin: "0.125rem 0 0",
              fontSize: "0.8125rem",
              color: "var(--cs-text-muted)",
            }}
          >
            {branchName} · {staffMember.system_role}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Draft restore banner ──────────────────────────────────────────────────────

function DraftRestoreBanner({
  onRestore,
  onDiscard,
}: {
  onRestore: () => void;
  onDiscard: () => void;
}) {
  return (
    <div
      role="alert"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        padding: "0.75rem 1rem",
        backgroundColor: "#EFF6FF",
        border: "1px solid #BFDBFE",
        borderRadius: 8,
        marginBottom: "1rem",
        flexWrap: "wrap",
      }}
    >
      <span style={{ flex: 1, fontSize: "0.875rem", color: "#1E40AF", minWidth: 180 }}>
        You have unsaved changes from a previous session.
      </span>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button
          onClick={onRestore}
          style={{
            fontSize: "0.8125rem",
            fontWeight: 600,
            color: "#1D4ED8",
            background: "none",
            border: "1px solid #93C5FD",
            borderRadius: 6,
            padding: "0.25rem 0.75rem",
            cursor: "pointer",
          }}
        >
          Restore draft
        </button>
        <button
          onClick={onDiscard}
          style={{
            fontSize: "0.8125rem",
            color: "#6B7280",
            background: "none",
            border: "1px solid var(--cs-border)",
            borderRadius: 6,
            padding: "0.25rem 0.75rem",
            cursor: "pointer",
          }}
        >
          Discard
        </button>
      </div>
    </div>
  );
}

// ── Field label ───────────────────────────────────────────────────────────────

function FieldLabel({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      style={{
        display: "block",
        fontSize: "0.6875rem",
        fontWeight: 700,
        color: "var(--cs-text-muted)",
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        marginBottom: "0.25rem",
      }}
    >
      {children}
    </label>
  );
}

// ── Staff information card ────────────────────────────────────────────────────

function StaffInformationCard({
  draft,
  isProtected,
  onChange,
}: {
  draft: Draft;
  isProtected: boolean;
  onChange: <K extends keyof Draft>(key: K, value: Draft[K]) => void;
}) {
  if (isProtected) {
    return (
      <div
        role="alert"
        style={{
          padding: "0.75rem",
          backgroundColor: "#FEF2F2",
          border: "1px solid #FECACA",
          borderRadius: 8,
          fontSize: "0.875rem",
          color: "#991B1B",
          marginBottom: "1rem",
        }}
      >
        This account has elevated privileges. Editing requires owner approval.
      </div>
    );
  }

  return (
    <section
      aria-label="Staff information"
      style={{
        backgroundColor: "var(--cs-surface)",
        border: "1px solid var(--cs-border)",
        borderRadius: 10,
        padding: "1.125rem",
        marginBottom: "0.875rem",
      }}
    >
      <p
        style={{
          margin: "0 0 0.875rem",
          fontSize: "0.6875rem",
          fontWeight: 700,
          color: "var(--cs-text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        Staff Information
      </p>

      <div className="staff-info-grid">
        {/* Full name — spans all columns */}
        <div style={{ gridColumn: "1 / -1" }}>
          <FieldLabel htmlFor="si-fullName">Full name</FieldLabel>
          <input
            id="si-fullName"
            style={inputStyle}
            value={draft.fullName}
            onChange={(e) => onChange("fullName", e.target.value)}
            placeholder="Full name"
          />
        </div>

        {/* Nickname */}
        <div>
          <FieldLabel htmlFor="si-nickname">Nickname</FieldLabel>
          <input
            id="si-nickname"
            style={inputStyle}
            value={draft.nickname}
            onChange={(e) => onChange("nickname", e.target.value)}
            placeholder="e.g. Mia, Joy"
          />
        </div>

        {/* Phone */}
        <div>
          <FieldLabel htmlFor="si-phone">Phone</FieldLabel>
          <input
            id="si-phone"
            style={inputStyle}
            value={draft.phone}
            onChange={(e) => onChange("phone", e.target.value)}
            placeholder="09xx-xxx-xxxx"
          />
        </div>

        {/* System role */}
        <div>
          <FieldLabel htmlFor="si-role">System role</FieldLabel>
          <select
            id="si-role"
            style={selectStyle}
            value={draft.systemRole}
            onChange={(e) => onChange("systemRole", e.target.value)}
          >
            {MANAGER_ROLE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>

        {/* Job function */}
        <div>
          <FieldLabel htmlFor="si-type">Job function</FieldLabel>
          <select
            id="si-type"
            style={selectStyle}
            value={draft.staffType}
            onChange={(e) => onChange("staffType", e.target.value)}
          >
            {STAFF_TYPES.map((t) => (
              <option key={t} value={t}>{STAFF_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </div>

        {/* Tier */}
        <div>
          <FieldLabel htmlFor="si-tier">Tier</FieldLabel>
          <select
            id="si-tier"
            style={selectStyle}
            value={draft.tier}
            onChange={(e) => onChange("tier", e.target.value)}
          >
            <option value="senior">Senior</option>
            <option value="mid">Mid</option>
            <option value="junior">Junior</option>
            <option value="head">Head</option>
            <option value="n/a">N/A</option>
          </select>
        </div>

        {/* Department head toggle */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <label
            htmlFor="si-isHead"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              fontSize: "0.875rem",
              color: "var(--cs-text)",
              cursor: "pointer",
              marginTop: "1.125rem",
            }}
          >
            <input
              id="si-isHead"
              type="checkbox"
              checked={draft.isHead}
              onChange={(e) => onChange("isHead", e.target.checked)}
            />
            Department head
          </label>
        </div>

        {/* Active toggle */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <label
            htmlFor="si-isActive"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              fontSize: "0.875rem",
              color: "var(--cs-text)",
              cursor: "pointer",
              marginTop: "1.125rem",
            }}
          >
            <input
              id="si-isActive"
              type="checkbox"
              checked={draft.isActive}
              onChange={(e) => onChange("isActive", e.target.checked)}
            />
            Active staff member
          </label>
        </div>
      </div>
    </section>
  );
}

// ── Service capabilities summary card ────────────────────────────────────────

function ServiceSummaryCard({
  services,
  selectedIds,
  staffType,
  onEditServices,
}: {
  services: ServiceRow[];
  selectedIds: string[];
  staffType: string;
  onEditServices: () => void;
}) {
  const serviceMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of services) m.set(s.id, s.name);
    return m;
  }, [services]);

  const count = selectedIds.length;
  const preview = selectedIds.slice(0, PREVIEW_CHIP_MAX);
  const overflow = count - PREVIEW_CHIP_MAX;
  const isServiceCapable = SERVICE_CAPABLE_TYPES.has(staffType);

  const helperText = count > 0
    ? "Staff will be matched to bookings for their assigned services."
    : isServiceCapable
    ? "No services assigned — staff will use legacy scheduling until at least one service is set."
    : "Service capabilities are optional for this job function.";

  return (
    <section
      aria-label="Service capabilities"
      style={{
        backgroundColor: "var(--cs-surface)",
        border: "1px solid var(--cs-border)",
        borderRadius: 10,
        padding: "1.125rem",
      }}
    >
      {/* Header row */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "0.75rem",
          marginBottom: "0.75rem",
          flexWrap: "wrap",
        }}
      >
        <div>
          <p
            style={{
              margin: 0,
              fontSize: "0.6875rem",
              fontWeight: 700,
              color: "var(--cs-text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            Service Capabilities
          </p>
          <p
            style={{
              margin: "0.25rem 0 0",
              fontSize: "0.9375rem",
              fontWeight: 700,
              color: count > 0 ? "var(--cs-text)" : "var(--cs-text-muted)",
            }}
          >
            {count > 0 ? `${count} service${count !== 1 ? "s" : ""} assigned` : "No services assigned"}
          </p>
        </div>
        <button
          onClick={onEditServices}
          style={{
            fontSize: "0.8125rem",
            fontWeight: 600,
            color: "var(--cs-sand)",
            background: "none",
            border: "1px solid var(--cs-sand)",
            borderRadius: 7,
            padding: "0.35rem 0.875rem",
            cursor: "pointer",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          Edit services
        </button>
      </div>

      {/* Helper text */}
      {count === 0 && isServiceCapable && (
        <div
          role="alert"
          style={{
            padding: "0.5rem 0.75rem",
            backgroundColor: "#FFFBEB",
            border: "1px solid #FDE68A",
            borderRadius: 6,
            fontSize: "0.8125rem",
            color: "#92400E",
            marginBottom: "0.75rem",
          }}
        >
          {helperText}
        </div>
      )}

      {count === 0 && !isServiceCapable && (
        <p style={{ margin: "0 0 0.75rem", fontSize: "0.8125rem", color: "var(--cs-text-muted)" }}>
          {helperText}
        </p>
      )}

      {/* Preview chips */}
      {count > 0 && (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem", marginBottom: "0.625rem" }}>
            {preview.map((id) => (
              <span
                key={id}
                style={{
                  fontSize: "0.8125rem",
                  padding: "0.2rem 0.625rem",
                  borderRadius: 999,
                  border: "1px solid var(--cs-sand)",
                  backgroundColor: "var(--cs-sand)",
                  color: "#fff",
                  fontWeight: 500,
                }}
              >
                {serviceMap.get(id) ?? id}
              </span>
            ))}
            {overflow > 0 && (
              <button
                onClick={onEditServices}
                style={{
                  fontSize: "0.8125rem",
                  padding: "0.2rem 0.625rem",
                  borderRadius: 999,
                  border: "1px solid var(--cs-border)",
                  backgroundColor: "transparent",
                  color: "var(--cs-text-muted)",
                  cursor: "pointer",
                  fontWeight: 500,
                }}
              >
                +{overflow} more
              </button>
            )}
          </div>
          <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--cs-text-muted)" }}>
            Assigning more services increases this staff member&apos;s availability in booking.
          </p>
        </>
      )}
    </section>
  );
}

// ── Summary row ───────────────────────────────────────────────────────────────

function SummaryRow({
  label,
  value,
  changed,
}: {
  label: string;
  value: string;
  changed?: boolean;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
      <span style={{ fontSize: "0.8125rem", color: "var(--cs-text-muted)", flexShrink: 0 }}>
        {label}
      </span>
      <span
        style={{
          fontSize: "0.8125rem",
          color: changed ? "#92400E" : "var(--cs-text)",
          fontWeight: changed ? 600 : 400,
          textAlign: "right",
        }}
      >
        {value}{changed ? " *" : ""}
      </span>
    </div>
  );
}

// ── Action button ─────────────────────────────────────────────────────────────

function ActionBtn({
  children,
  onClick,
  disabled,
  variant,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant: "primary" | "outline" | "ghost";
}) {
  const styles: React.CSSProperties = {
    width: "100%",
    padding: "0.5rem 1rem",
    borderRadius: 7,
    fontSize: "0.875rem",
    fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.55 : 1,
    ...(variant === "primary"
      ? { backgroundColor: "var(--cs-sand)", color: "#fff", border: "none" }
      : variant === "outline"
      ? { backgroundColor: "transparent", color: "var(--cs-sand)", border: "1px solid var(--cs-sand)" }
      : { backgroundColor: "transparent", color: "var(--cs-text-muted)", border: "1px solid var(--cs-border)" }),
  };
  return (
    <button onClick={onClick} disabled={disabled} style={styles}>
      {children}
    </button>
  );
}

// ── Approval summary panel ────────────────────────────────────────────────────

function ApprovalSummaryPanel({
  staffMember,
  branch,
  draft,
  savedDraft,
  services,
  isDirty,
  isPending,
  result,
  onSave,
  onApproveAndActivate,
  onDiscard,
}: {
  staffMember: StaffMember;
  branch: BranchRow | null;
  draft: Draft;
  savedDraft: Draft;
  services: ServiceRow[];
  isDirty: boolean;
  isPending: boolean;
  result: ActionResult | null;
  onSave: () => void;
  onApproveAndActivate: () => void;
  onDiscard: () => void;
}) {
  const status = getStaffStatus(staffMember);
  const canApprove = status === "awaiting" || status === "inactive";
  const isProtected = SENSITIVE_SYSTEM_ROLES.has(staffMember.system_role);
  const branchName = branch?.name ?? readBranchName(staffMember.branches);
  const isServiceCapable = SERVICE_CAPABLE_TYPES.has(draft.staffType);

  const roleLabel =
    MANAGER_ROLE_OPTIONS.find((r) => r.value === draft.systemRole)?.label ?? draft.systemRole;

  const staffTypeLabel =
    STAFF_TYPE_LABELS[draft.staffType as keyof typeof STAFF_TYPE_LABELS] ?? draft.staffType;

  const serviceMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of services) m.set(s.id, s.name);
    return m;
  }, [services]);

  const previewIds = draft.serviceIds.slice(0, PREVIEW_CHIP_MAX);
  const overflow = draft.serviceIds.length - PREVIEW_CHIP_MAX;

  return (
    <aside
      aria-label="Approval summary"
      style={{
        backgroundColor: "var(--cs-surface)",
        border: "1px solid var(--cs-border)",
        borderRadius: 10,
        padding: "1.125rem",
        position: "sticky",
        top: "1.5rem",
      }}
    >
      <p
        style={{
          margin: "0 0 1rem",
          fontSize: "0.6875rem",
          fontWeight: 700,
          color: "var(--cs-text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        Summary
      </p>

      {/* Info rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1rem" }}>
        <SummaryRow label="Branch" value={branchName} />
        <SummaryRow
          label="Role"
          value={roleLabel}
          changed={draft.systemRole !== savedDraft.systemRole}
        />
        <SummaryRow
          label="Job"
          value={staffTypeLabel}
          changed={draft.staffType !== savedDraft.staffType}
        />
        <SummaryRow
          label="Tier"
          value={draft.tier === "n/a" ? "—" : draft.tier}
          changed={draft.tier !== savedDraft.tier}
        />
        <SummaryRow
          label="Status"
          value={draft.isActive ? "Active" : "Inactive"}
          changed={draft.isActive !== savedDraft.isActive}
        />
        <SummaryRow
          label="Services"
          value={
            draft.serviceIds.length > 0
              ? `${draft.serviceIds.length} assigned`
              : "None assigned"
          }
          changed={
            [...draft.serviceIds].sort().join(",") !==
            [...savedDraft.serviceIds].sort().join(",")
          }
        />
        {draft.isHead && <SummaryRow label="" value="Department head ✓" />}
      </div>

      {/* Service preview */}
      {draft.serviceIds.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem", marginBottom: "0.875rem" }}>
          {previewIds.map((id) => (
            <span
              key={id}
              style={{
                fontSize: "0.75rem",
                padding: "0.15rem 0.5rem",
                borderRadius: 999,
                border: "1px solid var(--cs-sand)",
                color: "var(--cs-sand)",
                fontWeight: 500,
              }}
            >
              {serviceMap.get(id) ?? id}
            </span>
          ))}
          {overflow > 0 && (
            <span
              style={{
                fontSize: "0.75rem",
                padding: "0.15rem 0.5rem",
                borderRadius: 999,
                border: "1px solid var(--cs-border)",
                color: "var(--cs-text-muted)",
              }}
            >
              +{overflow}
            </span>
          )}
        </div>
      )}

      {/* Service messaging */}
      {draft.serviceIds.length > 0 ? (
        <div
          style={{
            padding: "0.5rem 0.75rem",
            backgroundColor: "#F0FDF4",
            border: "1px solid #BBF7D0",
            borderRadius: 6,
            fontSize: "0.8125rem",
            color: "#15803D",
            marginBottom: "0.875rem",
          }}
        >
          This staff member is available for booking matching based on their assigned services.
        </div>
      ) : isServiceCapable ? (
        <div
          role="alert"
          style={{
            padding: "0.5rem 0.75rem",
            backgroundColor: "#FFFBEB",
            border: "1px solid #FDE68A",
            borderRadius: 6,
            fontSize: "0.8125rem",
            color: "#92400E",
            marginBottom: "0.875rem",
          }}
        >
          No services selected. This staff member will not appear in service-specific booking matching.
        </div>
      ) : null}

      {/* Approve warning */}
      {canApprove && !isProtected && (
        <div
          style={{
            padding: "0.5rem 0.75rem",
            backgroundColor: "#FFFBEB",
            border: "1px solid #FDE68A",
            borderRadius: 6,
            fontSize: "0.8125rem",
            color: "#92400E",
            marginBottom: "0.875rem",
          }}
        >
          {status === "awaiting"
            ? "Awaiting approval — use Approve & Activate to make this staff member active."
            : "Staff member is currently inactive."}
        </div>
      )}

      {/* Internal tier note */}
      <p
        style={{
          margin: "0 0 0.875rem",
          fontSize: "0.75rem",
          color: "var(--cs-text-muted)",
          fontStyle: "italic",
        }}
      >
        Tier is for internal use only and is never shown to customers.
      </p>

      {/* Action result */}
      {result && (
        <div
          role="status"
          style={{
            padding: "0.5rem 0.75rem",
            backgroundColor: result.success ? "#F0FDF4" : "#FEF2F2",
            border: `1px solid ${result.success ? "#BBF7D0" : "#FECACA"}`,
            borderRadius: 6,
            fontSize: "0.8125rem",
            color: result.success ? "#15803D" : "#991B1B",
            marginBottom: "0.75rem",
          }}
        >
          {result.success ? "Changes saved successfully." : result.error ?? "Something went wrong."}
        </div>
      )}

      {/* Actions */}
      {!isProtected && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {canApprove && (
            <ActionBtn
              variant="primary"
              onClick={onApproveAndActivate}
              disabled={isPending}
            >
              {isPending ? "Saving…" : "Approve & Activate"}
            </ActionBtn>
          )}
          <ActionBtn
            variant={canApprove ? "outline" : "primary"}
            onClick={onSave}
            disabled={isPending || !isDirty}
          >
            {isPending ? "Saving…" : "Save Changes"}
          </ActionBtn>
          {isDirty && (
            <ActionBtn variant="ghost" onClick={onDiscard} disabled={isPending}>
              Discard Changes
            </ActionBtn>
          )}
        </div>
      )}
    </aside>
  );
}

// ── Main orchestrator ─────────────────────────────────────────────────────────

export function StaffApprovalWorkspace({
  staffMember,
  branch,
  services,
  staffServiceIds,
}: {
  staffMember: StaffMember;
  branch: BranchRow | null;
  services: ServiceRow[];
  staffServiceIds: string[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const canonical = useMemo(
    () => fromMember(staffMember, staffServiceIds),
    // Stable on mount — staffMember.id won't change within a page load
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [staffMember.id]
  );

  const storageKey = draftKey(staffMember.id);

  // ── State (lazy-initialized from localStorage to avoid setState-in-effect) ──

  const [draft, setDraft] = useState<Draft>(() => {
    if (typeof window === "undefined") return canonical;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return canonical;
      const parsed = JSON.parse(raw) as Draft;
      return !draftsEqual(parsed, canonical) ? parsed : canonical;
    } catch {
      return canonical;
    }
  });

  const [showRestoreBanner, setShowRestoreBanner] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return false;
      const parsed = JSON.parse(raw) as Draft;
      return !draftsEqual(parsed, canonical);
    } catch {
      return false;
    }
  });

  const [savedDraft, setSavedDraft] = useState<Draft>(canonical);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);

  const isDirty = !draftsEqual(draft, savedDraft);

  // Persist draft to localStorage whenever it changes
  useEffect(() => {
    if (draftsEqual(draft, canonical)) {
      localStorage.removeItem(storageKey);
    } else {
      try {
        localStorage.setItem(storageKey, JSON.stringify(draft));
      } catch {
        // Storage quota exceeded — ignore
      }
    }
  }, [draft, canonical, storageKey]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleChange = useCallback(<K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setResult(null);
  }, []);

  const handleToggleService = useCallback((id: string) => {
    setDraft((prev) => {
      const s = new Set(prev.serviceIds);
      if (s.has(id)) s.delete(id); else s.add(id);
      return { ...prev, serviceIds: Array.from(s) };
    });
    setResult(null);
  }, []);

  const handleRestoreDraft = useCallback(() => {
    setShowRestoreBanner(false);
    // draft is already the stored version (initialized from localStorage)
  }, []);

  const handleDiscardStoredDraft = useCallback(() => {
    localStorage.removeItem(storageKey);
    setDraft(canonical);
    setShowRestoreBanner(false);
    setResult(null);
  }, [canonical, storageKey]);

  const handleDiscard = useCallback(() => {
    setDraft(savedDraft);
    localStorage.removeItem(storageKey);
    setResult(null);
  }, [savedDraft, storageKey]);

  const buildPayload = useCallback(
    (overrideIsActive: boolean) => ({
      staffId:    staffMember.id,
      fullName:   draft.fullName.trim(),
      nickname:   draft.nickname.trim() || null,
      phone:      draft.phone.trim() || undefined,
      tier:       draft.tier,
      systemRole: draft.systemRole,
      staffType:  draft.staffType,
      isHead:     draft.isHead,
      branchId:   staffMember.branch_id ?? undefined,
      isActive:   overrideIsActive,
      serviceIds: draft.serviceIds.length > 0 ? draft.serviceIds : undefined,
    }),
    [draft, staffMember]
  );

  const handleSave = useCallback(() => {
    startTransition(async () => {
      const res = await updateStaffAction(buildPayload(draft.isActive));
      setResult({ success: res.success, error: res.error });
      if (res.success) {
        setSavedDraft({ ...draft });
        localStorage.removeItem(storageKey);
        router.refresh();
      }
    });
  }, [buildPayload, draft, router, storageKey]);

  const handleApproveAndActivate = useCallback(() => {
    startTransition(async () => {
      const res = await updateStaffAction(buildPayload(true));
      setResult({ success: res.success, error: res.error });
      if (res.success) {
        setSavedDraft({ ...draft, isActive: true });
        localStorage.removeItem(storageKey);
        router.refresh();
      }
    });
  }, [buildPayload, draft, router, storageKey]);

  const isProtected = SENSITIVE_SYSTEM_ROLES.has(staffMember.system_role);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      <PageHeader
        staffMember={staffMember}
        isDirty={isDirty}
        onBack={() => router.push("/manager/staff")}
      />

      {showRestoreBanner && (
        <DraftRestoreBanner
          onRestore={handleRestoreDraft}
          onDiscard={handleDiscardStoredDraft}
        />
      )}

      {/* Two-column responsive grid */}
      <div className="staff-approval-grid">
        {/* Left column */}
        <div>
          <StaffInformationCard
            draft={draft}
            isProtected={isProtected}
            onChange={handleChange}
          />
          <ServiceSummaryCard
            services={services}
            selectedIds={draft.serviceIds}
            staffType={draft.staffType}
            onEditServices={() => setIsSheetOpen(true)}
          />
        </div>

        {/* Right column */}
        <div>
          <ApprovalSummaryPanel
            staffMember={staffMember}
            branch={branch}
            draft={draft}
            savedDraft={savedDraft}
            services={services}
            isDirty={isDirty}
            isPending={isPending}
            result={result}
            onSave={handleSave}
            onApproveAndActivate={handleApproveAndActivate}
            onDiscard={handleDiscard}
          />
        </div>
      </div>

      {/* Service editor sheet */}
      <StaffServiceEditorSheet
        open={isSheetOpen}
        services={services}
        selectedIds={draft.serviceIds}
        onToggle={handleToggleService}
        onClose={() => setIsSheetOpen(false)}
      />

      {/* Responsive layout styles */}
      <style>{`
        .staff-approval-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1rem;
        }
        @media (min-width: 768px) {
          .staff-approval-grid {
            grid-template-columns: 1fr 300px;
          }
        }
        @media (min-width: 1024px) {
          .staff-approval-grid {
            grid-template-columns: 1fr 320px;
          }
        }
        .staff-info-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 0.75rem;
        }
        @media (min-width: 480px) {
          .staff-info-grid {
            grid-template-columns: 1fr 1fr;
          }
        }
        @media (min-width: 900px) {
          .staff-info-grid {
            grid-template-columns: 1fr 1fr 1fr;
          }
        }
      `}</style>
    </div>
  );
}
