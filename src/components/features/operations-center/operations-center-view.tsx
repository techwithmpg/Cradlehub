"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AttendanceIssueModalRouter } from "@/components/features/attendance/review/attendance-issue-modal-router";
import { RecoveryLinkDialog } from "@/components/features/attendance/devices/recovery-link-dialog";
import { OperationsGuidanceModal } from "@/components/features/operations-center/operations-guidance-modal";
import { ServiceProviderModal } from "@/components/features/operations-center/service-provider-modal";
import { OperationsScheduleSetup } from "@/components/features/operations-center/operations-schedule-setup";
import type { StaffAvailabilityItem } from "@/lib/queries/staff";
import { StaffDuplicateModal } from "@/components/features/operations-center/staff-duplicate-modal";
import { Button } from "@/components/ui/button";
import { buildAttendanceReviewItems } from "@/lib/attendance/crm-review";
import type { AttendanceWorkspaceData } from "@/lib/attendance/types";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  ClipboardList,
  Filter,
  Search,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Users,
} from "lucide-react";
import type {
  OperationalStaffMember,
  OperationsIssue,
  OperationsIssueArea,
  OperationsIssueSeverity,
  OperationsResolutionState,
  OperationsScan,
} from "@/lib/operations-center/issue-model";
import { issueMatchesSearch, scanMatchesSearch } from "@/lib/operations-center/issue-model";

type OperationsCenterViewProps = {
  branchId: string;
  branchName: string;
  checkedAt: string;
  search: string;
  issues: OperationsIssue[];
  scans: OperationsScan[];
  attendanceAvailable: boolean;
  configurationAvailable: boolean;
  staffAvailable: boolean;
  attendanceData: AttendanceWorkspaceData | null;
  branchStaff: OperationalStaffMember[];
  availabilityItems: StaffAvailabilityItem[];
  availabilityAvailable: boolean;
  scheduleDayOfWeek: number;
};

const priorityClasses: Record<OperationsIssueSeverity, string> = {
  critical: "border-red-200 bg-red-50 text-red-800",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  info: "border-slate-200 bg-slate-50 text-slate-700",
};

const stateLabels: Record<OperationsResolutionState, { label: string; badge: string }> = {
  detected: { label: "Detected", badge: "border-slate-200 bg-slate-100 text-slate-700" },
  under_review: { label: "Under Review", badge: "border-blue-200 bg-blue-50 text-blue-800" },
  pending_action: { label: "Pending Action", badge: "border-amber-200 bg-amber-50 text-amber-900" },
};

const areaLabels: Record<OperationsIssueArea, string> = {
  attendance: "Attendance",
  staff_identity: "Staff & Account",
  configuration: "Configuration",
};

