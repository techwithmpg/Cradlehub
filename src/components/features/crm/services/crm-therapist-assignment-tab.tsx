"use client";

/**
 * CrmTherapistAssignmentTab
 *
 * The "Therapist Assignments" tab of the CRM Services page.
 *
 * Receives all data (services, staff, assignments) as plain props from the
 * server-side page component and handles all filter/search state client-side.
 *
 * Layout (desktop-first):
 *   - Intro card + stat cards
 *   - Filter row (search, category, service type, missing-only toggle)
 *   - Two-column: assignment table (flex:1) + right help panel (fixed width)
 *
 * Eligibility rules:
 *   - SERVICE_STAFF_TYPES can be providers (therapist, nail_tech, aesthetician, salon_head)
 *   - driver / utility are hard-excluded via system_role check
 *   - Inactive staff are excluded by the query
 */

import { useState, useMemo } from "react";
import type { ActiveBranchService } from "@/components/features/manager-settings/types";
import type { StaffForServicePanel, ServiceAssignmentRow } from "@/lib/queries/crm-services";
import { SERVICE_STAFF_TYPES } from "@/constants/staff-roles";
import type { ServiceTableRow } from "./types";
import { ServiceAssignmentTableRow } from "./service-assignment-table-row";

// ── Eligibility constants ─────────────────────────────────────────────────────

const HARD_EXCLUDED_SYSTEM_ROLES = new Set(["driver", "utility"]);
const SERVICE_STAFF_TYPE_SET = new Set<string>(SERVICE_STAFF_TYPES);

function isValidProvider(s: StaffForServicePanel): boolean {
  if (HARD_EXCLUDED_SYSTEM_ROLES.has(s.system_role)) return false;
  return s.staff_type !== null && SERVICE_STAFF_TYPE_SET.has(s.staff_type);
}

// ── Build service table rows ──────────────────────────────────────────────────

function buildServiceTableRows(
  services: ActiveBranchService[],
  staff: StaffForServicePanel[],
  assignments: ServiceAssignmentRow[]
): ServiceTableRow[] {
  // Build: serviceId → Set<staffId>
  const assignMap = new Map<string, Set<string>>();
  for (const a of assignments) {
    const set = assignMap.get(a.service_id) ?? new Set<string>();
    set.add(a.staff_id);
    assignMap.set(a.service_id, set);
  }

  const validBranchProviders = staff.filter(isValidProvider);
  const staffById = new Map(staff.map((s) => [s.id, s]));

  return services.map((svc) => {
    const serviceId = svc.service_id ?? svc.services.id;
    const assignedIds = assignMap.get(serviceId) ?? new Set<string>();

    const assignedProviders = Array.from(assignedIds)
      .map((id) => staffById.get(id))
      .filter((s): s is StaffForServicePanel => s !== undefined && isValidProvider(s));

    const assignableProviders = validBranchProviders.filter((s) => !assignedIds.has(s.id));

    const visibility = svc.visibility ?? svc.booking_visibility ?? "public";
    const hasProviders = assignedProviders.length > 0;

    const catRel = svc.services.service_categories;
    const category =
      catRel === null || catRel === undefined
        ? null
        : Array.isArray(catRel)
        ? (catRel[0]?.name ?? null)
        : catRel.name ?? null;

    const duration = svc.custom_duration_minutes ?? svc.services.duration_minutes;
    const price = svc.custom_price ?? svc.services.price;

    return {
      branchServiceId: svc.id,
      serviceId,
      name: svc.public_title?.trim() || svc.services.name,
      category,
      isInSpa: svc.available_in_spa ?? true,
      isHomeService: svc.available_home_service ?? false,
      visibility,
      assignedProviders,
      assignableProviders,
      isCritical: visibility === "public" && !hasProviders,
      isWarning: !hasProviders,
      duration,
      price,
    };
  });
}

// ── Right help panel ─────────────────────────────────────────────────────────

