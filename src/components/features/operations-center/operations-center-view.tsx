"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AttendanceIssueModalRouter } from "@/components/features/attendance/review/attendance-issue-modal-router";
import { OperationsGuidanceModal } from "@/components/features/operations-center/operations-guidance-modal";
import { buildAttendanceReviewItems } from "@/lib/attendance/crm-review";
import type { AttendanceWorkspaceData } from "@/lib/attendance/types";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  ClipboardList,
  Search,
  ShieldCheck,
  Smartphone,
  Users,
  Wrench,
} from "lucide-react";
import type { OperationsIssue, OperationsScan } from "@/lib/operations-center/issue-model";
import { issueMatchesSearch, scanMatchesSearch } from "@/lib/operations-center/issue-model";

type OperationsCenterViewProps = {
  branchName: string;
  checkedAt: string;
  search: string;
  issues: OperationsIssue[];
  scans: OperationsScan[];
  attendanceAvailable: boolean;
  configurationAvailable: boolean;
  attendanceData: AttendanceWorkspaceData | null;
};

const priorityClasses: Record<OperationsIssue["severity"], string> = {
  critical: "border-red-200 bg-red-50 text-red-800",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  info: "border-slate-200 bg-slate-50 text-slate-700",
};

const shortcuts = [
  { title: "Attendance support", detail: "Review incidents and registered phones", href: "/crm/attendance?view=review", icon: Smartphone },
  { title: "Account and identity review", detail: "Review staff records and access before any change", href: "/crm/staff?tab=management", icon: Users },
  { title: "Configuration health", detail: "Check missing services, providers, and schedules", href: "/crm/setup?tab=health", icon: Wrench },
] as const;