export function OperationsCenterView({
  branchId,
  branchName,
  checkedAt,
  search,
  issues,
  scans,
  attendanceAvailable,
  configurationAvailable,
  staffAvailable,
  attendanceData,
  branchStaff,
  availabilityItems,
  availabilityAvailable,
  scheduleDayOfWeek,
}: OperationsCenterViewProps) {
  const router = useRouter();

  // Dialog states
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [selectedScanId, setSelectedScanId] = useState<string | null>(null);
  const [selectedRecoveryStaffId, setSelectedRecoveryStaffId] = useState<string | null>(null);
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  const [duplicateStaffId, setDuplicateStaffId] = useState<string | null>(null);
  const [isProviderModalOpen, setIsProviderModalOpen] = useState(false);
  const [scheduleSetupOpen, setScheduleSetupOpen] = useState(false);
  const [selectedServiceIssue, setSelectedServiceIssue] = useState<{
    serviceId: string;
    serviceName: string;
  } | null>(null);

  // Filter states
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [resolutionFilter, setResolutionFilter] = useState<string>("all");

  const selectedIssue = issues.find((issue) => issue.id === selectedIssueId) ?? null;
  const selectedScan = scans.find((scan) => scan.id === selectedScanId) ?? null;

  const attendanceReviewItems = useMemo(
    () => buildAttendanceReviewItems(attendanceData?.exceptions ?? []),
    [attendanceData?.exceptions]
  );

  const selectedAttendanceItem =
    selectedIssue?.area === "attendance"
      ? (attendanceReviewItems.find(
          (item) => "attendance:" + item.exception.id === selectedIssue.id
        ) ?? null)
      : null;

  // Search and Filtering
  const normalizedSearch = search.trim().toLowerCase();

  const filteredIssues = useMemo(() => {
    return issues.filter((issue) => {
      if (!issueMatchesSearch(issue, normalizedSearch)) return false;
      if (severityFilter !== "all" && issue.severity !== severityFilter) return false;
      if (categoryFilter !== "all" && issue.area !== categoryFilter) return false;
      if (resolutionFilter !== "all" && issue.resolutionState !== resolutionFilter) return false;
      return true;
    });
  }, [issues, normalizedSearch, severityFilter, categoryFilter, resolutionFilter]);

  const matchingScans = useMemo(() => {
    return scans.filter((scan) => scanMatchesSearch(scan, normalizedSearch));
  }, [scans, normalizedSearch]);

  const visibleIssues = filteredIssues.slice(0, 30);
  const visibleScans = matchingScans.slice(0, normalizedSearch ? 16 : 8);

  const incomplete = !attendanceAvailable || !configurationAvailable || !staffAvailable;
  const criticalCount = issues.filter((issue) => issue.severity === "critical").length;
  const attendanceCount = issues.filter((issue) => issue.area === "attendance").length;
  const staffCount = issues.filter((issue) => issue.area === "staff_identity").length;
  const configCount = issues.filter((issue) => issue.area === "configuration").length;

  const unresolvedScans = scans.filter((s) => s.isUnresolvedFailure);
  const unresolvedScanCount = unresolvedScans.length;

  // Operational health: Distinguish unresolved scan failures, confirmed open incidents,
  // and harmless unsuccessful attempts. Do not label a branch fully operational based solely on zero open exceptions.
  const readyLabel = incomplete
    ? "Diagnostics Incomplete"
    : criticalCount > 0
      ? `${criticalCount} Critical Problem${criticalCount > 1 ? "s" : ""}`
      : issues.length > 0
        ? `${issues.length} Open Incident${issues.length > 1 ? "s" : ""}`
        : unresolvedScanCount > 0
          ? `${unresolvedScanCount} Blocked Scan${unresolvedScanCount > 1 ? "s" : ""}`
          : "Current Checks Clear";

  // Action dispatcher when user clicks "Resolve"
  const handleResolveIssue = (issue: OperationsIssue) => {
    if (issue.id === "configuration:no-schedule") {
      setScheduleSetupOpen(true);
      return;
    }
    if (issue.resolutionKind === "provider_assignment" && issue.serviceId) {
      setSelectedServiceIssue({
        serviceId: issue.serviceId,
        serviceName: issue.serviceName ?? issue.title,
      });
      setIsProviderModalOpen(true);
      return;
    }

    if (issue.resolutionKind === "staff_duplicate") {
      setDuplicateStaffId(issue.staffId ?? null);
      setIsDuplicateModalOpen(true);
      return;
    }

    if (issue.area === "attendance") {
      // Check if it's a device limit code
      if (issue.code === "DEVICE_LIMIT_REACHED" && issue.staffId) {
        setSelectedRecoveryStaffId(issue.staffId);
        return;
      }
      setSelectedIssueId(issue.id);
      return;
    }

    setSelectedIssueId(issue.id);
  };

  const handleResolveScan = (scan: OperationsScan) => {
    const isDeviceLimit =
      scan.reasonCode.toUpperCase() === "DEVICE_LIMIT_REACHED" ||
      scan.reasonCode.toUpperCase().includes("DEVICE_LIMIT");

    if (isDeviceLimit && scan.staffId) {
      setSelectedRecoveryStaffId(scan.staffId);
      return;
    }

    setSelectedScanId(scan.id);
  };

  const recoveryEntry =
    selectedRecoveryStaffId && attendanceData
      ? (attendanceData.deviceRegistry.entries.find(
          (entry) => entry.staffId === selectedRecoveryStaffId
        ) ?? null)
      : null;

  return (
    <section className="space-y-5" aria-label="Operations Center">
      {/* Workspace Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-5">
        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--cs-text-muted)]">
            {branchName} · Operational Command & Diagnostics
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--cs-text)]">
            Operations Center
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-[var(--cs-text-secondary)]">
            Detect, diagnose, and resolve branch operational problems using authoritative CradleHub
            workflows.
          </p>
          <p className="mt-2 text-xs text-[var(--cs-text-muted)]">
            Authoritative check: {checkedAt} · Refresh to rerun diagnostics
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {configurationAvailable &&
          issues.some((issue) => issue.resolutionKind === "provider_assignment") ? (
            <Button
              type="button"
              variant="outline"
              className="min-h-10 text-xs font-semibold"
              onClick={() => {
                setSelectedServiceIssue(null);
                setIsProviderModalOpen(true);
              }}
            >
              Assign Providers
            </Button>
          ) : null}
          {issues.some((issue) => issue.id === "configuration:no-schedule") ? (
            <Button
              type="button"
              variant="outline"
              className="min-h-10 text-xs font-semibold"
              onClick={() => setScheduleSetupOpen(true)}
            >
              Set Up Schedules
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            className="min-h-10 text-xs font-semibold"
            onClick={() => {
              setDuplicateStaffId(null);
              setIsDuplicateModalOpen(true);
            }}
          >
            <Users size={14} className="mr-1.5" aria-hidden />
            Compare Staff Profiles
          </Button>
          <Link
            href="/crm/operations-center"
            className="inline-flex min-h-10 items-center rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 text-sm font-semibold hover:bg-[var(--cs-surface-warm)]"
          >
            Refresh checks
          </Link>
        </div>
      </div>

      {/* 6 Authoritative Diagnostic Summary Cards */}
      <div
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6"
        aria-label="Operational Summary Metrics"
      >
        <Summary
          label="Branch Health"
          value={readyLabel}
          icon={ShieldCheck}
          variant={
            incomplete || unresolvedScanCount > 0
              ? "warning"
              : criticalCount > 0
                ? "critical"
                : "normal"
          }
        />
        <Summary
          label="Open Incidents"
          value={incomplete && issues.length === 0 ? "Unavailable" : String(issues.length)}
          icon={AlertTriangle}
          variant={issues.length > 0 ? "warning" : "normal"}
        />
        <Summary
          label="Critical Problems"
          value={incomplete && criticalCount === 0 ? "Unavailable" : String(criticalCount)}
          icon={ShieldAlert}
          variant={criticalCount > 0 ? "critical" : "normal"}
        />
        <Summary
          label="Attendance Reviews"
          value={attendanceAvailable ? String(attendanceCount) : "Unavailable"}
          icon={Smartphone}
        />
        <Summary
          label="Staff & Accounts"
          value={staffAvailable ? String(staffCount) : "Unavailable"}
          icon={Users}
        />
        <Summary
          label="Configuration Health"
          value={configurationAvailable ? String(configCount) : "Unavailable"}
          icon={ClipboardList}
        />
      </div>

      {/* Main Issue Inbox Section */}
      <section className="space-y-3" aria-labelledby="operations-issues-heading">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="operations-issues-heading" className="text-lg font-bold">
              Issue inbox
            </h2>
            <p className="text-xs text-[var(--cs-text-muted)]">
              Unified operational findings across Attendance exceptions, identity discrepancies, and
              service readiness
            </p>
          </div>

          <form
            method="get"
            action="/crm/operations-center"
            role="search"
            className="flex w-full max-w-md gap-2"
          >
            <label htmlFor="operations-search" className="sr-only">
              Search loaded staff issues, codes, services, or scan IDs
            </label>
            <div className="relative min-w-0 flex-1">
              <Search
                size={15}
                aria-hidden
                className="absolute left-3 top-3 text-[var(--cs-text-muted)]"
              />
              <input
                id="operations-search"
                name="q"
                maxLength={96}
                defaultValue={search}
                placeholder="Search staff, service, code, receipt suffix…"
                className="min-h-10 w-full min-w-0 rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] pl-9 pr-3 text-sm focus:border-[var(--cs-sand)] focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="min-h-10 rounded-lg bg-[var(--cs-sidebar-active)] px-3 text-sm font-semibold text-white hover:opacity-95"
            >
              Find
            </button>
          </form>
        </div>

        {/* Multi-facet Filter Bar */}
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] p-2.5 text-xs">
          <div className="flex items-center gap-1 font-semibold text-[var(--cs-text-muted)]">
            <Filter size={13} aria-hidden /> Filter:
          </div>

          <select
            aria-label="Filter by severity"
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="h-8 rounded-md border border-[var(--cs-border)] bg-[var(--cs-surface)] px-2 text-xs"
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
          </select>

          <select
            aria-label="Filter by category"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-8 rounded-md border border-[var(--cs-border)] bg-[var(--cs-surface)] px-2 text-xs"
          >
            <option value="all">All Categories</option>
            <option value="attendance">Attendance</option>
            <option value="staff_identity">Staff & Account</option>
            <option value="configuration">Configuration</option>
          </select>

          <select
            aria-label="Filter by resolution state"
            value={resolutionFilter}
            onChange={(e) => setResolutionFilter(e.target.value)}
            className="h-8 rounded-md border border-[var(--cs-border)] bg-[var(--cs-surface)] px-2 text-xs"
          >
            <option value="all">All States</option>
            <option value="detected">Detected</option>
            <option value="under_review">Under Review</option>
            <option value="pending_action">Pending Action</option>
          </select>

          {severityFilter !== "all" ||
          categoryFilter !== "all" ||
          resolutionFilter !== "all" ||
          normalizedSearch ? (
            <button
              type="button"
              onClick={() => {
                setSeverityFilter("all");
                setCategoryFilter("all");
                setResolutionFilter("all");
                if (search) router.push("/crm/operations-center");
              }}
              className="ml-auto text-[11px] font-semibold text-[var(--cs-text-muted)] underline hover:text-[var(--cs-text)]"
            >
              Reset filters
            </button>
          ) : null}
        </div>

        {/* Issue Cards List */}
        {filteredIssues.length === 0 ? (
          <div className="rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-6 text-sm">
            {incomplete ? (
              <div className="flex items-start gap-3 text-amber-900">
                <AlertTriangle size={22} className="shrink-0 text-amber-700" aria-hidden />
                <div>
                  <p className="font-bold">Diagnostics partially unavailable</p>
                  <p className="mt-1 text-xs text-stone-600">
                    One or more diagnostic queries failed to load. No complete operational
                    conclusion can be drawn from an empty or partial result. Check connectivity or
                    refresh.
                  </p>
                </div>
              </div>
            ) : normalizedSearch ||
              severityFilter !== "all" ||
              categoryFilter !== "all" ||
              resolutionFilter !== "all" ? (
              <div className="text-center text-xs text-[var(--cs-text-muted)]">
                No matching operational issues in the active snapshot for the selected filters.
              </div>
            ) : unresolvedScanCount > 0 ? (
              <div className="flex items-center gap-3 text-amber-900">
                <AlertTriangle size={22} className="shrink-0 text-amber-700" aria-hidden />
                <div>
                  <p className="font-bold">
                    {unresolvedScanCount} unresolved scan attempt(s) requiring review
                  </p>
                  <p className="mt-0.5 text-xs text-stone-600">
                    No confirmed open exceptions logged, but recent unsuccessful scan attempts have
                    not been followed by a successful check-in today.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 text-emerald-800">
                <CheckCircle2 size={22} className="shrink-0 text-emerald-700" aria-hidden />
                <div>
                  <p className="font-bold">Current checks clear</p>
                  <p className="mt-0.5 text-xs text-stone-600">
                    Zero open exceptions or blocked scans detected in current branch snapshot for{" "}
                    {branchName}.
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2.5">
            {visibleIssues.map((issue) => (
              <article
                key={issue.id}
                className="rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-4 transition hover:border-[var(--cs-sand)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={
                        "rounded-md border px-2 py-0.5 text-[11px] font-semibold capitalize " +
                        priorityClasses[issue.severity]
                      }
                    >
                      {issue.severity}
                    </span>
                    <span className="text-xs font-semibold text-[var(--cs-text-muted)]">
                      {areaLabels[issue.area]}
                    </span>
                    <span
                      className={
                        "rounded-md border px-2 py-0.5 text-[11px] font-medium " +
                        stateLabels[issue.resolutionState].badge
                      }
                    >
                      {stateLabels[issue.resolutionState].label}
                    </span>
                  </div>
                  {issue.code ? (
                    <code className="rounded bg-[var(--cs-surface-warm)] px-2 py-0.5 font-mono text-[11px] text-[var(--cs-text-secondary)]">
                      {issue.code}
                    </code>
                  ) : null}
                </div>

                <h3 className="mt-2 text-sm font-bold text-stone-900">{issue.title}</h3>
                <p className="mt-1 text-xs text-[var(--cs-text-secondary)] leading-5">
                  {issue.description}
                </p>
                <p className="mt-2 rounded-md bg-[var(--cs-surface-warm)] p-2 text-xs text-stone-700">
                  <strong className="text-stone-900">Recommended correction: </strong>
                  {issue.guidance}
                </p>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--cs-border-soft)] pt-2.5">
                  <span className="text-[11px] text-[var(--cs-text-muted)]">
                    {issue.scanIdSuffix
                      ? "Receipt suffix: " + issue.scanIdSuffix
                      : issue.detectedAt
                        ? "Detected: " + issue.detectedAt
                        : "Authoritative branch check"}
                  </span>

                  <div className="flex items-center gap-2">
                    {issue.actionHref && (
                      <Link
                        href={issue.actionHref}
                        className="text-xs text-[var(--cs-text-muted)] underline hover:text-stone-800"
                      >
                        External view
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={() => handleResolveIssue(issue)}
                      className="inline-flex min-h-8 items-center gap-1 rounded-lg bg-[var(--cs-sidebar-active)] px-3 text-xs font-semibold text-white hover:opacity-95"
                      aria-label={"Resolve: " + issue.title}
                    >
                      {issue.actionLabel || "Resolve"} <ArrowUpRight size={13} aria-hidden />
                    </button>
                  </div>
                </div>
              </article>
            ))}

            {filteredIssues.length > visibleIssues.length ? (
              <p className="text-center text-xs text-[var(--cs-text-muted)]">
                Showing {visibleIssues.length} of {filteredIssues.length} issues. Use filters or
                search to narrow results.
              </p>
            ) : null}
          </div>
        )}
      </section>

      {/* Recent Unsuccessful Scan Attempts Section */}
      {attendanceAvailable ? (
        <section className="space-y-2.5" aria-labelledby="operations-scan-heading">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 id="operations-scan-heading" className="text-lg font-bold">
                Recent unsuccessful scan attempts
              </h2>
              <p className="text-xs text-[var(--cs-text-muted)]">
                Authoritative check of today&apos;s latest 100 scans. Unsuccessful scan attempts
                help diagnose hardware, device limits, and camera issues before an incident is
                opened.
              </p>
            </div>
          </div>

          {visibleScans.length === 0 ? (
            <div className="rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-4 text-xs text-[var(--cs-text-muted)]">
              No matching unsuccessful attempts in the loaded business day window.
            </div>
          ) : (
            visibleScans.map((scan) => {
              const isDeviceLimit =
                scan.reasonCode.toUpperCase() === "DEVICE_LIMIT_REACHED" ||
                scan.reasonCode.toUpperCase().includes("DEVICE_LIMIT");

              return (
                <div
                  key={scan.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] p-3 text-sm transition hover:border-[var(--cs-sand)]"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="text-stone-900">{scan.staffName}</strong>
                      <span className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-[10px] text-stone-600">
                        {scan.reasonCode.toUpperCase()}
                      </span>
                      {scan.isUnresolvedFailure ? (
                        <span className="rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-800">
                          Unresolved Scan Failure
                        </span>
                      ) : (
                        <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                          Harmless / Succeeded Later
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-[var(--cs-text-secondary)]">{scan.message}</p>
                    <div className="mt-1 text-[11px] text-[var(--cs-text-muted)]">
                      Receipt suffix: <code className="font-mono">{scan.scanIdSuffix}</code> ·{" "}
                      {scan.occurredAt}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isDeviceLimit && scan.staffId ? (
                      <button
                        type="button"
                        onClick={() => setSelectedRecoveryStaffId(scan.staffId)}
                        className="inline-flex min-h-8 items-center gap-1 rounded-md bg-amber-800 px-2.5 text-xs font-semibold text-white hover:bg-amber-900"
                      >
                        <Smartphone size={13} aria-hidden />
                        Replace phone (Device Limit)
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => handleResolveScan(scan)}
                      className="inline-flex min-h-8 items-center gap-1 rounded-md border border-[var(--cs-border)] px-2.5 text-xs font-semibold hover:bg-[var(--cs-surface-warm)]"
                    >
                      Inspect scan <ArrowUpRight size={13} aria-hidden />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </section>
      ) : null}

      {/* Governance & Safeguard Footer Note */}
      <div className="rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface-warm)] p-4 text-xs text-[var(--cs-text-muted)] leading-5">
        <strong>Operations Center Governance: </strong>
        Account duplicate diagnosis is non-destructive. Account merging or deletion requires an
        atomic migration contract to protect historical payroll and booking records. Attendance
        device replacements enforce the {branchName} active device limit; issuing a connection link
        does not confirm an issue as resolved until a subsequent scan succeeds.
      </div>

      {/* Attendance Modal Router (for attendance issues) */}
      {attendanceData && selectedAttendanceItem ? (
        <AttendanceIssueModalRouter
          data={attendanceData}
          item={selectedAttendanceItem}
          onClose={() => setSelectedIssueId(null)}
          onRefresh={() => router.refresh()}
          onManagePhone={(staffId) => {
            setSelectedIssueId(null);
            if (staffId) {
              setSelectedRecoveryStaffId(staffId);
            } else {
              router.push("/crm/attendance?view=setup&section=phones");
            }
          }}
        />
      ) : null}

      {/* Device Recovery Dialog (Priority Workflow 1: DEVICE LIMIT REACHED) */}
      {attendanceData && selectedRecoveryStaffId ? (
        <RecoveryLinkDialog
          open
          onOpenChange={(isOpen) => {
            if (!isOpen) setSelectedRecoveryStaffId(null);
          }}
          registry={attendanceData.deviceRegistry}
          entry={recoveryEntry}
          initialStaffId={selectedRecoveryStaffId}
          onGenerated={() => router.refresh()}
        />
      ) : null}

      {/* Service Provider Assignment Modal (Priority Workflow 3: MISSING PROVIDER) */}
      <ServiceProviderModal
        key={selectedServiceIssue?.serviceId ?? "provider-queue"}
        open={isProviderModalOpen}
        branchId={branchId}
        branchName={branchName}
        serviceId={selectedServiceIssue?.serviceId ?? null}
        serviceName={selectedServiceIssue?.serviceName ?? null}
        branchStaff={branchStaff}
        services={issues
          .filter((issue) => issue.resolutionKind === "provider_assignment" && !!issue.serviceId)
          .map((issue) => ({
            serviceId: issue.serviceId!,
            serviceName: issue.serviceName ?? issue.title,
          }))}
        onClose={() => {
          setIsProviderModalOpen(false);
          setSelectedServiceIssue(null);
        }}
        onAssigned={() => {
          router.refresh();
        }}
      />

      {scheduleSetupOpen ? (
        <OperationsScheduleSetup
          open
          branchId={branchId}
          branchName={branchName}
          available={availabilityAvailable && staffAvailable}
          items={availabilityItems}
          verifiedStaff={branchStaff}
          dayOfWeek={scheduleDayOfWeek}
          onClose={() => setScheduleSetupOpen(false)}
          onSaved={() => router.refresh()}
        />
      ) : null}

      {/* Staff & Duplicate Accounts Review Modal (Priority Workflow 2: DUPLICATE ACCOUNTS) */}
      <StaffDuplicateModal
        open={isDuplicateModalOpen}
        branchId={branchId}
        branchName={branchName}
        initialStaffId={duplicateStaffId}
        branchStaff={branchStaff}
        attendanceData={attendanceData}
        onClose={() => {
          setIsDuplicateModalOpen(false);
          setDuplicateStaffId(null);
        }}
      />

      {/* Guidance Modal Fallback */}
      <OperationsGuidanceModal
        issue={selectedIssue && (!selectedAttendanceItem || !attendanceData) ? selectedIssue : null}
        scan={selectedScan}
        onClose={() => {
          setSelectedIssueId(null);
          setSelectedScanId(null);
        }}
        onOpenDeviceRecovery={(staffId) => {
          setSelectedRecoveryStaffId(staffId);
        }}
      />
    </section>
  );
}

function Summary({
  label,
  value,
  icon: Icon,
  variant = "normal",
}: {
  label: string;
  value: string;
  icon: typeof ShieldCheck;
  variant?: "normal" | "warning" | "critical";
}) {
  const variantStyles = {
    normal: "border-[var(--cs-border)] bg-[var(--cs-surface)] text-stone-900",
    warning: "border-amber-200 bg-amber-50/50 text-amber-950",
    critical: "border-red-200 bg-red-50/50 text-red-950",
  };

  return (
    <div className={`rounded-xl border p-4 ${variantStyles[variant]}`}>
      <div className="flex items-center gap-2 text-xs font-semibold text-[var(--cs-text-muted)]">
        <Icon size={16} aria-hidden />
        {label}
      </div>
      <p className="mt-2 text-lg font-bold tracking-tight">{value}</p>
    </div>
  );
}
