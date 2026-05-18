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
import type { StaffMember } from "./staff-management-utils";
import type { Database } from "@/types/supabase";

type ServiceRow = Database["public"]["Tables"]["services"]["Row"] & {
  service_categories: { id: string; name: string } | null;
};
type BranchRow = Database["public"]["Tables"]["branches"]["Row"];

// ── Constants ─────────────────────────────────────────────────────────────────

const MANAGER_ROLE_OPTIONS = [
  { value: "crm", label: "CRM" },
  { value: "csr_head", label: "CSR Head" },
  { value: "csr_staff", label: "CSR Staff" },
  { value: "csr", label: "CSR (legacy)" },
  { value: "staff", label: "Staff" },
  { value: "driver", label: "Driver" },
] as const;

const SENSITIVE_SYSTEM_ROLES = new Set([
  "owner",
  "manager",
  "assistant_manager",
  "store_manager",
  "super_admin",
  "platform_admin",
  "branch_manager",
]);

const SERVICE_CAPABLE_STAFF_TYPES = new Set([
  "therapist",
  "nail_tech",
  "aesthetician",
  "salon_head",
]);

const STATUS_BADGE_STYLES: Record<string, { bg: string; color: string; border: string }> = {
  active:   { bg: "#F0FDF4", color: "#15803D", border: "#BBF7D0" },
  awaiting: { bg: "#FFFBEB", color: "#92400E", border: "#FDE68A" },
  invited:  { bg: "#EFF6FF", color: "#1D4ED8", border: "#BFDBFE" },
  inactive: { bg: "#F9FAFB", color: "#6B7280", border: "#E5E7EB" },
};

// ── Types ─────────────────────────────────────────────────────────────────────

type Draft = {
  fullName: string;
  nickname: string;
  phone: string;
  systemRole: string;
  staffType: string;
  isHead: boolean;
  tier: string;
  serviceIds: string[];
};

type SaveResult = { success: boolean; error?: string };

// ── Draft persistence ─────────────────────────────────────────────────────────

function draftStorageKey(staffId: string) {
  return `manager-staff-edit-draft:${staffId}`;
}

function makeDraftFromMember(member: StaffMember, serviceIds: string[]): Draft {
  return {
    fullName:   member.full_name,
    nickname:   member.nickname ?? "",
    phone:      member.phone ?? "",
    systemRole: member.system_role,
    staffType:  member.staff_type ?? "therapist",
    isHead:     member.is_head ?? false,
    tier:       member.tier ?? "n/a",
    serviceIds: [...serviceIds],
  };
}

function draftsAreEqual(a: Draft, b: Draft): boolean {
  return (
    a.fullName === b.fullName &&
    a.nickname === b.nickname &&
    a.phone === b.phone &&
    a.systemRole === b.systemRole &&
    a.staffType === b.staffType &&
    a.isHead === b.isHead &&
    a.tier === b.tier &&
    a.serviceIds.length === b.serviceIds.length &&
    [...a.serviceIds].sort().join(",") === [...b.serviceIds].sort().join(",")
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_BADGE_STYLES[status] ?? STATUS_BADGE_STYLES.inactive!;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "0.125rem 0.625rem",
        borderRadius: 999,
        fontSize: "0.75rem",
        fontWeight: 600,
        backgroundColor: style.bg,
        color: style.color,
        border: `1px solid ${style.border}`,
      }}
    >
      {getStaffStatusLabel(status as "active" | "awaiting" | "invited" | "inactive")}
    </span>
  );
}

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
          display: "inline-flex",
          alignItems: "center",
          gap: "0.375rem",
          fontSize: "0.8125rem",
          color: "var(--cs-text-muted)",
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "0.25rem 0",
          marginBottom: "0.75rem",
        }}
      >
        ← Back to staff list
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
        {/* Avatar */}
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            backgroundColor: "var(--cs-sand)",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "0.875rem",
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
                  fontSize: "0.75rem",
                  color: "#92400E",
                  backgroundColor: "#FFFBEB",
                  border: "1px solid #FDE68A",
                  borderRadius: 999,
                  padding: "0.125rem 0.5rem",
                  fontWeight: 500,
                }}
              >
                Unsaved changes
              </span>
            )}
          </div>
          <p style={{ margin: "0.125rem 0 0", fontSize: "0.8125rem", color: "var(--cs-text-muted)" }}>
            {branchName} · {staffMember.system_role}
          </p>
        </div>
      </div>
    </div>
  );
}

