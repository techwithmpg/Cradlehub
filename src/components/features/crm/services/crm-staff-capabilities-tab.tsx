"use client";

/**
 * CrmStaffCapabilitiesTab
 *
 * Staff-first view of service capabilities.
 *
 * Shows each eligible provider staff member and how many services they are
 * assigned to. Links to the staff profile edit page for full capability editing.
 *
 * This is a read-only summary. Full editing is done through the staff profile
 * workspace (Manager/Owner → Staff → Edit Profile → Service Capabilities).
 */

import { useMemo } from "react";
import Link from "next/link";
import type { ActiveBranchService } from "@/components/features/manager-settings/types";
import type { StaffForServicePanel, ServiceAssignmentRow } from "@/lib/queries/crm-services";
import { SERVICE_STAFF_TYPES, STAFF_TYPE_LABELS } from "@/constants/staff-roles";
import type { ServiceStaffType } from "@/constants/staff-roles";

const HARD_EXCLUDED_SYSTEM_ROLES = new Set(["driver", "utility"]);
const SERVICE_STAFF_TYPE_SET = new Set<string>(SERVICE_STAFF_TYPES);

function isEligibleProvider(s: StaffForServicePanel): boolean {
  if (HARD_EXCLUDED_SYSTEM_ROLES.has(s.system_role)) return false;
  return s.staff_type !== null && SERVICE_STAFF_TYPE_SET.has(s.staff_type);
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StaffTypeBadge({ staffType }: { staffType: string | null }) {
  const label = staffType ? (STAFF_TYPE_LABELS[staffType as ServiceStaffType] ?? staffType) : "Unknown";
  const color = staffType === "therapist" ? "var(--cs-sand)" : "#7c3aed";
  const bg = staffType === "therapist" ? "var(--cs-sand-mist)" : "rgba(124,58,237,0.08)";
  return (
    <span
      style={{
        fontSize: "0.625rem",
        fontWeight: 700,
        padding: "2px 7px",
        borderRadius: 20,
        background: bg,
        color: color,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function CrmStaffCapabilitiesTab({
  services,
  staff,
  assignments,
}: {
  branchId: string;
  services: ActiveBranchService[];
  staff: StaffForServicePanel[];
  assignments: ServiceAssignmentRow[];
}) {
  const eligibleStaff = useMemo(() => staff.filter(isEligibleProvider), [staff]);

  const serviceNamesById = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of services) {
      const id = s.service_id ?? s.services.id;
      const name = s.public_title?.trim() || s.services.name;
      map.set(id, name);
    }
    return map;
  }, [services]);

  const assignmentCountByStaff = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of assignments) {
      map.set(a.staff_id, (map.get(a.staff_id) ?? 0) + 1);
    }
    return map;
  }, [assignments]);

  const assignedServiceIdsByStaff = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const a of assignments) {
      const list = map.get(a.staff_id) ?? [];
      list.push(a.service_id);
      map.set(a.staff_id, list);
    }
    return map;
  }, [assignments]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Intro */}
      <div
        style={{
          padding: "0.875rem 1.125rem",
          borderRadius: 10,
          background: "rgba(41,128,185,0.04)",
          border: "1px solid rgba(41,128,185,0.18)",
          display: "flex",
          alignItems: "center",
          gap: "0.875rem",
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            background: "rgba(41,128,185,0.12)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
            flexShrink: 0,
          }}
        >
          👤
        </div>
        <div>
          <div style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--cs-text)" }}>
            Staff Capabilities
          </div>
          <div style={{ fontSize: "0.8125rem", color: "var(--cs-text-secondary)", lineHeight: 1.5, marginTop: 2 }}>
            View which services each staff member can perform.
            To edit capabilities, open the staff profile workspace.
          </div>
        </div>
      </div>

      {/* Staff cards */}
      {eligibleStaff.length === 0 ? (
        <div
          className="cs-card"
          style={{ padding: "2rem", textAlign: "center", color: "var(--cs-text-muted)", fontSize: "0.875rem" }}
        >
          No eligible provider staff found for this branch.
          <p style={{ fontSize: "0.8125rem", marginTop: 4 }}>
            Add therapists, nail technicians, aestheticians, or salon heads to your branch staff first.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {eligibleStaff.map((member) => {
            const assignedCount = assignmentCountByStaff.get(member.id) ?? 0;
            const assignedServiceIds = assignedServiceIdsByStaff.get(member.id) ?? [];
            const assignedServices = assignedServiceIds
              .map((id) => serviceNamesById.get(id))
              .filter((name): name is string => !!name)
              .sort();

            return (
              <div
                key={member.id}
                className="cs-card"
                style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "0.625rem" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      background: "var(--cs-sand-mist)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "0.8125rem",
                      fontWeight: 700,
                      color: "var(--cs-sand)",
                      flexShrink: 0,
                    }}
                  >
                    {member.full_name.slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--cs-text)" }}>
                      {member.full_name}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                      <StaffTypeBadge staffType={member.staff_type} />
                      <span style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)" }}>
                        {assignedCount} service{assignedCount !== 1 ? "s" : ""} assigned
                      </span>
                    </div>
                  </div>
                  <Link
                    href={`/manager/staff/${member.id}`}
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      color: "var(--cs-sand)",
                      textDecoration: "none",
                      padding: "4px 10px",
                      borderRadius: 6,
                      border: "1px solid var(--cs-border)",
                      background: "var(--cs-surface)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Edit Profile ›
                  </Link>
                </div>

                {assignedServices.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 2 }}>
                    {assignedServices.map((name) => (
                      <span
                        key={name}
                        style={{
                          fontSize: "0.75rem",
                          padding: "2px 8px",
                          borderRadius: 20,
                          background: "var(--cs-surface-warm)",
                          border: "1px solid var(--cs-border-soft)",
                          color: "var(--cs-text-secondary)",
                        }}
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                )}

                {assignedServices.length === 0 && (
                  <div style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)", fontStyle: "italic" }}>
                    No services assigned yet. Use the Services tab to assign this staff member to services.
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