function HelpPanel() {
  return (
    <div
      style={{
        width: 220,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
      }}
    >
      {/* Who can be assigned */}
      <div className="cs-card" style={{ padding: "0.875rem" }}>
        <div
          style={{
            fontSize: "0.8125rem",
            fontWeight: 700,
            color: "var(--cs-text)",
            marginBottom: 8,
          }}
        >
          Who can be assigned?
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {["Therapists", "Nail Technicians", "Aestheticians", "Salon Heads", "Other eligible provider staff"].map(
            (label) => (
              <div
                key={label}
                style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.8125rem" }}
              >
                <span style={{ color: "var(--cs-success,#27ae60)", fontWeight: 700 }}>✓</span>
                <span style={{ color: "var(--cs-text-secondary)" }}>{label}</span>
              </div>
            )
          )}
        </div>

        <div
          style={{
            fontSize: "0.8125rem",
            fontWeight: 700,
            color: "var(--cs-text)",
            marginTop: 12,
            marginBottom: 8,
          }}
        >
          Excluded
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {["Drivers", "Utility Staff", "CRM / Front Desk Staff", "Inactive Staff"].map(
            (label) => (
              <div
                key={label}
                style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.8125rem" }}
              >
                <span style={{ color: "var(--cs-error,#c0392b)", fontWeight: 700 }}>✕</span>
                <span style={{ color: "var(--cs-text-muted)" }}>{label}</span>
              </div>
            )
          )}
        </div>
      </div>

      {/* Tip */}
      <div
        className="cs-card"
        style={{
          padding: "0.875rem",
          background: "rgba(230,126,34,0.04)",
          borderColor: "rgba(230,126,34,0.2)",
        }}
      >
        <div
          style={{
            fontSize: "0.8125rem",
            fontWeight: 700,
            color: "var(--cs-text-secondary)",
            marginBottom: 6,
            display: "flex",
            alignItems: "center",
            gap: 5,
          }}
        >
          <span>💡</span> Tip
        </div>
        <div style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)", lineHeight: 1.6 }}>
          Assign at least one therapist or eligible provider to each active service so customers
          can book online and CRM can assign staff confidently.
        </div>
      </div>
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  count,
  label,
  icon,
  accent,
}: {
  count: number;
  label: string;
  icon: string;
  accent?: string;
}) {
  return (
    <div
      className="cs-card"
      style={{
        padding: "1rem 1.25rem",
        display: "flex",
        alignItems: "center",
        gap: "0.875rem",
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: accent
            ? `${accent}18`
            : "var(--cs-sand-mist)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 20,
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div>
        <div
          style={{
            fontSize: "1.25rem",
            fontWeight: 700,
            color: accent ?? "var(--cs-text)",
            lineHeight: 1.1,
          }}
        >
          {count}
        </div>
        <div style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)", marginTop: 2 }}>
          {label}
        </div>
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function CrmTherapistAssignmentTab({
  branchId,
  services,
  staff,
  assignments,
}: {
  branchId: string;
  services: ActiveBranchService[];
  staff: StaffForServicePanel[];
  assignments: ServiceAssignmentRow[];
}) {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedServiceType, setSelectedServiceType] = useState<"all" | "in_spa" | "home">("all");
  const [missingOnly, setMissingOnly] = useState(false);

  // Build rows once from props (pure computation)
  const allRows = useMemo(
    () => buildServiceTableRows(services, staff, assignments),
    [services, staff, assignments]
  );

  // Derive unique categories for the dropdown
  const categories = useMemo(() => {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const row of allRows) {
      if (row.category && !seen.has(row.category)) {
        seen.add(row.category);
        result.push(row.category);
      }
    }
    return result.sort();
  }, [allRows]);

  // Apply filters
  const filteredRows = useMemo(() => {
    const q = search.toLowerCase().trim();
    return allRows.filter((row) => {
      if (q && !row.name.toLowerCase().includes(q) && !(row.category ?? "").toLowerCase().includes(q))
        return false;
      if (selectedCategory !== "all" && row.category !== selectedCategory) return false;
      if (selectedServiceType === "in_spa" && !row.isInSpa) return false;
      if (selectedServiceType === "home" && !row.isHomeService) return false;
      if (missingOnly && row.assignedProviders.length > 0) return false;
      return true;
    });
  }, [allRows, search, selectedCategory, selectedServiceType, missingOnly]);

  // Counts
  const totalCount = allRows.length;
  const missingCount = allRows.filter((r) => r.assignedProviders.length === 0).length;

  return (
    <div id="therapist-assignments" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

      {/* ── Intro card ── */}
      <div
        style={{
          padding: "1rem 1.25rem",
          borderRadius: 10,
          background: "rgba(41,128,185,0.04)",
          border: "1px solid rgba(41,128,185,0.18)",
          display: "flex",
          gap: "1.25rem",
          alignItems: "flex-start",
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: "rgba(41,128,185,0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 20,
            flexShrink: 0,
          }}
        >
          👥
        </div>
        <div>
          <div
            style={{
              fontSize: "0.9375rem",
              fontWeight: 700,
              color: "var(--cs-text)",
              marginBottom: 4,
            }}
          >
            Assign Therapists to Services
          </div>
          <div style={{ fontSize: "0.8125rem", color: "var(--cs-text-secondary)", lineHeight: 1.6 }}>
            Each active service should have at least one eligible provider assigned.
            Only eligible provider staff are shown below.
            Provider assignments affect who appears in the booking wizard and CRM booking flow.
          </div>
        </div>

        {/* Stat cards inline-right */}
        <div
          style={{
            display: "flex",
            gap: "0.75rem",
            marginLeft: "auto",
            flexShrink: 0,
          }}
        >
          <StatCard count={totalCount} label="Active Services" icon="✨" />
          <StatCard
            count={missingCount}
            label="Services without therapist"
            icon="⚠️"
            accent={missingCount > 0 ? "#92400E" : undefined}
          />
        </div>
      </div>

      {/* ── Filter row ── */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {/* Search */}
        <div style={{ position: "relative", flex: "1 1 200px", minWidth: 160, maxWidth: 280 }}>
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
            placeholder="Search service..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%",
              height: 34,
              paddingLeft: 30,
              paddingRight: 10,
              borderRadius: 6,
              border: "1px solid var(--cs-border)",
              background: "var(--cs-surface)",
              fontSize: "0.8125rem",
              color: "var(--cs-text)",
              outline: "none",
            }}
          />
        </div>

        {/* Category */}
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          style={{
            height: 34,
            padding: "0 28px 0 10px",
            borderRadius: 6,
            border: "1px solid var(--cs-border)",
            background: "var(--cs-surface)",
            fontSize: "0.8125rem",
            color: "var(--cs-text)",
            cursor: "pointer",
            appearance: "none",
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23999' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E\")",
            backgroundRepeat: "no-repeat",
            backgroundPosition: "right 10px center",
          }}
        >
          <option value="all">All Categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>

        {/* Service type */}
        <select
          value={selectedServiceType}
          onChange={(e) => setSelectedServiceType(e.target.value as "all" | "in_spa" | "home")}
          style={{
            height: 34,
            padding: "0 28px 0 10px",
            borderRadius: 6,
            border: "1px solid var(--cs-border)",
            background: "var(--cs-surface)",
            fontSize: "0.8125rem",
            color: "var(--cs-text)",
            cursor: "pointer",
            appearance: "none",
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23999' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E\")",
            backgroundRepeat: "no-repeat",
            backgroundPosition: "right 10px center",
          }}
        >
          <option value="all">All Service Types</option>
          <option value="in_spa">In-spa</option>
          <option value="home">Home Service</option>
        </select>

        {/* Missing-only toggle */}
        <button
          type="button"
          onClick={() => setMissingOnly((v) => !v)}
          style={{
            height: 34,
            padding: "0 12px",
            borderRadius: 6,
            border: `1px solid ${missingOnly ? "var(--cs-sand)" : "var(--cs-border)"}`,
            background: missingOnly ? "var(--cs-sand-mist)" : "transparent",
            color: missingOnly ? "var(--cs-sand)" : "var(--cs-text-muted)",
            fontSize: "0.8125rem",
            fontWeight: missingOnly ? 600 : 400,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            whiteSpace: "nowrap",
            transition: "all 0.15s",
          }}
        >
          <span
            style={{
              width: 14,
              height: 14,
              borderRadius: 3,
              border: `1.5px solid ${missingOnly ? "var(--cs-sand)" : "var(--cs-border)"}`,
              background: missingOnly ? "var(--cs-sand)" : "transparent",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 9,
              color: "#fff",
              flexShrink: 0,
              transition: "all 0.15s",
            }}
          >
            {missingOnly ? "✓" : ""}
          </span>
          Show only services without therapist
        </button>
      </div>

      {/* ── Table + right panel ── */}
      <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>

        {/* Table area */}
        <div style={{ flex: 1, minWidth: 0, overflow: "hidden", borderRadius: 10, border: "1px solid var(--cs-border-soft)" }}>
          {filteredRows.length === 0 ? (
            <div
              style={{
                padding: "2.5rem",
                textAlign: "center",
                color: "var(--cs-text-muted)",
                fontSize: "0.875rem",
                background: "var(--cs-surface)",
              }}
            >
              {allRows.length === 0
                ? "No active services found for this branch."
                : "No services match the current filters."}
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "0.875rem",
                  tableLayout: "auto",
                }}
              >
                <thead>
                  <tr
                    style={{
                      background: "var(--cs-surface-warm)",
                      borderBottom: "1px solid var(--cs-border)",
                    }}
                  >
                    {["Service", "Category", "Assigned Therapists", "Actions"].map((col) => (
                      <th
                        key={col}
                        style={{
                          padding: "0.625rem 1rem",
                          textAlign: "left",
                          fontSize: "0.6875rem",
                          fontWeight: 700,
                          color: "var(--cs-text-muted)",
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {col}
                        {col === "Assigned Therapists" && (
                          <span
                            style={{
                              marginLeft: 5,
                              fontSize: "0.5625rem",
                              fontWeight: 500,
                              color: "var(--cs-text-muted)",
                            }}
                          >
                            ⓘ
                          </span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <ServiceAssignmentTableRow
                      key={row.branchServiceId}
                      row={row}
                      branchId={branchId}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer note */}
          <div
            style={{
              padding: "0.625rem 1rem",
              borderTop: "1px solid var(--cs-border-soft)",
              background: "var(--cs-surface-warm)",
              fontSize: "0.75rem",
              color: "var(--cs-text-muted)",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <span>ⓘ</span>
            <span>
              Changes are saved automatically.
              Provider assignments affect who appears in the booking calendar and online booking
              selection.
            </span>
          </div>
        </div>

        {/* Right help panel (desktop) */}
        <HelpPanel />
      </div>
    </div>
  );
}
