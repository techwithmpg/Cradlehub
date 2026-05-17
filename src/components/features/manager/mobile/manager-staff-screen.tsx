"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Users, ChevronRight, UserCheck } from "lucide-react";
import type { StaffMember } from "@/components/features/staff/staff-management-utils";
import {
  getStaffStatus,
  getStaffStatusLabel,
  getStaffDisplayMeta,
  getStaffInternalName,
  getInitials,
} from "@/components/features/staff/staff-management-utils";
import type { StaffSegment } from "./types";

type Props = {
  allStaff: StaffMember[];
  pendingStaff: StaffMember[];
};

export function ManagerStaffScreen({ allStaff, pendingStaff }: Props) {
  const [segment, setSegment] = useState<StaffSegment>("active");

  const filtered = useMemo(() => {
    if (segment === "active") return allStaff.filter((s) => s.is_active);
    if (segment === "pending") return pendingStaff;
    if (segment === "offduty") return allStaff.filter((s) => !s.is_active);
    return allStaff;
  }, [allStaff, pendingStaff, segment]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {/* Header */}
      <div>
        <h1
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: "var(--cs-text)",
            fontFamily: "var(--font-display)",
            margin: 0,
            lineHeight: 1.2,
          }}
        >
          Staff
        </h1>
        <p style={{ fontSize: 13, color: "var(--cs-text-muted)", margin: "4px 0 0" }}>
          Team overview and approvals
        </p>
      </div>

      {/* Pending Count Card */}
      {pendingStaff.length > 0 && (
        <Link
          href="/manager/staff?tab=pending"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            background: "var(--cs-warning-bg)",
            border: "1px solid var(--cs-warning-bg)",
            borderRadius: "var(--cs-r-lg)",
            padding: "12px 14px",
            textDecoration: "none",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: "var(--cs-warning)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
              }}
            >
              <UserCheck size={18} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--cs-warning-text)" }}>
                {pendingStaff.length} pending approval{pendingStaff.length > 1 ? "s" : ""}
              </div>
              <div style={{ fontSize: 12, color: "var(--cs-warning-text)", opacity: 0.8 }}>
                Review and activate staff
              </div>
            </div>
          </div>
          <ChevronRight size={18} style={{ color: "var(--cs-warning-text)" }} />
        </Link>
      )}

      {/* Segments */}
      <div
        style={{
          display: "flex",
          background: "var(--cs-surface)",
          border: "1px solid var(--cs-border-soft)",
          borderRadius: "var(--cs-r-lg)",
          padding: 4,
          gap: 4,
        }}
      >
        {([
          { key: "active" as StaffSegment, label: "Active" },
          { key: "pending" as StaffSegment, label: `Pending ${pendingStaff.length > 0 ? `(${pendingStaff.length})` : ""}` },
          { key: "offduty" as StaffSegment, label: "Off Duty" },
        ]).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setSegment(t.key)}
            style={{
              flex: 1,
              padding: "8px 0",
              borderRadius: "var(--cs-r-md)",
              border: "none",
              background: segment === t.key ? "var(--cs-sand-tint)" : "transparent",
              color: segment === t.key ? "var(--cs-sand-dark)" : "var(--cs-text-muted)",
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Staff List */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.length === 0 ? (
          <EmptyState
            message={
              segment === "active"
                ? "No active staff found"
                : segment === "pending"
                ? "No approvals waiting"
                : "No off-duty staff"
            }
          />
        ) : (
          filtered.map((member) => <StaffCard key={member.id} member={member} />)
        )}
      </div>
    </div>
  );
}

function StaffCard({ member }: { member: StaffMember }) {
  const meta = getStaffDisplayMeta(member);
  const status = getStaffStatus(member);
  const statusLabel = getStaffStatusLabel(status);
  const displayName = getStaffInternalName(member);

  return (
    <Link
      href={`/manager/staff/${member.id}`}
      style={{
        background: "var(--cs-surface)",
        border: "1px solid var(--cs-border-soft)",
        borderRadius: "var(--cs-r-lg)",
        padding: "14px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        boxShadow: "var(--cs-shadow-xs)",
        textDecoration: "none",
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: "50%",
          background: member.is_active ? "var(--cs-sand-mist)" : "var(--cs-neutral-bg)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          color: member.is_active ? "var(--cs-sand-dark)" : "var(--cs-neutral)",
          fontSize: 14,
          fontWeight: 700,
        }}
      >
        {getInitials(displayName)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "var(--cs-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {displayName}
        </div>
        <div style={{ fontSize: 12, color: "var(--cs-text-muted)", marginTop: 2 }}>
          {meta.staffTypeLabel}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              padding: "2px 8px",
              borderRadius: "var(--cs-r-pill)",
              background: member.is_active ? "var(--cs-success-bg)" : "var(--cs-warning-bg)",
              color: member.is_active ? "var(--cs-success-text)" : "var(--cs-warning-text)",
            }}
          >
            {statusLabel}
          </span>
          {meta.tierLabel && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                padding: "2px 8px",
                borderRadius: "var(--cs-r-pill)",
                background: "var(--cs-info-bg)",
                color: "var(--cs-info-text)",
              }}
            >
              {meta.tierLabel}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "2rem 1rem",
        color: "var(--cs-text-muted)",
        fontSize: 14,
        background: "var(--cs-surface)",
        border: "1px solid var(--cs-border-soft)",
        borderRadius: "var(--cs-r-lg)",
      }}
    >
      <Users size={28} style={{ marginBottom: 8, opacity: 0.4 }} />
      <div>{message}</div>
    </div>
  );
}