function DraftRestoreBanner({
  onKeep,
  onDiscard,
}: {
  onKeep: () => void;
  onDiscard: () => void;
}) {
  return (
    <div
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
      <span style={{ flex: 1, fontSize: "0.875rem", color: "#1E40AF" }}>
        You have unsaved changes from a previous session.
      </span>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button
          onClick={onKeep}
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

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label
      style={{
        display: "block",
        fontSize: "0.75rem",
        fontWeight: 600,
        color: "var(--cs-text-muted)",
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        marginBottom: "0.3rem",
      }}
    >
      {children}
    </label>
  );
}

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

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: "pointer",
};

function StaffInformationCard({
  draft,
  staffMember,
  isProtected,
  onChange,
}: {
  draft: Draft;
  staffMember: StaffMember;
  isProtected: boolean;
  onChange: <K extends keyof Draft>(key: K, value: Draft[K]) => void;
}) {
  if (isProtected) {
    return (
      <div
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
        This account has elevated access. Editing it requires owner approval.
      </div>
    );
  }

  return (
    <div
      style={{
        backgroundColor: "var(--cs-surface)",
        border: "1px solid var(--cs-border)",
        borderRadius: 10,
        padding: "1.25rem",
        marginBottom: "1rem",
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
        Staff Information
      </p>

      {/* 2-col grid for compact layout */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "0.75rem",
        }}
        className="staff-info-grid"
      >
        {/* Full Name — spans 2 cols */}
        <div style={{ gridColumn: "1 / -1" }}>
          <FieldLabel>Full name</FieldLabel>
          <input
            style={inputStyle}
            value={draft.fullName}
            onChange={(e) => onChange("fullName", e.target.value)}
            placeholder="Full name"
          />
        </div>

        {/* Nickname */}
        <div>
          <FieldLabel>Nickname</FieldLabel>
          <input
            style={inputStyle}
            value={draft.nickname}
            onChange={(e) => onChange("nickname", e.target.value)}
            placeholder="e.g. Mia, Joy"
          />
        </div>

        {/* Phone */}
        <div>
          <FieldLabel>Phone</FieldLabel>
          <input
            style={inputStyle}
            value={draft.phone}
            onChange={(e) => onChange("phone", e.target.value)}
            placeholder="09xx-xxx-xxxx"
          />
        </div>

        {/* System role */}
        <div>
          <FieldLabel>System role</FieldLabel>
          <select
            style={selectStyle}
            value={draft.systemRole}
            onChange={(e) => onChange("systemRole", e.target.value)}
          >
            {MANAGER_ROLE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        {/* Job function */}
        <div>
          <FieldLabel>Job function</FieldLabel>
          <select
            style={selectStyle}
            value={draft.staffType}
            onChange={(e) => onChange("staffType", e.target.value)}
          >
            {STAFF_TYPES.map((t) => (
              <option key={t} value={t}>
                {STAFF_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>

        {/* Tier */}
        <div>
          <FieldLabel>Tier</FieldLabel>
          <select
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

        {/* Is head checkbox */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              fontSize: "0.875rem",
              color: "var(--cs-text)",
              cursor: "pointer",
              marginTop: "1.1rem",
            }}
          >
            <input
              type="checkbox"
              checked={draft.isHead}
              onChange={(e) => onChange("isHead", e.target.checked)}
            />
            Department head
          </label>
        </div>
      </div>

      {staffMember.email && (
        <p
          style={{
            margin: "0.75rem 0 0",
            fontSize: "0.8125rem",
            color: "var(--cs-text-muted)",
          }}
        >
          Email: {staffMember.email}
        </p>
      )}
    </div>
  );
}

function ServiceCapabilityPicker({
  services,
  selectedIds,
  staffType,
  onToggle,
}: {
  services: ServiceRow[];
  selectedIds: string[];
  staffType: string;
  onToggle: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    for (const s of services) {
      cats.add(s.service_categories?.name ?? "Uncategorized");
    }
    return Array.from(cats).sort();
  }, [services]);

  const filteredServices = useMemo(() => {
    const q = search.trim().toLowerCase();
    return services.filter((s) => {
      const cat = s.service_categories?.name ?? "Uncategorized";
      if (activeCategory && cat !== activeCategory) return false;
      if (showSelectedOnly && !selectedSet.has(s.id)) return false;
      if (q && !s.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [services, activeCategory, showSelectedOnly, search, selectedSet]);

  const groupedFiltered = useMemo(() => {
    return filteredServices.reduce<Record<string, ServiceRow[]>>((acc, s) => {
      const cat = s.service_categories?.name ?? "Uncategorized";
      const list = acc[cat] ?? [];
      list.push(s);
      acc[cat] = list;
      return acc;
    }, {});
  }, [filteredServices]);

  const isServiceCapable = SERVICE_CAPABLE_STAFF_TYPES.has(staffType);

  return (
    <div
      style={{
        backgroundColor: "var(--cs-surface)",
        border: "1px solid var(--cs-border)",
        borderRadius: 10,
        padding: "1.25rem",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "0.75rem",
          flexWrap: "wrap",
          gap: "0.5rem",
        }}
      >
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
          {selectedIds.length > 0 && (
            <span
              style={{
                marginLeft: "0.5rem",
                backgroundColor: "var(--cs-sand)",
                color: "#fff",
                borderRadius: 999,
                padding: "0.1rem 0.45rem",
                fontSize: "0.7rem",
                fontWeight: 700,
              }}
            >
              {selectedIds.length}
            </span>
          )}
        </p>

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.375rem",
            fontSize: "0.8125rem",
            color: "var(--cs-text-muted)",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={showSelectedOnly}
            onChange={(e) => setShowSelectedOnly(e.target.checked)}
          />
          Selected only
        </label>
      </div>

      {!isServiceCapable && (
        <p
          style={{
            fontSize: "0.8125rem",
            color: "var(--cs-text-muted)",
            margin: "0 0 0.75rem",
            padding: "0.5rem 0.75rem",
            backgroundColor: "var(--cs-bg)",
            borderRadius: 6,
            border: "1px solid var(--cs-border)",
          }}
        >
          Service capabilities are optional for this job function. Assign them only if this staff member performs spa services.
        </p>
      )}

      {selectedIds.length === 0 && isServiceCapable && (
        <p
          style={{
            fontSize: "0.8125rem",
            color: "#92400E",
            margin: "0 0 0.75rem",
            padding: "0.5rem 0.75rem",
            backgroundColor: "#FFFBEB",
            borderRadius: 6,
            border: "1px solid #FDE68A",
          }}
        >
          No services assigned — staff will use legacy scheduling until at least one service is set.
        </p>
      )}

      {/* Search */}
      <input
        style={{ ...inputStyle, marginBottom: "0.75rem" }}
        placeholder="Search services…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {/* Category chips */}
      {categories.length > 1 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.375rem",
            marginBottom: "0.75rem",
          }}
        >
          <button
            onClick={() => setActiveCategory(null)}
            style={{
              fontSize: "0.75rem",
              fontWeight: 600,
              padding: "0.2rem 0.6rem",
              borderRadius: 999,
              border: `1px solid ${activeCategory === null ? "var(--cs-sand)" : "var(--cs-border)"}`,
              backgroundColor: activeCategory === null ? "var(--cs-sand)" : "transparent",
              color: activeCategory === null ? "#fff" : "var(--cs-text-muted)",
              cursor: "pointer",
            }}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
              style={{
                fontSize: "0.75rem",
                fontWeight: 500,
                padding: "0.2rem 0.6rem",
                borderRadius: 999,
                border: `1px solid ${activeCategory === cat ? "var(--cs-sand)" : "var(--cs-border)"}`,
                backgroundColor: activeCategory === cat ? "var(--cs-sand)" : "transparent",
                color: activeCategory === cat ? "#fff" : "var(--cs-text-muted)",
                cursor: "pointer",
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Quick actions */}
      {services.length > 0 && (
        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            marginBottom: "0.875rem",
          }}
        >
          <button
            onClick={() => {
              const visible = filteredServices.map((s) => s.id);
              for (const id of visible) {
                if (!selectedSet.has(id)) onToggle(id);
              }
            }}
            style={{
              fontSize: "0.75rem",
              color: "var(--cs-text-muted)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
              textDecoration: "underline",
            }}
          >
            Select visible
          </button>
          <span style={{ color: "var(--cs-border)" }}>·</span>
          <button
            onClick={() => {
              const visible = filteredServices.map((s) => s.id);
              for (const id of visible) {
                if (selectedSet.has(id)) onToggle(id);
              }
            }}
            style={{
              fontSize: "0.75rem",
              color: "var(--cs-text-muted)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
              textDecoration: "underline",
            }}
          >
            Deselect visible
          </button>
          <span style={{ color: "var(--cs-border)" }}>·</span>
          <button
            onClick={() => {
              for (const id of [...selectedIds]) onToggle(id);
            }}
            style={{
              fontSize: "0.75rem",
              color: "var(--cs-text-muted)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
              textDecoration: "underline",
            }}
          >
            Clear all
          </button>
        </div>
      )}

      {/* Service chips by category */}
      {Object.keys(groupedFiltered).length === 0 ? (
        <p style={{ fontSize: "0.875rem", color: "var(--cs-text-muted)", margin: 0 }}>
          No services match your filter.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {Object.entries(groupedFiltered).map(([cat, catServices]) => (
            <div key={cat}>
              <p
                style={{
                  margin: "0 0 0.375rem",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: "var(--cs-text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                {cat}
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
                {catServices.map((s) => {
                  const isSelected = selectedSet.has(s.id);
                  return (
                    <button
                      key={s.id}
                      onClick={() => onToggle(s.id)}
                      style={{
                        fontSize: "0.8125rem",
                        padding: "0.25rem 0.75rem",
                        borderRadius: 999,
                        border: `1px solid ${isSelected ? "var(--cs-sand)" : "var(--cs-border)"}`,
                        backgroundColor: isSelected ? "var(--cs-sand)" : "var(--cs-surface)",
                        color: isSelected ? "#fff" : "var(--cs-text)",
                        cursor: "pointer",
                        fontWeight: isSelected ? 600 : 400,
                        transition: "background-color 0.1s, color 0.1s",
                      }}
                    >
                      {s.name}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryPanel({
  staffMember,
  branch,
  draft,
  savedDraft,
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
  isDirty: boolean;
  isPending: boolean;
  result: SaveResult | null;
  onSave: () => void;
  onApproveAndActivate: () => void;
  onDiscard: () => void;
}) {
  const status = getStaffStatus(staffMember);
  const canApprove = status === "awaiting" || status === "inactive";
  const isProtected = SENSITIVE_SYSTEM_ROLES.has(staffMember.system_role);

  const branchName = branch?.name ?? readBranchName(staffMember.branches);

  const roleLabel =
    MANAGER_ROLE_OPTIONS.find((r) => r.value === draft.systemRole)?.label ?? draft.systemRole;

  const staffTypeLabel =
    STAFF_TYPE_LABELS[draft.staffType as keyof typeof STAFF_TYPE_LABELS] ?? draft.staffType;

  return (
    <div
      style={{
        backgroundColor: "var(--cs-surface)",
        border: "1px solid var(--cs-border)",
        borderRadius: 10,
        padding: "1.25rem",
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
        {draft.isHead && <SummaryRow label="" value="Department head" />}
      </div>

      {/* Warnings */}
      {canApprove && !isProtected && (
        <div
          style={{
            padding: "0.625rem 0.75rem",
            backgroundColor: "#FFFBEB",
            border: "1px solid #FDE68A",
            borderRadius: 6,
            fontSize: "0.8125rem",
            color: "#92400E",
            marginBottom: "1rem",
          }}
        >
          {status === "awaiting"
            ? "This staff member is awaiting approval to become active."
            : "This staff member is currently inactive."}
        </div>
      )}

      {/* Action result */}
      {result && (
        <div
          style={{
            padding: "0.625rem 0.75rem",
            backgroundColor: result.success ? "#F0FDF4" : "#FEF2F2",
            border: `1px solid ${result.success ? "#BBF7D0" : "#FECACA"}`,
            borderRadius: 6,
            fontSize: "0.8125rem",
            color: result.success ? "#15803D" : "#991B1B",
            marginBottom: "0.75rem",
          }}
        >
          {result.success ? "Changes saved." : result.error ?? "Something went wrong."}
        </div>
      )}

      {/* Actions */}
      {!isProtected && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {canApprove && (
            <ActionButton
              onClick={onApproveAndActivate}
              disabled={isPending}
              primary
            >
              {isPending ? "Saving…" : "Approve & Activate"}
            </ActionButton>
          )}
          <ActionButton
            onClick={onSave}
            disabled={isPending || !isDirty}
          >
            {isPending ? "Saving…" : "Save Changes"}
          </ActionButton>
          {isDirty && (
            <ActionButton onClick={onDiscard} disabled={isPending} muted>
              Discard Changes
            </ActionButton>
          )}
        </div>
      )}
    </div>
  );
}

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
      {label && (
        <span
          style={{
            fontSize: "0.8125rem",
            color: "var(--cs-text-muted)",
            flexShrink: 0,
          }}
        >
          {label}
        </span>
      )}
      <span
        style={{
          fontSize: "0.8125rem",
          color: changed ? "#92400E" : "var(--cs-text)",
          fontWeight: changed ? 600 : 400,
          textAlign: "right",
        }}
      >
        {value}
        {changed && " *"}
      </span>
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  disabled,
  primary,
  muted,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
  muted?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "100%",
        padding: "0.5rem 1rem",
        borderRadius: 7,
        fontSize: "0.875rem",
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
        border: primary
          ? "none"
          : muted
          ? "1px solid var(--cs-border)"
          : "1px solid var(--cs-sand)",
        backgroundColor: primary
          ? "var(--cs-sand)"
          : "transparent",
        color: primary ? "#fff" : muted ? "var(--cs-text-muted)" : "var(--cs-sand)",
        transition: "opacity 0.1s",
      }}
    >
      {children}
    </button>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

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
    () => makeDraftFromMember(staffMember, staffServiceIds),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [staffMember.id]
  );

  const [draft, setDraft] = useState<Draft>(canonical);
  const [savedDraft, setSavedDraft] = useState<Draft>(canonical);
  const storageKey = draftStorageKey(staffMember.id);

  const [showRestoreBanner, setShowRestoreBanner] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return false;
      const parsed = JSON.parse(raw) as Draft;
      return !draftsAreEqual(parsed, canonical);
    } catch {
      return false;
    }
  });

  const [storedDraft, setStoredDraft] = useState<Draft | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Draft;
      return !draftsAreEqual(parsed, canonical) ? parsed : null;
    } catch {
      return null;
    }
  });

  const [result, setResult] = useState<SaveResult | null>(null);

  // Save draft to localStorage on every change
  useEffect(() => {
    if (draftsAreEqual(draft, canonical)) {
      localStorage.removeItem(storageKey);
    } else {
      try {
        localStorage.setItem(storageKey, JSON.stringify(draft));
      } catch {
        // Storage full — ignore
      }
    }
  }, [draft, canonical, storageKey]);

  const isDirty = !draftsAreEqual(draft, savedDraft);

  const handleChange = useCallback(<K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setResult(null);
  }, []);

  const handleToggleService = useCallback((id: string) => {
    setDraft((prev) => {
      const set = new Set(prev.serviceIds);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return { ...prev, serviceIds: Array.from(set) };
    });
    setResult(null);
  }, []);

  const handleRestoreDraft = useCallback(() => {
    if (storedDraft) {
      setDraft(storedDraft);
    }
    setShowRestoreBanner(false);
    setStoredDraft(null);
  }, [storedDraft]);

  const handleDiscardStoredDraft = useCallback(() => {
    localStorage.removeItem(storageKey);
    setShowRestoreBanner(false);
    setStoredDraft(null);
  }, [storageKey]);

  const handleDiscard = useCallback(() => {
    setDraft(savedDraft);
    localStorage.removeItem(storageKey);
    setResult(null);
  }, [savedDraft, storageKey]);

  const buildPayload = useCallback(
    (isActive: boolean) => ({
      staffId:    staffMember.id,
      fullName:   draft.fullName.trim(),
      nickname:   draft.nickname.trim() || null,
      phone:      draft.phone.trim() || undefined,
      tier:       draft.tier,
      systemRole: draft.systemRole,
      staffType:  draft.staffType,
      isHead:     draft.isHead,
      branchId:   staffMember.branch_id ?? undefined,
      isActive,
      serviceIds: draft.serviceIds.length > 0 ? draft.serviceIds : undefined,
    }),
    [draft, staffMember]
  );

  const handleSave = useCallback(() => {
    startTransition(async () => {
      const res = await updateStaffAction(buildPayload(staffMember.is_active));
      setResult({ success: res.success, error: res.error });
      if (res.success) {
        setSavedDraft(draft);
        localStorage.removeItem(storageKey);
        router.refresh();
      }
    });
  }, [buildPayload, draft, router, staffMember.is_active, storageKey]);

  const handleApproveAndActivate = useCallback(() => {
    startTransition(async () => {
      const res = await updateStaffAction(buildPayload(true));
      setResult({ success: res.success, error: res.error });
      if (res.success) {
        setSavedDraft(draft);
        localStorage.removeItem(storageKey);
        router.refresh();
      }
    });
  }, [buildPayload, draft, router, storageKey]);

  const isProtected = SENSITIVE_SYSTEM_ROLES.has(staffMember.system_role);

  return (
    <div>
      <PageHeader
        staffMember={staffMember}
        isDirty={isDirty}
        onBack={() => router.push("/manager/staff")}
      />

      {showRestoreBanner && (
        <DraftRestoreBanner
          onKeep={handleRestoreDraft}
          onDiscard={handleDiscardStoredDraft}
        />
      )}

      {/* Two-column layout: left (form) + right (summary panel) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: "1rem",
        }}
        className="staff-approval-grid"
      >
        {/* Left column */}
        <div>
          <StaffInformationCard
            draft={draft}
            staffMember={staffMember}
            isProtected={isProtected}
            onChange={handleChange}
          />
          <ServiceCapabilityPicker
            services={services}
            selectedIds={draft.serviceIds}
            staffType={draft.staffType}
            onToggle={handleToggleService}
          />
        </div>

        {/* Right column: summary panel */}
        <div>
          <SummaryPanel
            staffMember={staffMember}
            branch={branch}
            draft={draft}
            savedDraft={savedDraft}
            isDirty={isDirty}
            isPending={isPending}
            result={result}
            onSave={handleSave}
            onApproveAndActivate={handleApproveAndActivate}
            onDiscard={handleDiscard}
          />
        </div>
      </div>

      {/* Responsive grid styles */}
      <style>{`
        @media (min-width: 768px) {
          .staff-approval-grid {
            grid-template-columns: 1fr 320px !important;
          }
        }
        @media (max-width: 480px) {
          .staff-info-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