export function OperationsCenterView({
  branchName,
  checkedAt,
  search,
  issues,
  scans,
  attendanceAvailable,
  configurationAvailable,
  attendanceData,
}: OperationsCenterViewProps) {
  const router = useRouter();
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [selectedScanId, setSelectedScanId] = useState<string | null>(null);
  const selectedIssue = issues.find((issue) => issue.id === selectedIssueId) ?? null;
  const selectedScan = scans.find((scan) => scan.id === selectedScanId) ?? null;
  const attendanceReviewItems = useMemo(
    () => buildAttendanceReviewItems(attendanceData?.exceptions ?? []),
    [attendanceData?.exceptions]
  );
  const selectedAttendanceItem = selectedIssue?.area === "attendance"
    ? attendanceReviewItems.find((item) => "attendance:" + item.exception.id === selectedIssue.id) ?? null
    : null;
  const normalizedSearch = search.trim().toLowerCase();
  const matchingIssues = issues.filter((issue) => issueMatchesSearch(issue, normalizedSearch));
  const matchingScans = scans.filter((scan) => scanMatchesSearch(scan, normalizedSearch));
  const visibleIssues = matchingIssues.slice(0, 24);
  const visibleScans = matchingScans.slice(0, normalizedSearch ? 16 : 6);
  const incomplete = !attendanceAvailable || !configurationAvailable;
  const attentionCount = issues.filter((issue) => issue.severity !== "info").length;
  const readyLabel = incomplete ? "Incomplete" : attentionCount === 0 ? "No active findings" : "Attention needed";

  return (
    <section className="space-y-5" aria-label="Operations Center">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-5">
        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--cs-text-muted)]">
            {branchName} · Read-only diagnosis
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--cs-text)]">Operations Center</h1>
          <p className="mt-1 max-w-3xl text-sm text-[var(--cs-text-secondary)]">
            Find operational problems and open a focused resolution dialog without leaving this workspace.
          </p>
          <p className="mt-2 text-xs text-[var(--cs-text-muted)]">Last loaded: {checkedAt} · Refresh to rerun checks</p>
        </div>
        <Link href="/crm/operations-center" className="inline-flex min-h-10 items-center rounded-lg border border-[var(--cs-border)] px-3 text-sm font-semibold hover:bg-[var(--cs-surface-warm)]">
          Refresh checks
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-3" aria-label="Diagnostic summary">
        <Summary label="Branch assessment" value={readyLabel} icon={ShieldCheck} />
        <Summary label="Open Attendance reviews" value={attendanceAvailable ? String(issues.filter((issue) => issue.area === "attendance").length) : "Unavailable"} icon={Smartphone} />
        <Summary label="Configuration findings" value={configurationAvailable ? String(issues.filter((issue) => issue.area === "configuration").length) : "Unavailable"} icon={ClipboardList} />
      </div>

      {incomplete ? (
        <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <strong>Some diagnostic checks could not load.</strong> Findings are incomplete, not cleared. Retry or open the existing module directly.
          <div className="mt-2 flex flex-wrap gap-3 font-semibold underline">
            {!attendanceAvailable ? <Link href="/crm/attendance?view=review">Open Attendance</Link> : null}
            {!configurationAvailable ? <Link href="/crm/setup?tab=health">Open Setup Health</Link> : null}
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-3">
        {shortcuts.map((shortcut) => {
          const Icon = shortcut.icon;
          return (
            <Link key={shortcut.title} href={shortcut.href}
              className="rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-4 transition hover:border-[var(--cs-sand)] hover:shadow-sm">
              <div className="mb-2 flex items-center justify-between"><Icon size={19} aria-hidden /><ArrowUpRight size={16} aria-hidden /></div>
              <h2 className="text-sm font-bold">{shortcut.title}</h2>
              <p className="mt-1 text-xs text-[var(--cs-text-secondary)]">{shortcut.detail}</p>
            </Link>
          );
        })}
      </div>

      <section className="space-y-3" aria-labelledby="operations-issues-heading">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="operations-issues-heading" className="text-lg font-bold">Issue inbox</h2>
            <p className="text-xs text-[var(--cs-text-muted)]">Branch-scoped Attendance exceptions and setup readiness findings</p>
          </div>
          <form method="get" action="/crm/operations-center" role="search" className="flex w-full max-w-md gap-2">
            <label htmlFor="operations-search" className="sr-only">Search loaded staff issues, scan codes or receipt suffixes</label>
            <div className="relative min-w-0 flex-1">
              <Search size={15} aria-hidden className="absolute left-3 top-3 text-[var(--cs-text-muted)]" />
              <input id="operations-search" name="q" maxLength={96} defaultValue={search}
                placeholder="Staff, issue, code, scan ID suffix"
                className="min-h-10 w-full min-w-0 rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] pl-9 pr-3 text-sm" />
            </div>
            <button type="submit" className="min-h-10 rounded-lg bg-[var(--cs-sidebar-active)] px-3 text-sm font-semibold text-white">Find</button>
          </form>
        </div>

        {matchingIssues.length === 0 ? (
          <div className="rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-5 text-sm">
            {incomplete ? (
              <><AlertTriangle size={20} aria-hidden className="mb-2 text-amber-700" />
                Some checks are unavailable. No conclusion can be drawn from an empty result.</>
            ) : normalizedSearch ? (
              <>No matching open issue in the loaded branch snapshot. This is not a full historical scan lookup.</>
            ) : (
              <><CheckCircle2 size={20} aria-hidden className="mb-2 text-emerald-700" />
                No actionable Attendance exceptions or Setup Health findings in the current checks.</>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {visibleIssues.map((issue) => (
              <article key={issue.id} className="rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={"rounded-md border px-2 py-0.5 text-[11px] font-semibold capitalize " + priorityClasses[issue.severity]}>{issue.severity}</span>
                    <span className="text-xs font-medium text-[var(--cs-text-muted)]">{issue.area === "attendance" ? "Attendance" : "Configuration"}</span>
                  </div>
                  {issue.code ? <code className="text-xs text-[var(--cs-text-muted)]">{issue.code}</code> : null}
                </div>
                <h3 className="mt-2 text-sm font-bold">{issue.title}</h3>
                <p className="mt-1 text-sm text-[var(--cs-text-secondary)]">{issue.description}</p>
                <p className="mt-2 text-xs text-[var(--cs-text-secondary)]"><strong>Next step: </strong>{issue.guidance}</p>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-[var(--cs-text-muted)]">
                    {issue.scanIdSuffix ? "Scan ID suffix: " + issue.scanIdSuffix : issue.detectedAt ? "Recorded: " + issue.detectedAt : "Branch configuration"}
                  </span>
                  <button type="button" onClick={() => setSelectedIssueId(issue.id)}
                    className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-[var(--cs-border)] px-3 text-xs font-semibold hover:bg-[var(--cs-surface-warm)]"
                    aria-label={"Resolve: " + issue.title}>
                    Resolve <ArrowUpRight size={13} aria-hidden />
                  </button>
                </div>
              </article>
            ))}
            {matchingIssues.length > visibleIssues.length ? <p className="text-xs text-[var(--cs-text-muted)]">Showing first {visibleIssues.length} of {matchingIssues.length} matches. Refine your search.</p> : null}
          </div>
        )}
      </section>

      {attendanceAvailable ? (
        <section className="space-y-2" aria-labelledby="operations-scan-heading">
          <div>
            <h2 id="operations-scan-heading" className="text-lg font-bold">Recent unsuccessful scan attempts</h2>
            <p className="text-xs text-[var(--cs-text-muted)]">Only today's latest 100 recorded scans are available here. A scan attempt is not necessarily an open Attendance incident.</p>
          </div>
          {visibleScans.length === 0 ? (
            <div className="rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-4 text-sm text-[var(--cs-text-muted)]">
              No matching unsuccessful attempts in the loaded scan window.
            </div>
          ) : visibleScans.map((scan) => (
            <div key={scan.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] p-3 text-sm">
              <div className="min-w-0">
                <strong>{scan.staffName}</strong>
                <div className="text-xs text-[var(--cs-text-muted)]">
                  {scan.reasonCode.toUpperCase()} · Scan ID suffix {scan.scanIdSuffix}
                </div>
                <p className="mt-1 text-xs">{scan.message}</p>
              </div>
              <button type="button" onClick={() => setSelectedScanId(scan.id)}
                className="inline-flex min-h-9 items-center gap-1 text-xs font-semibold underline">
                Inspect scan <ArrowUpRight size={13} aria-hidden />
              </button>
            </div>
          ))}
        </section>
      ) : null}

      <p className="rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface-warm)] p-3 text-xs text-[var(--cs-text-muted)]">
        Account duplicates are not automatically diagnosed in this release. Account changes still require verified identity and the existing permission checks. Attendance corrections use the existing authorized dialogs; issuing a recovery link does not itself confirm a successful scan.
      </p>
      {attendanceData && selectedAttendanceItem ? (
        <AttendanceIssueModalRouter
          data={attendanceData}
          item={selectedAttendanceItem}
          onClose={() => setSelectedIssueId(null)}
          onRefresh={() => router.refresh()}
          onManagePhone={(staffId) => {
            setSelectedIssueId(null);
            router.push("/crm/attendance?view=setup&section=phones" + (staffId ? "&staffId=" + encodeURIComponent(staffId) : ""));
          }}
        />
      ) : null}
      <OperationsGuidanceModal
        issue={selectedIssue && (!selectedAttendanceItem || !attendanceData) ? selectedIssue : null}
        scan={selectedScan}
        onClose={() => { setSelectedIssueId(null); setSelectedScanId(null); }}
      />
    </section>
  );
}

function Summary({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof ShieldCheck;
}) {
  return (
    <div className="rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-[var(--cs-text-muted)]"><Icon size={16} aria-hidden />{label}</div>
      <p className="mt-2 text-lg font-bold">{value}</p>
    </div>
  );
}
