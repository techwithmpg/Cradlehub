"use client";

import { useCallback, useMemo, useState } from "react";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { AdminDialog, AdminOverlayBody, AdminOverlayHeader } from "@/components/shared/overlays";
import type {
  LiveScheduleConflict,
  LiveScheduleConflictQuickAction,
} from "@/lib/schedule/live-schedule-conflict-types";
import { ScheduleConflictAcceptExceptionDialog } from "./schedule-conflict-accept-exception-dialog";
import { ScheduleConflictCategoryTabs } from "./schedule-conflict-category-tabs";
import {
  buildScheduleConflictImpactCounts,
  buildScheduleConflictIssues,
  buildScheduleConflictSeverityCounts,
  buildScheduleConflictTabCounts,
  filterScheduleConflictIssues,
  formatImpactSummary,
  formatSeveritySummary,
  type AcceptedScheduleConflictException,
  type ScheduleConflictResolutionIssue,
  type ScheduleConflictTabKey,
} from "./schedule-conflict-center-model";
import { ScheduleConflictImpactSummary } from "./schedule-conflict-impact-summary";
import { ScheduleConflictIssueList } from "./schedule-conflict-issue-list";
import { ScheduleConflictResolutionPanel } from "./schedule-conflict-resolution-panel";

type Props = {
  open: boolean;
  conflicts: LiveScheduleConflict[];
  branchName: string;
  date: string;
  onOpenChange: (open: boolean) => void;
  onAction: (
    conflict: LiveScheduleConflict,
    action: LiveScheduleConflictQuickAction
  ) => void;
};

function formatScheduleDate(date: string): string {
  const [yearValue, monthValue, dayValue] = date.split("-").map(Number);
  if (!yearValue || !monthValue || !dayValue) return date;

  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "2-digit",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(yearValue, monthValue - 1, dayValue)));
}

