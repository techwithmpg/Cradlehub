"use client";

/**
 * CrmTherapistAssignmentTab
 *
 * Desktop-first professional SaaS table for the Therapist Assignments tab.
 *
 * Layout:
 *   - Intro card (text)
 *   - 4-column KPI cards: Active Services | Without Therapist | Eligible Providers | Fully Assigned
 *   - Filter/search row
 *   - Two-column grid: [table + pagination] | [right rail]
 *
 * Table columns: SERVICE · CATEGORY · ASSIGNED THERAPISTS · STATUS · ACTIONS
 *
 * Compact rows: max 3 preview chips + "+N more"; full list in Sheet.
 * Pagination: client-side, 10/25/50 rows per page.
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
      duration: svc.custom_duration_minutes ?? svc.services.duration_minutes,
      price: svc.custom_price ?? svc.services.price,
    };
  });
}

// ── Pagination helpers ────────────────────────────────────────────────────────

const SELECT_CHEVRON =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23999' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E\")";

const SELECT_STYLE: React.CSSProperties = {
  height: 34,
  padding: "0 28px 0 10px",
  borderRadius: 6,
  border: "1px solid var(--cs-border)",
  background: "var(--cs-surface)",
  fontSize: "0.8125rem",
  color: "var(--cs-text)",
  cursor: "pointer",
  appearance: "none",
  backgroundImage: SELECT_CHEVRON,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 10px center",
};

function getPageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const show = new Set<number>([1, total]);
  for (let p = current - 1; p <= current + 1; p++) {
    if (p >= 1 && p <= total) show.add(p);
  }
  const sorted = [...show].sort((a, b) => a - b);
  const result: (number | "...")[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    if (prev !== undefined && cur !== undefined && cur - prev > 1) {
      result.push("...");
    }
    if (cur !== undefined) result.push(cur);
  }
  return result;
}

// ── KPI stat card ─────────────────────────────────────────────────────────────

function StatCard({
  count,
  label,
  caption,
  icon,
  accentColor,
  accentBg,
}: {
  count: number;
  label: string;
  caption: string;
  icon: string;
  accentColor?: string;
  accentBg?: string;
}) {
  return (
    <div className="cs-card" style={{ padding: "1rem 1.125rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: accentBg ?? "var(--cs-sand-mist)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
        <div>
          <div
            style={{
              fontSize: "1.375rem",
              fontWeight: 700,
              color: accentColor ?? "var(--cs-text)",
              lineHeight: 1,
            }}
          >
            {count}
          </div>
          <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--cs-text-secondary)", marginTop: 1 }}>
            {label}
          </div>
        </div>
      </div>
      <div style={{ fontSize: "0.6875rem", color: "var(--cs-text-muted)", marginTop: 6 }}>
        {caption}
      </div>
    </div>
  );
}

// ── Right rail ────────────────────────────────────────────────────────────────

function RightRail({
  wellAssigned,
  lowCoverage,
  noTherapist,
}: {
  wellAssigned: number;
  lowCoverage: number;
  noTherapist: number;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>

      {/* Who can be assigned */}
      <div className="cs-card" style={{ padding: "0.875rem" }}>
        <div style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--cs-text)", marginBottom: 8 }}>
          Who can be assigned?
        </div>
        {(["Therapists", "Nail Technicians", "Aestheticians", "Salon Heads", "Other eligible provider staff"] as const).map(
          (label) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.8125rem", marginBottom: 3 }}>
              <span style={{ color: "var(--cs-success,#27ae60)", fontWeight: 700, flexShrink: 0 }}>✓</span>
              <span style={{ color: "var(--cs-text-secondary)" }}>{label}</span>
            </div>
          )
        )}
        <div style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--cs-text)", marginTop: 12, marginBottom: 8 }}>
          Excluded
        </div>
        {(["Drivers", "Utility Staff", "CRM / Front Desk Staff", "Inactive Staff"] as const).map(
          (label) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.8125rem", marginBottom: 3 }}>
              <span style={{ color: "var(--cs-error,#c0392b)", fontWeight: 700, flexShrink: 0 }}>✕</span>
              <span style={{ color: "var(--cs-text-muted)" }}>{label}</span>
            </div>
          )
        )}
      </div>

      {/* Assignment Overview */}
      <div className="cs-card" style={{ padding: "0.875rem" }}>
        <div style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--cs-text)", marginBottom: 10 }}>
          Assignment Overview
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {[
            { count: wellAssigned, label: "Well Assigned",   color: "#065F46", bg: "#ECFDF5", dot: "#059669" },
            { count: lowCoverage,  label: "Low Coverage",    color: "#92400E", bg: "#FFF7ED", dot: "#D97706" },
            { count: noTherapist,  label: "No Therapist",    color: "#991B1B", bg: "#FEF2F2", dot: "#DC2626" },
          ].map(({ count, label, color, bg, dot }) => (
            <div
              key={label}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "5px 8px",
                borderRadius: 6,
                background: bg,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: dot, flexShrink: 0, display: "inline-block" }} />
                <span style={{ fontSize: "0.75rem", color, fontWeight: 500 }}>{label}</span>
              </div>
              <span style={{ fontSize: "0.875rem", fontWeight: 700, color }}>{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tip */}
      <div
        className="cs-card"
        style={{ padding: "0.875rem", background: "rgba(230,126,34,0.04)", borderColor: "rgba(230,126,34,0.2)" }}
      >
        <div style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--cs-text-secondary)", marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}>
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
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // ── Computed data ──────────────────────────────────────────────────────────

  const allRows = useMemo(
    () => buildServiceTableRows(services, staff, assignments),
    [services, staff, assignments]
  );

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

  // KPI counts (from full unfiltered data)
  const eligibleProviderCount = useMemo(() => staff.filter(isValidProvider).length, [staff]);
  const fullyAssignedCount    = useMemo(() => allRows.filter((r) => r.assignedProviders.length > 0).length, [allRows]);
  const missingCount          = allRows.filter((r) => r.assignedProviders.length === 0).length;
  const wellAssignedCount     = useMemo(() => allRows.filter((r) => r.assignedProviders.length >= 2).length, [allRows]);
  const lowCoverageCount      = useMemo(() => allRows.filter((r) => r.assignedProviders.length === 1).length, [allRows]);

  // Pagination — safeCurrentPage auto-clamps when filters change (no useEffect needed)
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / rowsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * rowsPerPage;
  const paginatedRows = filteredRows.slice(startIndex, startIndex + rowsPerPage);
  const pageNumbers = getPageNumbers(safeCurrentPage, totalPages);

  return (
    <div id="therapist-assignments" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

      {/* ── Intro card ── */}
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
          👥
        </div>
        <div>
          <div style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--cs-text)" }}>
            Assign Therapists to Services
          </div>
          <div style={{ fontSize: "0.8125rem", color: "var(--cs-text-secondary)", lineHeight: 1.5, marginTop: 2 }}>
            Each active service should have at least one eligible provider assigned.
            Provider assignments affect who appears in the booking wizard and CRM booking flow.
          </div>
        </div>
      </div>

      {/* ── 4 KPI cards ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: "0.75rem",
        }}
      >
        <StatCard
          count={allRows.length}
          label="Active Services"
          caption="Across all categories"
          icon="✨"
        />
        <StatCard
          count={missingCount}
          label="Without Therapist"
          caption="Need attention"
          icon="⚠️"
          accentColor={missingCount > 0 ? "#92400E" : undefined}
          accentBg={missingCount > 0 ? "#FFF7ED" : undefined}
        />
        <StatCard
          count={eligibleProviderCount}
          label="Eligible Providers"
          caption="In your branch"
          icon="👤"
          accentColor="#1E40AF"
          accentBg="#EFF6FF"
        />
        <StatCard
          count={fullyAssignedCount}
          label="Fully Assigned"
          caption="Services with therapists"
          icon="✅"
          accentColor="#065F46"
          accentBg="#ECFDF5"
        />
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
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
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
          onChange={(e) => { setSelectedCategory(e.target.value); setCurrentPage(1); }}
          style={SELECT_STYLE}
        >
          <option value="all">All Categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>

        {/* Service type */}
        <select
          value={selectedServiceType}
          onChange={(e) => { setSelectedServiceType(e.target.value as "all" | "in_spa" | "home"); setCurrentPage(1); }}
          style={SELECT_STYLE}
        >
          <option value="all">All Service Types</option>
          <option value="in_spa">In-spa</option>
          <option value="home">Home Service</option>
        </select>

        {/* Missing-only toggle */}
        <button
          type="button"
          onClick={() => { setMissingOnly((v) => !v); setCurrentPage(1); }}
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

      {/* ── Table + right rail (2-column grid) ── */}
      <div className="grid grid-cols-[minmax(0,1fr)_280px] gap-6 items-start">

        {/* ── Main table column ── */}
        <div style={{ minWidth: 0, overflow: "hidden", borderRadius: 10, border: "1px solid var(--cs-border-soft)" }}>
          {filteredRows.length === 0 ? (
            <div
              style={{
                padding: "3rem 2rem",
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
                  <tr style={{ background: "var(--cs-surface-warm)", borderBottom: "1px solid var(--cs-border)" }}>
                    {["Service", "Category", "Assigned Therapists", "Status", "Actions"].map((col) => (
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
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginatedRows.map((row) => (
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

          {/* ── Pagination ── */}
          {filteredRows.length > 0 && (
            <div
              style={{
                padding: "0.625rem 1rem",
                borderTop: "1px solid var(--cs-border-soft)",
                background: "var(--cs-surface-warm)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              {/* Count + rows per page */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)" }}>
                  Showing{" "}
                  <strong style={{ color: "var(--cs-text-secondary)" }}>
                    {startIndex + 1}–{Math.min(startIndex + rowsPerPage, filteredRows.length)}
                  </strong>{" "}
                  of{" "}
                  <strong style={{ color: "var(--cs-text-secondary)" }}>{filteredRows.length}</strong>{" "}
                  services
                </span>
                <select
                  value={rowsPerPage}
                  onChange={(e) => {
                    setRowsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  aria-label="Rows per page"
                  style={{
                    height: 28,
                    padding: "0 22px 0 8px",
                    borderRadius: 5,
                    border: "1px solid var(--cs-border)",
                    background: "var(--cs-surface)",
                    fontSize: "0.75rem",
                    color: "var(--cs-text)",
                    cursor: "pointer",
                    appearance: "none",
                    backgroundImage: SELECT_CHEVRON,
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "right 7px center",
                  }}
                >
                  {[10, 25, 50].map((n) => (
                    <option key={n} value={n}>{n} per page</option>
                  ))}
                </select>
              </div>

              {/* Page buttons */}
              {totalPages > 1 && (
                <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                  {/* Prev */}
                  <button
                    type="button"
                    disabled={safeCurrentPage === 1}
                    onClick={() => setCurrentPage(safeCurrentPage - 1)}
                    style={{
                      width: 28,
                      height: 28,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: 5,
                      border: "1px solid var(--cs-border)",
                      background: "transparent",
                      color: safeCurrentPage === 1 ? "var(--cs-text-muted)" : "var(--cs-text-secondary)",
                      fontSize: "0.8125rem",
                      cursor: safeCurrentPage === 1 ? "not-allowed" : "pointer",
                      opacity: safeCurrentPage === 1 ? 0.4 : 1,
                    }}
                    aria-label="Previous page"
                  >
                    ‹
                  </button>

                  {/* Page numbers */}
                  {pageNumbers.map((p, idx) =>
                    p === "..." ? (
                      <span
                        key={`ellipsis-${idx}`}
                        style={{ width: 28, textAlign: "center", fontSize: "0.8125rem", color: "var(--cs-text-muted)" }}
                      >
                        …
                      </span>
                    ) : (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setCurrentPage(p)}
                        style={{
                          width: 28,
                          height: 28,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          borderRadius: 5,
                          border: p === safeCurrentPage ? "1px solid var(--cs-sand)" : "1px solid var(--cs-border)",
                          background: p === safeCurrentPage ? "var(--cs-sand-mist)" : "transparent",
                          color: p === safeCurrentPage ? "var(--cs-sand)" : "var(--cs-text-secondary)",
                          fontSize: "0.75rem",
                          fontWeight: p === safeCurrentPage ? 700 : 400,
                          cursor: "pointer",
                        }}
                      >
                        {p}
                      </button>
                    )
                  )}

                  {/* Next */}
                  <button
                    type="button"
                    disabled={safeCurrentPage === totalPages}
                    onClick={() => setCurrentPage(safeCurrentPage + 1)}
                    style={{
                      width: 28,
                      height: 28,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: 5,
                      border: "1px solid var(--cs-border)",
                      background: "transparent",
                      color: safeCurrentPage === totalPages ? "var(--cs-text-muted)" : "var(--cs-text-secondary)",
                      fontSize: "0.8125rem",
                      cursor: safeCurrentPage === totalPages ? "not-allowed" : "pointer",
                      opacity: safeCurrentPage === totalPages ? 0.4 : 1,
                    }}
                    aria-label="Next page"
                  >
                    ›
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Right rail ── */}
        <RightRail
          wellAssigned={wellAssignedCount}
          lowCoverage={lowCoverageCount}
          noTherapist={missingCount}
        />
      </div>
    </div>
  );
}
