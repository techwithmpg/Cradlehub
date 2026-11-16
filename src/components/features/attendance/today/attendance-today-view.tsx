"use client";

import { useMemo, useRef, useState } from "react";
import { readAttendanceCredit } from "@/lib/attendance/v2-policy";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Clock3,
  Users,
} from "lucide-react";
import { StaffAvatar } from "@/components/features/attendance/attendance-ui";
import { LiveShiftClock } from "@/components/features/attendance/shared/live-shift-clock";
import { AttendanceRecentActivity } from "@/components/features/attendance/today/attendance-recent-activity";
import { AttendanceStaffTable } from "@/components/features/attendance/today/attendance-staff-table";
import {
  AttendanceSummaryCards,
  type TodaySummaryFilterKey,
} from "@/components/features/attendance/today/attendance-summary-cards";
import { Button } from "@/components/ui/button";
import {
  computeShiftProgressDetail,
  findExceptionRecord,
  formatAttendanceRole,
  formatShortClock,
  formatWorkedDuration,
  getReviewIssueHeadline,
  getStaffShiftWindow,
  hasAuthorizedCorrectionPath,
} from "@/lib/attendance/crm-attendance-presenter";
import type { AttendanceReviewItem } from "@/lib/attendance/crm-review";
import type { AttendanceStaffDiagnostic } from "@/lib/attendance/staff-diagnostics";
import type { AttendanceWorkspaceData } from "@/lib/attendance/types";
import { cn } from "@/lib/utils";

