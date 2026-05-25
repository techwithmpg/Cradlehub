/**
 * CrmServiceTherapistPanel
 *
 * Read-only panel for the CRM "Services & Therapist Setup" page.
 * Shows which staff members are assigned as service providers for each active
 * branch service, and highlights services that have no eligible providers.
 *
 * Architecture rules enforced here (display-only):
 *   - Only SERVICE_STAFF_TYPES (therapist, nail_tech, aesthetician, salon_head)
 *     can act as booking service providers.
 *   - driver and utility are hard-excluded regardless of staff_services entries.
 *   - A public service with zero valid providers will not surface a therapist
 *     list in the online booking wizard.
 *
 * No mutations here — assignments are managed via the staff profile editor
 * (owner workspace → Staff → [staff member] → Services).
 */

import Link from "next/link";
import type { ActiveBranchService } from "@/components/features/manager-settings/types";
import type { StaffForServicePanel, ServiceAssignmentRow } from "@/lib/queries/crm-services";
import { SERVICE_STAFF_TYPES, STAFF_TYPE_LABELS } from "@/constants/staff-roles";
import type { ServiceStaffType } from "@/constants/staff-roles";

// ── Constants ─────────────────────────────────────────────────────────────────

const HARD_EXCLUDED_SYSTEM_ROLES = new Set(["driver", "utility"]);
const SERVICE_STAFF_TYPE_SET = new Set<string>(SERVICE_STAFF_TYPES);

const VISIBILITY_LABEL: Record<string, string> = {
  public: "Public",
  csr_only: "CSR only",
  vip: "VIP",
};

const VISIBILITY_STYLE: Record<string, { color: string; bg: string }> = {
  public:   { color: "var(--cs-success,#27ae60)",      bg: "rgba(39,174,96,0.08)"  },
  csr_only: { color: "var(--cs-info,#2980b9)",          bg: "rgba(41,128,185,0.08)" },
  vip:      { color: "var(--cs-brand,#8e44ad)",         bg: "rgba(142,68,173,0.08)" },
};

const STAFF_TYPE_STYLE: Record<ServiceStaffType, { color: string; bg: string }> = {
  therapist:    { color: "var(--cs-sand)",       bg: "var(--cs-sand-mist)"  },
  nail_tech:    { color: "#7c3aed",               bg: "rgba(124,58,237,0.08)" },
  aesthetician: { color: "#db2777",               bg: "rgba(219,39,119,0.08)" },
  salon_head:   { color: "var(--cs-warning,#e67e22)", bg: "rgba(230,126,34,0.08)" },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

type ServiceRow = {
  branchServiceId: string;
  serviceId: string;
  name: string;
  category: string | null;
  isInSpa: boolean;
  isHomeService: boolean;
  visibility: string;
  assignedProviders: StaffForServicePanel[];
  isCritical: boolean; // public + no providers → online booking shows no therapists
  isWarning: boolean;  // any visibility + no providers
};

function isValidProvider(s: StaffForServicePanel): boolean {
  if (HARD_EXCLUDED_SYSTEM_ROLES.has(s.system_role)) return false;
  return s.staff_type !== null && SERVICE_STAFF_TYPE_SET.has(s.staff_type);
}

function buildServiceRows(
  services: ActiveBranchService[],
  staff: StaffForServicePanel[],
  assignments: ServiceAssignmentRow[]
): ServiceRow[] {
  // Build: serviceId → Set<staffId> from assignment rows
  const assignMap = new Map<string, Set<string>>();
  for (const a of assignments) {
    const set = assignMap.get(a.service_id) ?? new Set<string>();
    set.add(a.staff_id);
    assignMap.set(a.service_id, set);
  }

  // Build staff lookup by id
  const staffById = new Map(staff.map((s) => [s.id, s]));

  return services.map((svc) => {
    const serviceId = svc.service_id ?? svc.services.id;
    const assignedIds = assignMap.get(serviceId) ?? new Set<string>();

    // Assigned providers that are actually valid (correct staff_type, not hard-excluded)
    const assignedProviders = Array.from(assignedIds)
      .map((id) => staffById.get(id))
      .filter((s): s is StaffForServicePanel => s !== undefined && isValidProvider(s));

    const visibility = svc.visibility ?? svc.booking_visibility ?? "public";
    const hasProviders = assignedProviders.length > 0;

    // Get category from the nested relation (may be object or array)
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
      isCritical: visibility === "public" && !hasProviders,
      isWarning: !hasProviders,
    };
  });
}

