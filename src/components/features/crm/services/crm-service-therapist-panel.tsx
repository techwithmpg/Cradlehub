/**
 * CrmServiceTherapistPanel
 *
 * Server component — receives branch service data, staff, and assignment rows
 * from the page, computes the per-service view model, and renders:
 *   1. MVP access notice
 *   2. Issue summary banner
 *   3. Per-service ProviderAssignmentCard (interactive client component)
 *   4. "How provider matching works" footnote
 *
 * No mutations here. All assignment mutations are handled by
 * ProviderAssignmentCard → src/app/(dashboard)/crm/services/actions.ts.
 *
 * Architecture rules enforced (display + validation):
 *   - Only SERVICE_STAFF_TYPES can be valid providers.
 *   - driver + utility are hard-excluded (HARD_EXCLUDED_SYSTEM_ROLES).
 *   - Public services with 0 valid providers show ⛔ critical state.
 *   - Assignments use the existing staff_services junction table.
 */

import Link from "next/link";
import type { ActiveBranchService } from "@/components/features/manager-settings/types";
import type { StaffForServicePanel, ServiceAssignmentRow } from "@/lib/queries/crm-services";
import { SERVICE_STAFF_TYPES } from "@/constants/staff-roles";
import type { ServiceRow } from "./types";
import { ProviderAssignmentCard } from "./provider-assignment-card";
import { ReadinessIssueList } from "@/components/shared/readiness-issue-list";
import type { ReadinessIssue } from "@/types/readiness";

// ── Constants ─────────────────────────────────────────────────────────────────

const HARD_EXCLUDED_SYSTEM_ROLES = new Set(["driver", "utility"]);
const SERVICE_STAFF_TYPE_SET = new Set<string>(SERVICE_STAFF_TYPES);

// ── Readiness issue factory ───────────────────────────────────────────────────

/**
 * Maps a ServiceRow with no assigned providers to a ReadinessIssue.
 * Returns null when the service already has at least one valid provider.
 * Exported so ProviderAssignmentCard can reuse the same definition.
 */
