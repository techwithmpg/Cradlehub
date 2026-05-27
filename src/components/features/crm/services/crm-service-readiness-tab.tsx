"use client";

/**
 * CrmServiceReadinessTab
 *
 * Displays service setup problems in a clean readiness-issue list.
 *
 * Issues covered:
 *   - Public active services with no valid provider (critical)
 *   - Active services with no valid provider (warning)
 *   - Active services with only one provider — low coverage (warning)
 *   - Active services not available for any delivery mode (warning)
 */

import { useMemo } from "react";
import type { ActiveBranchService } from "@/components/features/manager-settings/types";
import type { StaffForServicePanel, ServiceAssignmentRow } from "@/lib/queries/crm-services";
import { ReadinessIssueList } from "@/components/shared/readiness-issue-list";
import type { ReadinessIssue } from "@/types/readiness";
import { buildServiceTableRows } from "./crm-therapist-assignment-tab";

function buildReadinessIssues(
  rows: ReturnType<typeof buildServiceTableRows>
): ReadinessIssue[] {
  const issues: ReadinessIssue[] = [];

  for (const row of rows) {
    const providerCount = row.assignedProviders.length;

    // Critical: public service with no providers
    if (row.isCritical) {
      issues.push({
        id: `service:${row.serviceId}:no-public-provider`,
        scope: "service",
        severity: "critical",
        title: `Public service has no provider — ${row.name}`,
        problem: `"${row.name}" is visible to customers but has no eligible provider assigned.`,
        impact: "Customers may not be able to choose a therapist or complete a booking for this service online.",
        fix: "Assign at least one eligible service provider (therapist, nail tech, aesthetician, or salon head).",
        actionLabel: "Fix in Services tab",
        actionHref: "/crm/services",
        source: "CrmServiceReadinessTab",
        entityType: "service",
        entityIds: [row.serviceId],
        count: 1,
      });
      continue;
    }

    // Warning: no providers at all
    if (providerCount === 0) {
      issues.push({
        id: `service:${row.serviceId}:no-internal-provider`,
        scope: "service",
        severity: "warning",
        title: `Service has no provider — ${row.name}`,
        problem: `"${row.name}" has no eligible provider assigned yet.`,
        impact: "CRM may not be able to assign this service during in-house or internal booking.",
        fix: "Assign an eligible provider, or disable the service until it is ready.",
        actionLabel: "Fix in Services tab",
        actionHref: "/crm/services",
        source: "CrmServiceReadinessTab",
        entityType: "service",
        entityIds: [row.serviceId],
        count: 1,
      });
      continue;
    }

    // Warning: low coverage (only 1 provider)
    if (providerCount === 1) {
      issues.push({
        id: `service:${row.serviceId}:low-coverage`,
        scope: "service",
        severity: "warning",
        title: `Low provider coverage — ${row.name}`,
        problem: `"${row.name}" has only one eligible provider assigned.`,
        impact: "If that provider is unavailable, the service cannot be booked.",
        fix: "Assign at least one more eligible provider to ensure coverage.",
        actionLabel: "Fix in Services tab",
        actionHref: "/crm/services",
        source: "CrmServiceReadinessTab",
        entityType: "service",
        entityIds: [row.serviceId],
        count: 1,
      });
    }

    // Warning: not available for any delivery mode
    if (!row.isInSpa && !row.isHomeService) {
      issues.push({
        id: `service:${row.serviceId}:no-delivery`,
        scope: "service",
        severity: "warning",
        title: `Service has no delivery mode — ${row.name}`,
        problem: `"${row.name}" is not enabled for in-spa or home service.`,
        impact: "Customers cannot book this service through any channel.",
        fix: "Enable in-spa or home service availability for this branch service.",
        actionLabel: "Fix in Services tab",
        actionHref: "/crm/services",
        source: "CrmServiceReadinessTab",
        entityType: "service",
        entityIds: [row.serviceId],
        count: 1,
      });
    }
  }

  return issues;
}

// ── KPI summary ───────────────────────────────────────────────────────────────

function ReadinessKpi({
  count,
  label,
  color,
}: {
  count: number;
  label: string;
  color: string;
}) {
  return (
    <div
      className="cs-card"
      style={{ padding: "0.875rem 1rem", display: "flex", alignItems: "center", gap: "0.625rem" }}
    >
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: "50%",
          background: color,
          flexShrink: 0,
        }}
      />
      <div>
        <span style={{ fontSize: "1.125rem", fontWeight: 700, color }}>{count}</span>
        <span style={{ fontSize: "0.75rem", color: "var(--cs-text-secondary)", marginLeft: 6 }}>
          {label}
        </span>
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function CrmServiceReadinessTab({
  services,
  staff,
  assignments,
}: {
  services: ActiveBranchService[];
  staff: StaffForServicePanel[];
  assignments: ServiceAssignmentRow[];
}) {
  const rows = useMemo(() => buildServiceTableRows(services, staff, assignments), [services, staff, assignments]);
  const issues = useMemo(() => buildReadinessIssues(rows), [rows]);

  const criticalCount = issues.filter((i) => i.severity === "critical").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;
  const healthyCount = rows.length - issues.length;

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
          🔎
        </div>
        <div>
          <div style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--cs-text)" }}>
            Service Readiness Check
          </div>
          <div style={{ fontSize: "0.8125rem", color: "var(--cs-text-secondary)", lineHeight: 1.5, marginTop: 2 }}>
            Review what blocks booking for your branch services. Fix critical issues first,
            then warnings, so customers and CRM can book confidently.
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <ReadinessKpi
          count={healthyCount}
          label="Healthy"
          color="#065F46"
        />
        <ReadinessKpi
          count={criticalCount}
          label="Critical"
          color="#991B1B"
        />
        <ReadinessKpi
          count={warningCount}
          label="Warnings"
          color="#92400E"
        />
      </div>

      {/* Issue list */}
      <ReadinessIssueList
        issues={issues}
        title="All Service Issues"
        description="Issues are ordered by severity: critical first, then warning."
        emptyTitle="All services look good"
        emptyDescription="No critical or warning issues found for your branch services."
      />
    </div>
  );
}
