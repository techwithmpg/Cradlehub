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

const HARD_EXCLUDED_SYSTEM_ROLES = new Set(["digital_marketer", "driver", "utility"]);
const SERVICE_STAFF_TYPE_SET = new Set<string>(SERVICE_STAFF_TYPES);

export function isValidProvider(s: StaffForServicePanel): boolean {
  if (HARD_EXCLUDED_SYSTEM_ROLES.has(s.system_role)) return false;
  return s.staff_type !== null && SERVICE_STAFF_TYPE_SET.has(s.staff_type);
}

// ── Build service table rows ──────────────────────────────────────────────────

export function buildServiceTableRows(
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
          : (catRel.name ?? null);

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

// ── Main export ───────────────────────────────────────────────────────────────

export function CrmTherapistAssignmentTab({
  branchId,
  services,
  staff,
  assignments,
  onServicePatch,
  onAssignmentChange,
}: {
  branchId: string;
  services: ActiveBranchService[];
  staff: StaffForServicePanel[];
  assignments: ServiceAssignmentRow[];
  onServicePatch: (serviceId: string, patch: Partial<ActiveBranchService>) => void;
  onAssignmentChange: (assignment: ServiceAssignmentRow, assigned: boolean) => void;
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
      if (
        q &&
        !row.name.toLowerCase().includes(q) &&
        !(row.category ?? "").toLowerCase().includes(q)
      )
        return false;
      if (selectedCategory !== "all" && row.category !== selectedCategory) return false;
      if (selectedServiceType === "in_spa" && !row.isInSpa) return false;
      if (selectedServiceType === "home" && !row.isHomeService) return false;
      if (missingOnly && row.assignedProviders.length > 0) return false;
      return true;
    }).sort((a, b) => a.assignedProviders.length - b.assignedProviders.length || a.name.localeCompare(b.name));
  }, [allRows, search, selectedCategory, selectedServiceType, missingOnly]);

  // KPI counts (from full unfiltered data)
  const eligibleProviderCount = useMemo(() => staff.filter(isValidProvider).length, [staff]);
  const missingCount = allRows.filter((r) => r.assignedProviders.length === 0).length;
  const wellAssignedCount = useMemo(
    () => allRows.filter((r) => r.assignedProviders.length >= 2).length,
    [allRows]
  );
  const lowCoverageCount = useMemo(
    () => allRows.filter((r) => r.assignedProviders.length === 1).length,
    [allRows]
  );

  // Pagination — safeCurrentPage auto-clamps when filters change (no useEffect needed)
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / rowsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * rowsPerPage;
  const paginatedRows = filteredRows.slice(startIndex, startIndex + rowsPerPage);
  const pageNumbers = getPageNumbers(safeCurrentPage, totalPages);

  return (
    <div
      id="therapist-assignments"
      style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}
    >
      <div className="rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface)] px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="m-0 text-base font-semibold text-[var(--cs-text)]">Provider coverage</h2>
            <p className="mt-1 mb-0 text-sm text-[var(--cs-text-secondary)]">
              {missingCount ? missingCount + " services need a provider. Unassigned services appear first." : "Every service has an eligible provider."}
            </p>
          </div>
          <span className="rounded-lg bg-[var(--cs-surface-warm)] px-3 py-2 text-xs text-[var(--cs-text-muted)]">{eligibleProviderCount} eligible staff</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Filter by provider coverage">
          <button type="button" aria-pressed={!missingOnly} onClick={() => { setMissingOnly(false); setCurrentPage(1); }}
            className={missingOnly ? "rounded-lg border border-[var(--cs-border)] px-3 py-2 text-xs text-[var(--cs-text-secondary)]" : "rounded-lg border border-[var(--cs-sand)] bg-[var(--cs-sand-mist)] px-3 py-2 text-xs font-semibold text-[var(--cs-sand-dark)]"}
          >All services · {allRows.length}</button>
          <button type="button" aria-pressed={missingOnly} onClick={() => { setMissingOnly(true); setCurrentPage(1); }}
            className={missingOnly ? "rounded-lg border border-[var(--cs-sand)] bg-[var(--cs-sand-mist)] px-3 py-2 text-xs font-semibold text-[var(--cs-sand-dark)]" : "rounded-lg border border-[var(--cs-border)] px-3 py-2 text-xs text-[var(--cs-text-secondary)]"}
          >Needs provider · {missingCount}</button>
          <span className="rounded-lg border border-[var(--cs-border-soft)] px-3 py-2 text-xs text-[var(--cs-text-muted)]">
            {lowCoverageCount} have one · {wellAssignedCount} have two or more
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="min-w-[210px] flex-[1_1_240px]">
          <span className="sr-only">Search services</span>
          <input type="search" aria-label="Search services" placeholder="Find a service..." value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            className="h-9 w-full rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 text-sm" />
        </label>
        <details className="relative">
          <summary className="flex h-9 cursor-pointer list-none items-center rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 text-xs text-[var(--cs-text-secondary)]">
            Category &amp; delivery {(selectedCategory !== "all" || selectedServiceType !== "all") && " •"}
          </summary>
          <div className="absolute right-0 z-20 mt-1 flex w-[min(320px,85vw)] flex-col gap-3 rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-3 shadow-lg">
            <label className="block text-xs font-medium">Category
              <select aria-label="Filter category" value={selectedCategory} onChange={(e) => { setSelectedCategory(e.target.value); setCurrentPage(1); }}
                className="mt-1 h-9 w-full rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-2">
                <option value="all">All categories</option>
                {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </label>
            <label className="block text-xs font-medium">Delivery
              <select aria-label="Filter delivery" value={selectedServiceType} onChange={(e) => { setSelectedServiceType(e.target.value as "all" | "in_spa" | "home"); setCurrentPage(1); }}
                className="mt-1 h-9 w-full rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-2">
                <option value="all">All service types</option>
                <option value="in_spa">In-spa</option>
                <option value="home">Home service</option>
              </select>
            </label>
          </div>
        </details>
        {(search || selectedCategory !== "all" || selectedServiceType !== "all" || missingOnly) && (
          <button type="button" className="h-9 rounded-lg px-2 text-xs text-[var(--cs-text-secondary)]"
            onClick={() => { setSearch(""); setSelectedCategory("all"); setSelectedServiceType("all"); setMissingOnly(false); setCurrentPage(1); }}>Clear filters</button>
        )}
      </div>

      {/* ── Table + right rail (2-column grid) ── */}
      <div className="min-w-0">
        {/* ── Main table column ── */}
        <div
          style={{
            minWidth: 0,
            overflow: "hidden",
            borderRadius: 10,
            border: "1px solid var(--cs-border-soft)",
          }}
        >
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
                  minWidth: 760,
                }}
              >
                <thead>
                  <tr
                    style={{
                      background: "var(--cs-surface-warm)",
                      borderBottom: "1px solid var(--cs-border)",
                    }}
                  >
                    {[
                      "Service",
                      "Assigned Providers",
                      "Booking Readiness",
                      "Actions",
                    ].map((col) => (
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
                      onServicePatch={onServicePatch}
                      onAssignmentChange={onAssignmentChange}
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
                  <strong style={{ color: "var(--cs-text-secondary)" }}>
                    {filteredRows.length}
                  </strong>{" "}
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
                    <option key={n} value={n}>
                      {n} per page
                    </option>
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
                      color:
                        safeCurrentPage === 1 ? "var(--cs-text-muted)" : "var(--cs-text-secondary)",
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
                        style={{
                          width: 28,
                          textAlign: "center",
                          fontSize: "0.8125rem",
                          color: "var(--cs-text-muted)",
                        }}
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
                          border:
                            p === safeCurrentPage
                              ? "1px solid var(--cs-sand)"
                              : "1px solid var(--cs-border)",
                          background: p === safeCurrentPage ? "var(--cs-sand-mist)" : "transparent",
                          color:
                            p === safeCurrentPage ? "var(--cs-sand)" : "var(--cs-text-secondary)",
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
                      color:
                        safeCurrentPage === totalPages
                          ? "var(--cs-text-muted)"
                          : "var(--cs-text-secondary)",
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

      </div>
    </div>
  );
}
