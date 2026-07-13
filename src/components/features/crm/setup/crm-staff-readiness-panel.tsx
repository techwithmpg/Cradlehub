/**
 * CrmStaffReadinessPanel
 *
 * Focused staff-readiness summary derived from the preloaded health data.
 * Used as the "Staff Readiness" tab inside the unified Setup Center.
 *
 * Data is passed from the server page — no additional queries needed.
 */

import Link from "next/link";
import type { CrmSetupHealthData } from "@/lib/queries/crm-setup";

function ReadinessStat({
  label,
  value,
  sub,
  status,
  actionLabel,
  actionHref,
}: {
  label: string;
  value: string;
  sub: string;
  status: "ready" | "warning" | "error" | "info";
  actionLabel?: string;
  actionHref?: string;
}) {
  const borderColor =
    status === "ready" ? "var(--cs-success-bg)" :
    status === "error"  ? "var(--cs-error-bg)"   :
    status === "warning"? "var(--cs-warning-bg)"  :
                          "var(--cs-border-soft)";
  const valColor =
    status === "ready" ? "var(--cs-success-text)" :
    status === "error"  ? "var(--cs-error-text)"   :
    status === "warning"? "var(--cs-warning-text)"  :
                          "var(--cs-text)";

  return (
    <div
      className="cs-card flex flex-col gap-2 p-5"
      style={{ borderTop: `3px solid ${borderColor}` }}
    >
      <div className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--cs-text-muted)]">
        {label}
      </div>
      <div className="text-2xl font-bold tabular-nums" style={{ color: valColor }}>
        {value}
      </div>
      <div className="text-xs text-[var(--cs-text-muted)]">{sub}</div>
      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-[var(--cs-sand)] hover:underline"
        >
          {actionLabel} →
        </Link>
      )}
    </div>
  );
}

export function CrmStaffReadinessPanel({ data }: { data: CrmSetupHealthData }) {
  const missingSchedule = data.serviceStaffTotal - data.serviceStaffWithSchedule;
  const servicesWithoutStaff = data.activeServicesTotal - data.servicesWithStaff;
  const hasIssues = missingSchedule > 0 || servicesWithoutStaff > 0;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="cs-card p-5">
        <h3 className="text-sm font-semibold text-[var(--cs-text)]">Staff Readiness Overview</h3>
        <p className="mt-1 text-xs text-[var(--cs-text-muted)]">
          {hasIssues
            ? "Some staff or service assignments need attention before the branch is fully operational."
            : "All service staff have schedules and all active services have providers assigned. ✅"}
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ReadinessStat
          label="Service Staff"
          value={String(data.serviceStaffTotal)}
          sub="Therapists, nail techs, aestheticians, salon heads"
          status={data.serviceStaffTotal > 0 ? "ready" : "warning"}
        />
        <ReadinessStat
          label="Schedules Set"
          value={`${data.serviceStaffWithSchedule} / ${data.serviceStaffTotal}`}
          sub={missingSchedule === 0 ? "All staff have schedules" : `${missingSchedule} missing`}
          status={missingSchedule === 0 ? "ready" : "warning"}
          actionLabel={missingSchedule > 0 ? "Fix Schedules" : undefined}
          actionHref={missingSchedule > 0 ? "/crm/schedule?tab=setup" : undefined}
        />
        <ReadinessStat
          label="Services With Provider"
          value={`${data.servicesWithStaff} / ${data.activeServicesTotal}`}
          sub={servicesWithoutStaff === 0 ? "All services covered" : `${servicesWithoutStaff} need providers`}
          status={servicesWithoutStaff === 0 ? "ready" : "warning"}
          actionLabel={servicesWithoutStaff > 0 ? "Assign Providers" : undefined}
          actionHref={servicesWithoutStaff > 0 ? "/crm/setup?tab=providers" : undefined}
        />
        <ReadinessStat
          label="Drivers"
          value={String(data.driversTotal)}
          sub={
            !data.homeServiceEnabled
              ? "Home service disabled"
              : data.driversTotal === 0
              ? "No drivers — home service blocked"
              : "Ready for home service"
          }
          status={
            !data.homeServiceEnabled ? "info" :
            data.driversTotal > 0    ? "ready" : "error"
          }
        />
      </div>

      {/* Open issues summary */}
      {data.issues.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--cs-text-muted)]">
            Active Issues ({data.issues.length})
          </h4>
          <div className="space-y-2">
            {data.issues.slice(0, 5).map((issue) => (
              <div
                key={issue.id}
                className="cs-card flex items-start gap-3 p-3"
              >
                <span className="shrink-0 text-base">
                  {issue.severity === "error" ? "⛔" : issue.severity === "warning" ? "⚠️" : "ℹ️"}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-[var(--cs-text)]">{issue.title}</div>
                  <div className="mt-0.5 text-xs text-[var(--cs-text-muted)]">{issue.impact}</div>
                </div>
                {issue.fixHref && (
                  <Link
                    href={issue.fixHref}
                    className="shrink-0 text-xs font-semibold text-[var(--cs-sand)] hover:underline"
                  >
                    Fix →
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