// ── Sub-components ────────────────────────────────────────────────────────────

function VisibilityBadge({ visibility }: { visibility: string }) {
  const style = VISIBILITY_STYLE[visibility] ?? {
    color: "var(--cs-success,#27ae60)",
    bg: "rgba(39,174,96,0.08)",
  };
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: "0.6875rem",
        fontWeight: 700,
        padding: "2px 7px",
        borderRadius: 20,
        color: style.color,
        background: style.bg,
        whiteSpace: "nowrap",
      }}
    >
      {VISIBILITY_LABEL[visibility] ?? visibility}
    </span>
  );
}

function StaffTypeBadge({ staffType }: { staffType: string | null }) {
  const key = staffType as ServiceStaffType;
  const style = STAFF_TYPE_STYLE[key] ?? { color: "var(--cs-text-muted)", bg: "var(--cs-surface-warm)" };
  const label = staffType ? (STAFF_TYPE_LABELS[key] ?? staffType) : "Unknown type";
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: "0.625rem",
        fontWeight: 700,
        padding: "1px 6px",
        borderRadius: 20,
        color: style.color,
        background: style.bg,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

function EligibilityPill({ label, active }: { label: string; active: boolean }) {
  return (
    <span
      style={{
        fontSize: "0.6875rem",
        fontWeight: 600,
        padding: "2px 7px",
        borderRadius: 20,
        border: `1px solid ${active ? "rgba(39,174,96,0.3)" : "var(--cs-border-soft)"}`,
        color: active ? "var(--cs-success,#27ae60)" : "var(--cs-text-muted)",
        background: active ? "rgba(39,174,96,0.06)" : "transparent",
        whiteSpace: "nowrap",
      }}
    >
      {active ? "✓ " : "— "}{label}
    </span>
  );
}

function ProviderChip({ member }: { member: StaffForServicePanel }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 9px 3px 6px",
        borderRadius: 20,
        background: "var(--cs-surface-warm)",
        border: "1px solid var(--cs-border-soft)",
        fontSize: "0.75rem",
        color: "var(--cs-text)",
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: "50%",
          background: "var(--cs-sand-mist)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "0.625rem",
          fontWeight: 700,
          color: "var(--cs-sand)",
          flexShrink: 0,
        }}
      >
        {member.full_name.charAt(0).toUpperCase()}
      </span>
      <span style={{ fontWeight: 500 }}>{member.full_name}</span>
      <StaffTypeBadge staffType={member.staff_type} />
    </span>
  );
}

