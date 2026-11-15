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
import { AlertTriangle, CheckCircle2, SearchCheck, ShieldAlert } from "lucide-react";
import { CrmAlertCard, CrmStatCard } from "@/components/features/crm/shared/crm-cards";
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
        actionLabel: "Fix in Providers tab",
        actionHref: "/crm/services?tab=providers",
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
        actionLabel: "Fix in Customization tab",
        actionHref: "/crm/services?tab=customization",
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
        actionLabel: "Fix in Providers tab",
        actionHref: "/crm/services?tab=providers",
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
        actionLabel: "Fix in Customization tab",
        actionHref: "/crm/services?tab=customization",
        source: "CrmServiceReadinessTab",
        entityType: "service",
        entityIds: [row.serviceId],
        count: 1,
      });
    }
  }

  return issues;
}

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
    <div className="flex flex-col gap-5">
      <CrmAlertCard
        tone="info"
        role="region"
        title="Service Readiness Check"
        description="Review what blocks booking for your branch services. Fix critical issues first, then warnings, so customers and CRM can book confidently."
        icon={<SearchCheck className="size-4.5" aria-hidden="true" />}
      />

      {/* KPI strip */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <CrmStatCard
          title="Healthy"
          value={healthyCount}
          subtitle="Services ready for booking"
          tone="success"
          icon={<CheckCircle2 className="size-4.5" aria-hidden="true" />}
        />
        <CrmStatCard
          title="Critical"
          value={criticalCount}
          subtitle="Public services blocked"
          tone="danger"
          icon={<ShieldAlert className="size-4.5" aria-hidden="true" />}
        />
        <CrmStatCard
          title="Warnings"
          value={warningCount}
          subtitle="Low coverage or delivery gaps"
          tone="warning"
          icon={<AlertTriangle className="size-4.5" aria-hidden="true" />}
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