export function ScheduleConflictCenterDialog({
  open,
  conflicts,
  branchName,
  date,
  onOpenChange,
  onAction,
}: Props) {
  const [activeTab, setActiveTab] = useState<ScheduleConflictTabKey>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [exceptionIssue, setExceptionIssue] = useState<ScheduleConflictResolutionIssue | null>(null);
  const [acceptedExceptions, setAcceptedExceptions] = useState<AcceptedScheduleConflictException[]>([]);
  const issues = useMemo(
    () => buildScheduleConflictIssues(conflicts, acceptedExceptions),
    [acceptedExceptions, conflicts]
  );
  const activeConflicts = useMemo(
    () => issues.filter((issue) => issue.status === "active").map((issue) => issue.conflict),
    [issues]
  );
  const impactCounts = useMemo(() => buildScheduleConflictImpactCounts(issues), [issues]);
  const tabCounts = useMemo(() => buildScheduleConflictTabCounts(issues), [issues]);
  const filteredIssues = useMemo(
    () => filterScheduleConflictIssues({ issues, tab: activeTab, query: searchQuery }),
    [activeTab, issues, searchQuery]
  );
  const activeSeveritySummary = formatSeveritySummary(buildScheduleConflictSeverityCounts(activeConflicts));
  const impactSummary = formatImpactSummary(impactCounts);
  const selectedIssue =
    issues.find((issue) => issue.conflict.id === selectedIssueId) ?? null;
  const duplicateIssueCount = filteredIssues.filter(
    (issue) => issue.conflict.type === "duplicate_schedule_window"
  ).length;

  const handleRunAction = useCallback(
    (conflict: LiveScheduleConflict, action: LiveScheduleConflictQuickAction) => {
      onAction(conflict, action);
    },
    [onAction]
  );

  const handleAcceptException = useCallback((exception: AcceptedScheduleConflictException) => {
    setAcceptedExceptions((current) => [
      ...current.filter((item) => item.conflictId !== exception.conflictId),
      exception,
    ]);
    setExceptionIssue(null);
    setSelectedIssueId(exception.conflictId);
    setActiveTab("accepted");
  }, []);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        setActiveTab("all");
        setSearchQuery("");
        setSelectedIssueId(null);
        setExceptionIssue(null);
      }
      onOpenChange(nextOpen);
    },
    [onOpenChange]
  );

  return (
    <AdminDialog
      open={open}
      onOpenChange={handleOpenChange}
      size="wide"
      placement="center"
      ariaLabel="Schedule Conflict Center"
      className="h-[100dvh] max-h-[100dvh] w-full max-w-full rounded-none bg-[#fffaf2] sm:h-auto sm:max-h-[85vh] sm:w-[calc(100%-1rem)] sm:rounded-2xl"
    >
      <AdminOverlayHeader
        title="Schedule Conflict Center"
        description="Keep booking accuracy, staff schedules, rooms, and home service timing safe."
        className="sticky top-0 z-20 bg-[#fffaf2] pr-12"
      >
        <div className="flex max-w-[520px] flex-wrap justify-end gap-1.5 text-right">
          <HeaderChip label="Must Fix" value={impactCounts.must_fix} tone="red" />
          <HeaderChip label="Needs Approval" value={impactCounts.needs_approval} tone="amber" />
          <HeaderChip label="Cleanup" value={impactCounts.cleanup_warning} tone="yellow" />
          <HeaderChip label="Accepted" value={impactCounts.accepted} tone="stone" />
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-800">
            <CheckCircle2 className="size-3" />
            Live check
          </span>
        </div>
      </AdminOverlayHeader>

      <AdminOverlayBody padded={false} className="bg-[var(--cs-surface-warm)]">
        <div className="sticky top-0 z-10 border-b border-[var(--cs-border-soft)] bg-[#fffaf2] px-4 py-3 sm:px-5">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold text-[var(--cs-text-muted)]">
            <span>{branchName} · {formatScheduleDate(date)}</span>
            <span>{impactSummary} · {activeSeveritySummary}</span>
          </div>
          <ScheduleConflictCategoryTabs
            activeTab={activeTab}
            counts={tabCounts}
            onTabChange={setActiveTab}
          />
        </div>

        <div className="grid min-h-0 gap-4 px-4 py-4 lg:grid-cols-[250px_minmax(360px,1fr)_320px] lg:px-5">
          <section className="min-w-0">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[var(--cs-text-muted)]">
              Impact groups
            </p>
            <ScheduleConflictImpactSummary
              counts={impactCounts}
              activeTab={activeTab}
              onTabChange={setActiveTab}
            />
          </section>

          {conflicts.length === 0 ? (
            <div className="rounded-2xl border border-emerald-200 bg-white p-6 text-center text-emerald-950 shadow-sm">
              <ShieldCheck className="mx-auto size-6 text-emerald-700" />
              <h3 className="mt-3 text-sm font-bold">All clear for this schedule window.</h3>
              <p className="mt-1 text-xs text-emerald-900">
                No conflicts were found for the selected branch and date.
              </p>
            </div>
          ) : (
            <ScheduleConflictIssueList
              issues={filteredIssues}
              query={searchQuery}
              selectedIssueId={selectedIssueId}
              onQueryChange={setSearchQuery}
              onIssueSelect={(issue) => setSelectedIssueId(issue.conflict.id)}
              onAcceptException={setExceptionIssue}
              onActionSelect={(conflict, action) => {
                setSelectedIssueId(conflict.id);
                handleRunAction(conflict, action);
              }}
            />
          )}

          <ScheduleConflictResolutionPanel
            issue={selectedIssue}
            duplicateIssueCount={duplicateIssueCount}
            onRunAction={handleRunAction}
            onAcceptException={setExceptionIssue}
            onClear={() => setSelectedIssueId(null)}
          />
        </div>
      </AdminOverlayBody>
      <ScheduleConflictAcceptExceptionDialog
        issue={exceptionIssue}
        onAccept={handleAcceptException}
        onClose={() => setExceptionIssue(null)}
      />
    </AdminDialog>
  );
}

function HeaderChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "red" | "amber" | "yellow" | "stone";
}) {
  const className = {
    red: "border-red-200 bg-red-50 text-red-800",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    yellow: "border-yellow-200 bg-yellow-50 text-yellow-900",
    stone: "border-stone-200 bg-white text-stone-700",
  }[tone];

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold ${className}`}>
      {label} {value}
    </span>
  );
}