export function createNoProviderReadinessIssue(row: ServiceRow): ReadinessIssue | null {
  if (row.assignedProviders.length > 0) return null;

  if (row.isCritical) {
    // Public active service with no valid providers — affects online booking.
    return {
      id: `service:${row.serviceId}:no-public-provider`,
      scope: "service",
      severity: "critical",
      title: "Public service has no valid provider",
      problem: `"${row.name}" is visible to customers but has no eligible provider assigned.`,
      impact: "Customers may not be able to choose a therapist or complete a booking for this service online.",
      fix: "Assign at least one eligible service provider (therapist, nail tech, aesthetician, or salon head) before relying on this service in online booking.",
      actionLabel: "Assign provider",
      actionHref: "/crm/services?tab=services",
      source: "CrmServiceTherapistPanel",
      entityType: "service",
      entityIds: [row.serviceId],
      count: 1,
    };
  }

  // Non-public / internal service with no valid providers.
  return {
    id: `service:${row.serviceId}:no-internal-provider`,
    scope: "service",
    severity: "warning",
    title: "Service has no valid provider",
    problem: `"${row.name}" has no eligible provider assigned yet.`,
    impact: "CRM may not be able to assign this service during in-house or internal booking.",
    fix: "Assign an eligible provider using the dropdown, or disable the service until it is ready.",
    actionLabel: "Assign provider",
    actionHref: "/crm/services?tab=services",
    source: "CrmServiceTherapistPanel",
    entityType: "service",
    entityIds: [row.serviceId],
    count: 1,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isValidProvider(s: StaffForServicePanel): boolean {
  if (HARD_EXCLUDED_SYSTEM_ROLES.has(s.system_role)) return false;
  return s.staff_type !== null && SERVICE_STAFF_TYPE_SET.has(s.staff_type);
}

/** All valid service-provider staff at the branch — the universe for assignments. */
function getValidBranchProviders(staff: StaffForServicePanel[]): StaffForServicePanel[] {
  return staff.filter(isValidProvider);
}

function buildServiceRows(
  services: ActiveBranchService[],
  staff: StaffForServicePanel[],
  assignments: ServiceAssignmentRow[]
): ServiceRow[] {
  // Build: serviceId → Set<staffId>
  const assignMap = new Map<string, Set<string>>();
  for (const a of assignments) {
    const set = assignMap.get(a.service_id) ?? new Set<string>();
    set.add(a.staff_id);
    assignMap.set(a.service_id, set);
  }

  // All valid providers at the branch (eligible to be assigned to any service)
  const validBranchProviders = getValidBranchProviders(staff);
  const staffById = new Map(staff.map((s) => [s.id, s]));

  return services.map((svc) => {
    const serviceId = svc.service_id ?? svc.services.id;
    const assignedIds = assignMap.get(serviceId) ?? new Set<string>();

    // Assigned providers that are valid (correct staff_type, not hard-excluded)
    const assignedProviders = Array.from(assignedIds)
      .map((id) => staffById.get(id))
      .filter((s): s is StaffForServicePanel => s !== undefined && isValidProvider(s));

    // Assignable = valid branch providers not yet assigned to this service
    const assignableProviders = validBranchProviders.filter((s) => !assignedIds.has(s.id));

    const visibility = svc.visibility ?? svc.booking_visibility ?? "public";
    const hasProviders = assignedProviders.length > 0;

    // Get category
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
    };
  });
}

// ── Main export ───────────────────────────────────────────────────────────────

export function CrmServiceTherapistPanel({
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
  if (services.length === 0) {
    return (
      <div className="cs-card" style={{ padding: "2rem", textAlign: "center" }}>
        <p style={{ fontSize: "0.875rem", color: "var(--cs-text-muted)" }}>
          No active services to manage provider assignments for.
        </p>
      </div>
    );
  }

  const rows = buildServiceRows(services, staff, assignments);

  // Build per-service readiness issues for all rows missing valid providers.
  const providerIssues = rows
    .map(createNoProviderReadinessIssue)
    .filter((i): i is ReadinessIssue => i !== null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>

      {/* ── MVP access notice ── */}
      <div
        style={{
          padding: "10px 14px",
          borderRadius: "var(--cs-r-sm,8px)",
          background: "rgba(41,128,185,0.05)",
          border: "1px solid rgba(41,128,185,0.2)",
          fontSize: "0.8125rem",
          color: "var(--cs-text-secondary)",
          lineHeight: 1.5,
        }}
      >
        <strong style={{ color: "var(--cs-info,#2980b9)" }}>MVP Setup Access</strong>
        {" — CRM can manage service-provider assignments so daily operations can start immediately. "}
        Only valid service providers (therapists, nail techs, aestheticians, salon heads) can be assigned.
        Drivers, utility staff, and front-desk-only accounts are excluded automatically.
        {" "}
        <span style={{ color: "var(--cs-text-muted)" }}>
          (This permission can be restricted to managers or owners later once the system is stable.)
        </span>
      </div>

      {/* ── Provider issue list (replaces hand-rolled aggregate banner) ── */}
      {providerIssues.length > 0 && (
        <ReadinessIssueList
          issues={providerIssues}
          compact
          emptyTitle="All services have providers assigned"
          emptyDescription="Every active service has at least one eligible provider."
        />
      )}

      {/* ── Per-service assignment cards ── */}
      <div className="cs-card" style={{ overflow: "hidden", padding: 0 }}>
        {/* Column header */}
        <div
          style={{
            padding: "0.625rem 1rem",
            background: "var(--cs-surface-warm)",
            borderBottom: "1px solid var(--cs-border)",
            fontSize: "0.6875rem",
            fontWeight: 700,
            color: "var(--cs-text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          Service · Assigned Providers · Add Provider
        </div>

        {rows.map((row) => (
          <ProviderAssignmentCard key={row.branchServiceId} row={row} branchId={branchId} />
        ))}
      </div>

      {/* ── Rules footnote ── */}
      <div className="cs-card" style={{ padding: "0.875rem 1rem" }}>
        <div
          style={{
            fontSize: "0.75rem",
            fontWeight: 700,
            color: "var(--cs-text-secondary)",
            marginBottom: "0.5rem",
          }}
        >
          How provider matching works
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.375rem",
            fontSize: "0.75rem",
            color: "var(--cs-text-muted)",
            lineHeight: 1.6,
          }}
        >
          <div>
            <strong style={{ color: "var(--cs-text-secondary)" }}>Who can be assigned?</strong>{" "}
            Only staff with a service staff type — Therapist, Nail Tech, Aesthetician / Facialist, or Salon Head — appear in the assign dropdown. Drivers, utility staff, CRM staff, CSR staff, and managerial roles are excluded automatically and are never shown to customers as service providers.
          </div>
          <div>
            <strong style={{ color: "var(--cs-text-secondary)" }}>Assignment is required.</strong>{" "}
            Even with the correct staff type, a provider only appears for a service when explicitly assigned. Without any assigned providers, the booking wizard cannot offer a therapist selection for that service.
          </div>
          <div>
            <strong style={{ color: "var(--cs-text-secondary)" }}>Applies to all booking flows.</strong>{" "}
            Provider assignments affect online booking and CRM in-house bookings equally. Changes take effect immediately — no page reload needed on the booking side.{" "}
            To view comprehensive staff profiles and service histories, use the{" "}
            <Link
              href="/owner/staff"
              style={{ color: "var(--cs-brand)", textDecoration: "underline" }}
            >
              Staff Management workspace →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