function formatDetectedShort(value: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function AttendanceTodayView({
  data,
  rows,
  reviewItems,
  onOpen,
  onOpenReviewItem,
  onOpenAllReview,
  onOpenHistory,
  onOpenPhone,
}: {
  data: AttendanceWorkspaceData;
  rows: AttendanceStaffDiagnostic[];
  reviewItems: AttendanceReviewItem[];
  onOpen: (row: AttendanceStaffDiagnostic) => void;
  onOpenReviewItem: (item: AttendanceReviewItem) => void;
  onOpenAllReview: () => void;
  onOpenHistory: (row?: AttendanceStaffDiagnostic) => void;
  onOpenPhone: (row?: AttendanceStaffDiagnostic) => void;
}) {
  const [rosterExpanded, setRosterExpanded] = useState(false);
  const rosterRef = useRef<HTMLDivElement | null>(null);

  const workingRows = useMemo(() => rows.filter((row) => row.working), [rows]);
  const notInCount = useMemo(() => rows.filter((row) => row.notScannedIn).length, [rows]);
  const checkedOutCount = useMemo(() => rows.filter((row) => row.checkedOut).length, [rows]);
  const needsHelpCount = useMemo(() => rows.filter((row) => row.needsHelp).length, [rows]);

  const scheduleTotal = Math.max(
    1,
    workingRows.length + notInCount + checkedOutCount + needsHelpCount
  );
  const workingPct = Math.round((workingRows.length / scheduleTotal) * 100);
  const notInPct = Math.round((notInCount / scheduleTotal) * 100);
  const checkedOutPct = Math.round((checkedOutCount / scheduleTotal) * 100);
  const needsHelpPct = Math.max(0, 100 - workingPct - notInPct - checkedOutPct);

  const attentionPreview = useMemo(() => reviewItems.slice(0, 5), [reviewItems]);
  const activeServiceContexts = data.sessions.filter(
    (session) => session.booking_progress_status === "session_started"
  );

  function handleSummaryCardClick(key: TodaySummaryFilterKey) {
    if (key === "needs_help" && reviewItems.length > 0) {
      onOpenAllReview();
      return;
    }
    setRosterExpanded(true);
    window.setTimeout(() => {
      rosterRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  return (
    <div className="grid gap-5">
      {/* 4 Pastel Summary KPI Cards */}
      <AttendanceSummaryCards
        rows={rows}
        openReviewCount={reviewItems.length}
        onSelectCard={handleSummaryCardClick}
      />

      {/* Primary 2-Column Operations Grid matching Concept 1 (approx 60% / 40%) */}
      <div className="grid grid-cols-1 gap-4 @[760px]:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] @[760px]:items-start">
        {/* Left Column: Working Now + Today's Schedule Overview */}
        <div className="grid min-w-0 gap-4">
          <section
            aria-labelledby="working-now-heading"
            className="overflow-hidden rounded-2xl border border-[var(--cs-border-soft)] bg-white shadow-2xs"
          >
            <div className="flex items-start justify-between gap-3 border-b border-[var(--cs-border-soft)] px-4 py-3.5 sm:px-5">
              <div>
                <h2
                  id="working-now-heading"
                  className="flex items-center gap-2 text-base font-bold text-[var(--cs-text)]"
                >
                  <span
                    aria-hidden="true"
                    className="inline-block size-2.5 rounded-full bg-[#2D6A45] motion-safe:animate-pulse"
                  />
                  Working Now ({workingRows.length})
                </h2>
                <p className="mt-0.5 text-xs text-[var(--cs-text-muted)]">
                  Live staff with ongoing shifts
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setRosterExpanded((v) => !v)}
                className="h-8 rounded-lg border-[var(--cs-border)] bg-[#FAF8F5] px-2.5 text-xs font-semibold text-[var(--cs-text-secondary)] hover:bg-white"
              >
                <Users className="mr-1.5 size-3.5" />
                {rosterExpanded ? "Hide Full Roster" : `Full Roster (${rows.length})`}
              </Button>
            </div>

            {workingRows.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <p className="text-sm font-semibold text-[var(--cs-text)]">
                  No staff currently clocked in
                </p>
                <p className="mt-1 text-xs text-[var(--cs-text-muted)]">
                  Staff who scan in for today&apos;s shifts will appear here live.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--cs-border-soft)]">
                {workingRows.map((row) => {
                  const win = getStaffShiftWindow(row);
                  const scheduleLabel =
                    win.startAt && win.endAt
                      ? `${formatShortClock(win.startAt, row.staff.timezone)} – ${formatShortClock(win.endAt, row.staff.timezone)}`
                      : row.staff.clockInAt
                        ? `In ${formatShortClock(row.staff.clockInAt, row.staff.timezone)} · No fixed end`
                        : "On shift";
                  const progressDetail = computeShiftProgressDetail({
                    clockInAt: row.staff.clockInAt,
                    scheduledStartAt: win.startAt,
                    scheduledEndAt: win.endAt,
                    nowMs: data.serverNowMs,
                  });

                  return (
                    <button
                      key={row.staff.staffId}
                      type="button"
                      onClick={() => onOpen(row)}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-[#FAF8F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#1F4E33] sm:px-5"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <StaffAvatar
                          name={row.staff.staffName}
                          className="size-9 bg-[#2D6A45] text-xs font-bold text-white"
                        />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="truncate text-sm font-bold text-[var(--cs-text)]">
                              {row.staff.staffName}
                            </span>
                            {row.status === "in_service" ? (
                              <span className="rounded-md bg-[#E3F3E9] px-1.5 py-0.5 text-[0.65rem] font-bold text-[#1F4E33]">
                                In Service
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-0.5 truncate text-xs text-[var(--cs-text-muted)]">
                            {formatAttendanceRole(row.staff.staffType)}
                          </div>
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-col items-end gap-1.5 sm:min-w-[205px]">
                        <div className="flex flex-wrap items-center justify-end gap-1.5 text-xs">
                          <span className="font-semibold text-[var(--cs-text-secondary)] tabular-nums">
                            {scheduleLabel}
                          </span>
                          {row.staff.clockInAt && !row.staff.clockOutAt ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-[#EEF8F2] px-1.5 py-0.5 text-[0.68rem] font-bold text-[#1F4E33] ring-1 ring-[#CBE6D4] tabular-nums">
                              <Clock3 className="size-3" />
                              <LiveShiftClock
                                clockInAt={row.staff.clockInAt}
                                initialNowMs={data.serverNowMs}
                                credit={readAttendanceCredit(
                                  data.records.find(
                                    (record) => record.id === row.staff.attendanceRecordId
                                  )?.attendance_policy_snapshot
                                )}
                              />
                            </span>
                          ) : null}
                        </div>

                        {progressDetail !== null ? (
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <div
                              role="progressbar"
                              aria-label={`${row.staff.staffName} shift progress`}
                              aria-valuemin={0}
                              aria-valuemax={100}
                              aria-valuenow={progressDetail.percent}
                              className="h-2.5 w-28 overflow-hidden rounded-full bg-[#E3DDD2] ring-1 ring-inset ring-black/8 sm:w-36"
                            >
                              <div
                                className="h-full rounded-full bg-[#2D6A45] transition-[width] duration-500 ease-out motion-reduce:transition-none"
                                style={{
                                  width: `${progressDetail.percent}%`,
                                  minWidth: progressDetail.percent > 0 ? "6px" : "0px",
                                  backgroundColor: progressDetail.isBeyondSchedule
                                    ? "#1F4E33"
                                    : "#2D6A45",
                                }}
                              />
                            </div>
                            <span className="min-w-[2.2rem] text-right text-[0.72rem] font-bold text-[var(--cs-text-secondary)] tabular-nums">
                              {progressDetail.percent}%
                            </span>
                            {progressDetail.isBeyondSchedule ? (
                              <span
                                title={`Beyond scheduled shift by ${formatWorkedDuration(progressDetail.overtimeMinutes)}`}
                                className="rounded bg-amber-100 px-1.5 py-0.5 text-[0.62rem] font-bold text-amber-800"
                              >
                                Beyond schedule
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className="h-2.5 w-24 overflow-hidden rounded-full bg-[#DCEFE3] ring-1 ring-inset ring-[#BFE0CA]">
                              <div
                                className="h-full w-full rounded-full bg-[#2D6A45]/75"
                                style={{ backgroundColor: "rgba(45, 106, 69, 0.78)" }}
                              />
                            </div>
                            <span className="text-[0.68rem] font-semibold text-[#1F4E33]">
                              Active shift
                            </span>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* Today's Schedule Overview Card */}
          <section
            aria-labelledby="schedule-overview-heading"
            className="rounded-2xl border border-[var(--cs-border-soft)] bg-white p-5 shadow-2xs"
          >
            <div className="flex items-center justify-between gap-2">
              <h2
                id="schedule-overview-heading"
                className="flex items-center gap-2 text-sm font-bold text-[var(--cs-text)]"
              >
                <CalendarDays className="size-4 text-[#8A6347]" />
                Today&apos;s Schedule Overview
              </h2>
              <span className="text-xs font-medium text-[var(--cs-text-muted)]">
                {workingRows.length + notInCount + checkedOutCount + needsHelpCount} scheduled /
                active
              </span>
            </div>

            <div className="mt-4 flex h-4 w-full overflow-hidden rounded-full bg-[#F0ECE5]">
              {workingRows.length > 0 ? (
                <div
                  className="h-full bg-[#2D6A45] transition-all"
                  style={{ width: `${workingPct}%` }}
                  title={`On shift (${workingRows.length})`}
                />
              ) : null}
              {notInCount > 0 ? (
                <div
                  className="h-full bg-[#E1C993] transition-all"
                  style={{ width: `${notInPct}%` }}
                  title={`Not started (${notInCount})`}
                />
              ) : null}
              {checkedOutCount > 0 ? (
                <div
                  className="h-full bg-[#8FB99C] transition-all"
                  style={{ width: `${checkedOutPct}%` }}
                  title={`Completed (${checkedOutCount})`}
                />
              ) : null}
              {needsHelpCount > 0 && needsHelpPct > 0 ? (
                <div
                  className="h-full bg-[#D97A7A] transition-all"
                  style={{ width: `${needsHelpPct}%` }}
                  title={`Needs review (${needsHelpCount})`}
                />
              ) : null}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-semibold text-[var(--cs-text-secondary)]">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-[#2D6A45]" />
                On shift ({workingRows.length})
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-[#E1C993]" />
                Not started ({notInCount})
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-[#8FB99C]" />
                Completed ({checkedOutCount})
              </span>
              {needsHelpCount > 0 ? (
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full bg-[#D97A7A]" />
                  Needs review ({needsHelpCount})
                </span>
              ) : null}
            </div>
          </section>
        </div>

        {/* Right Column: Needs Attention Exception Panel */}
        <div className="grid min-w-0 gap-4">
          <section
            aria-labelledby="needs-attention-heading"
            className="overflow-hidden rounded-2xl border border-[var(--cs-border-soft)] bg-white shadow-2xs"
          >
            <div className="border-b border-[var(--cs-border-soft)] px-4 py-3.5 sm:px-5">
              <h2
                id="needs-attention-heading"
                className="flex items-center gap-2 text-base font-bold text-[var(--cs-text)]"
              >
                <span className="flex size-6 items-center justify-center rounded-md bg-amber-100 text-amber-800">
                  <AlertTriangle className="size-3.5" />
                </span>
                Needs Attention ({reviewItems.length})
              </h2>
              <p className="mt-0.5 text-xs text-[var(--cs-text-muted)]">
                Attendance items that require your action
              </p>
            </div>

            {attentionPreview.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <p className="text-sm font-semibold text-[var(--cs-text)]">
                  No open attendance exceptions
                </p>
                <p className="mt-1 text-xs text-[var(--cs-text-muted)]">
                  All clocked shifts and scans look clean today.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--cs-border-soft)] p-2">
                {attentionPreview.map((item, idx) => {
                  const staffName = item.exception.staff_name ?? "Staff member";
                  const headline = getReviewIssueHeadline(item, data.timezone);
                  const matchedRecord = findExceptionRecord(item.exception, data.records);
                  const canFix = hasAuthorizedCorrectionPath(item, Boolean(matchedRecord));
                  const detectedAt = formatDetectedShort(
                    item.exception.last_detected_at ?? item.exception.detected_at,
                    data.timezone
                  );
                  const highlightCritical = item.priority === "critical" || idx === 0;
                  const tagTone =
                    headline.shortTag === "Unclosed Shift" || headline.shortTag === "Conflict"
                      ? "border-rose-200 bg-rose-50 text-rose-700"
                      : headline.shortTag === "Late" || headline.shortTag === "Phone Setup"
                        ? "border-amber-200 bg-amber-50 text-amber-800"
                        : "border-stone-200 bg-stone-100 text-stone-700";

                  return (
                    <div
                      key={item.id}
                      className={cn(
                        "flex items-center justify-between gap-2.5 rounded-xl px-2.5 py-2.5 transition",
                        highlightCritical
                          ? "bg-[#FDF3F3] ring-1 ring-[#F4D5D5]"
                          : "hover:bg-[#FAF8F5]"
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <StaffAvatar
                          name={staffName}
                          className="size-8 shrink-0 bg-[#2D6A45] text-[0.68rem] font-bold text-white"
                        />
                        <div className="min-w-0">
                          <div className="truncate text-[0.82rem] font-bold text-[var(--cs-text)]">
                            {staffName}
                          </div>
                          <div className="truncate text-xs text-[var(--cs-text-secondary)]">
                            {headline.title}
                          </div>
                          <div className="mt-0.5 text-[0.68rem] text-[var(--cs-text-muted)]">
                            {detectedAt}
                          </div>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-1.5">
                        <span
                          className={cn(
                            "hidden rounded-md border px-2 py-0.5 text-[0.66rem] font-bold whitespace-nowrap sm:inline-flex",
                            tagTone
                          )}
                        >
                          {headline.shortTag}
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          variant={canFix ? "default" : "outline"}
                          onClick={() => onOpenReviewItem(item)}
                          style={
                            canFix ? { backgroundColor: "#1F4E33", color: "#FFFFFF" } : undefined
                          }
                          className={cn(
                            "h-7.5 rounded-lg px-2.5 text-[0.72rem] font-semibold",
                            canFix
                              ? "!bg-[#1F4E33] !text-white hover:!bg-[#163B26]"
                              : "border-[var(--cs-border)] text-[var(--cs-text-secondary)]"
                          )}
                        >
                          {canFix ? "Review & Fix" : "Inspect"}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="border-t border-[var(--cs-border-soft)] bg-[#FAF8F5] px-4 py-2.5 text-center">
              <button
                type="button"
                onClick={onOpenAllReview}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1F4E33] transition hover:underline"
              >
                View All {reviewItems.length} Items
                <ArrowRight className="size-3.5" />
              </button>
            </div>
          </section>

          {activeServiceContexts.length > 0 ? (
            <section
              className="rounded-2xl border border-amber-200 bg-amber-50/90 p-4"
              aria-labelledby="service-context-heading"
            >
              <h2
                id="service-context-heading"
                className="text-xs font-bold uppercase tracking-wide text-amber-950"
              >
                Active service context ({activeServiceContexts.length})
              </h2>
              <p className="mt-1 text-xs text-amber-800">
                Visible for review; does not hard-block a valid QR clock-out.
              </p>
              <div className="mt-2.5 divide-y divide-amber-200/80">
                {activeServiceContexts.slice(0, 4).map((session) => (
                  <div
                    key={session.id}
                    className="flex items-center justify-between gap-3 py-1.5 text-xs"
                  >
                    <div className="truncate">
                      <span className="font-semibold text-amber-950">{session.staff_name}</span>
                      <span className="text-amber-800"> · {session.service_name}</span>
                    </div>
                    <span className="shrink-0 text-amber-800">{session.customer_name}</span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </div>

      {/* Expandable Full Roster Lookup & Scan Feed */}
      <div ref={rosterRef} className="grid gap-4">
        <div className="flex items-center justify-between rounded-2xl border border-[var(--cs-border-soft)] bg-white px-5 py-3 shadow-2xs">
          <div>
            <h2 className="text-sm font-bold text-[var(--cs-text)]">
              Full Staff Roster & Scan Lookup ({rows.length})
            </h2>
            <p className="text-xs text-[var(--cs-text-muted)]">
              Search scheduled, not-clocked-in, checked-out, and unscheduled staff members.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setRosterExpanded((v) => !v)}
            className="h-8 rounded-lg border-[var(--cs-border)] text-xs font-semibold"
          >
            {rosterExpanded ? (
              <>
                <ChevronUp className="mr-1.5 size-3.5" />
                Collapse
              </>
            ) : (
              <>
                <ChevronDown className="mr-1.5 size-3.5" />
                Show All Staff
              </>
            )}
          </Button>
        </div>

        {rosterExpanded ? (
          <>
            <AttendanceStaffTable
              rows={rows}
              onOpen={onOpen}
              onOpenHistory={onOpenHistory}
              onOpenPhone={onOpenPhone}
            />
            <AttendanceRecentActivity data={data} onViewHistory={() => onOpenHistory()} />
          </>
        ) : null}
      </div>
    </div>
  );
}