function ServiceProviderRow({ row }: { row: ServiceRow }) {
  const rowBg = row.isCritical
    ? "rgba(192,57,43,0.03)"
    : row.isWarning
    ? "rgba(230,126,34,0.03)"
    : "transparent";

  return (
    <div
      style={{
        padding: "0.875rem 1rem",
        borderBottom: "1px solid var(--cs-border-soft)",
        background: rowBg,
        display: "grid",
        gridTemplateColumns: "minmax(180px,2fr) minmax(90px,auto) minmax(90px,1fr)",
        gap: "0.75rem",
        alignItems: "start",
      }}
    >
      {/* Column 1: Service info */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span
            style={{
              fontSize: "0.875rem",
              fontWeight: 600,
              color: "var(--cs-text)",
            }}
          >
            {row.name}
          </span>
          {row.isCritical && (
            <span style={{ fontSize: 14 }} title="Public service with no providers — will not show therapists in online booking">
              ⛔
            </span>
          )}
          {!row.isCritical && row.isWarning && (
            <span style={{ fontSize: 14 }} title="No providers assigned to this service">
              ⚠️
            </span>
          )}
        </div>
        {row.category && (
          <span style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)" }}>
            {row.category}
          </span>
        )}
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 2 }}>
          <EligibilityPill label="In-spa" active={row.isInSpa} />
          <EligibilityPill label="Home" active={row.isHomeService} />
          <VisibilityBadge visibility={row.visibility} />
        </div>
      </div>

      {/* Column 2: Assigned providers */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {row.assignedProviders.length > 0 ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {row.assignedProviders.map((m) => (
              <ProviderChip key={m.id} member={m} />
            ))}
          </div>
        ) : (
          <span
            style={{
              fontSize: "0.8125rem",
              color: row.isCritical
                ? "var(--cs-error,#c0392b)"
                : "var(--cs-warning,#e67e22)",
              fontStyle: "italic",
            }}
          >
            {row.isCritical
              ? "No providers — public booking affected"
              : "No providers assigned"}
          </span>
        )}
      </div>

      {/* Column 3: Provider count */}
      <div
        style={{
          fontSize: "0.75rem",
          color: "var(--cs-text-muted)",
          textAlign: "right",
          paddingTop: 2,
        }}
      >
        {row.assignedProviders.length === 0
          ? "0 providers"
          : `${row.assignedProviders.length} provider${row.assignedProviders.length > 1 ? "s" : ""}`}
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function CrmServiceTherapistPanel({
  services,
  staff,
  assignments,
}: {
  services: ActiveBranchService[];
  staff: StaffForServicePanel[];
  assignments: ServiceAssignmentRow[];
}) {
  if (services.length === 0) {
    return (
      <div className="cs-card" style={{ padding: "2rem", textAlign: "center" }}>
        <p style={{ fontSize: "0.875rem", color: "var(--cs-text-muted)" }}>
          No active services to show provider assignments for.
        </p>
      </div>
    );
  }

  const rows = buildServiceRows(services, staff, assignments);
  const criticalCount = rows.filter((r) => r.isCritical).length;
  const warningCount = rows.filter((r) => r.isWarning && !r.isCritical).length;
  const totalIssues = criticalCount + warningCount;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
      {/* ── Summary banner ── */}
      {totalIssues > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 14px",
            borderRadius: "var(--cs-r-sm,8px)",
            border: `1px solid ${criticalCount > 0 ? "rgba(192,57,43,0.25)" : "rgba(230,126,34,0.25)"}`,
            background: criticalCount > 0 ? "rgba(192,57,43,0.05)" : "rgba(230,126,34,0.05)",
            fontSize: "0.8125rem",
            color: "var(--cs-text-secondary)",
          }}
        >
          <span style={{ fontSize: 18, flexShrink: 0 }}>
            {criticalCount > 0 ? "⛔" : "⚠️"}
          </span>
          <span>
            {criticalCount > 0 && (
              <>
                <strong style={{ color: "var(--cs-error,#c0392b)" }}>
                  {criticalCount} public service{criticalCount > 1 ? "s" : ""} have no providers
                </strong>
                {" — customers won't be able to select a therapist in online booking. "}
              </>
            )}
            {warningCount > 0 && (
              <>
                <strong style={{ color: "var(--cs-warning,#e67e22)" }}>
                  {warningCount} service{warningCount > 1 ? "s" : ""} missing providers
                </strong>
                {criticalCount > 0 ? " (non-public)." : " — assign therapists via the staff profile editor."}
              </>
            )}
          </span>
        </div>
      )}

      {/* ── Service rows ── */}
      <div className="cs-card" style={{ overflow: "hidden", padding: 0 }}>
        {/* Table header */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(180px,2fr) minmax(90px,auto) minmax(90px,1fr)",
            gap: "0.75rem",
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
          <span>Service</span>
          <span>Assigned Providers</span>
          <span style={{ textAlign: "right" }}>Count</span>
        </div>

        {rows.map((row) => (
          <ServiceProviderRow key={row.branchServiceId} row={row} />
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
            <strong style={{ color: "var(--cs-text-secondary)" }}>Who can be a provider?</strong>{" "}
            Only staff with a service staff type — Therapist, Nail Tech, Aesthetician / Facialist, or Salon Head — can appear as booking providers. Drivers, utility staff, CRM staff, CSR staff, and managerial roles are never shown to customers as service providers.
          </div>
          <div>
            <strong style={{ color: "var(--cs-text-secondary)" }}>Assignment required.</strong>{" "}
            Even with the correct staff type, a provider only shows for a service when they are explicitly assigned to it via their staff profile. If no providers are assigned, the booking wizard cannot offer a therapist selection for that service.
          </div>
          <div>
            <strong style={{ color: "var(--cs-text-secondary)" }}>Applies to both booking flows.</strong>{" "}
            Provider assignments affect online booking and CRM in-house bookings equally. Update assignments in the staff profile editor (owner workspace → Staff → [staff member] → Services tab) or{" "}
            <Link
              href="/owner/staff"
              style={{ color: "var(--cs-brand)", textDecoration: "underline" }}
            >
              go to Staff Management →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
