"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Clock3,
  Download,
  FileText,
  Filter,
  MoreVertical,
  RefreshCw,
  UserRound,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  EmptyState,
  StaffAvatar,
  StatusPill,
  ToolbarSearch,
  ToolbarSelect,
  ToolbarShell,
  formatAttendanceDate,
  formatAttendanceDateTime,
  formatMinutesCompact,
  humanizeAttendanceValue,
} from "@/components/features/attendance/attendance-ui";
import type {
  AttendanceRecord,
  AttendanceRecordFilters,
  AttendanceTab,
  AttendanceWorkspaceData,
} from "@/lib/attendance/types";

type RecordStatusFilter =
  | "all"
  | "needs_review"
  | "late"
  | "early_leave"
  | "overtime"
  | "checked_in"
  | "present";

const STATUS_FILTERS: Array<{ value: RecordStatusFilter; label: string }> = [
  { value: "all", label: "All Statuses" },
  { value: "needs_review", label: "Needs Review" },
  { value: "late", label: "Late" },
  { value: "early_leave", label: "Early Leave" },
  { value: "overtime", label: "Overtime" },
  { value: "checked_in", label: "Checked In" },
  { value: "present", label: "Present" },
];

function staffDisplayName(record: AttendanceRecord): string {
  return record.staff_nickname?.trim() || record.staff_name;
}

function shiftLabel(record: AttendanceRecord): string {
  return humanizeAttendanceValue(record.shift_type || "scheduled");
}

function methodLabel(record: AttendanceRecord): string {
  if (record.clock_out_method === "system_auto_close" && record.clock_out_confirmation_required) {
    const timezone =
      typeof record.attendance_policy_snapshot.timezone === "string"
        ? record.attendance_policy_snapshot.timezone
        : "Asia/Manila";
    const clockTime = record.checked_out_at
      ? new Intl.DateTimeFormat("en-US", {
          timeZone: timezone,
          hour: "numeric",
          minute: "2-digit",
        }).format(new Date(record.checked_out_at))
      : "the policy time";
    return `Auto-closed at ${clockTime} · Confirmation required`;
  }
  return record.source_label ?? record.clock_in_method ?? record.clock_out_method ?? "QR / manual";
}

function recordNeedsReview(record: AttendanceRecord): boolean {
  return (
    record.attendance_status === "late" ||
    record.attendance_status === "early_leave" ||
    record.attendance_status === "overtime" ||
    record.exception_state === "open" ||
    record.late_minutes > 0 ||
    record.early_leave_minutes > 0 ||
    record.overtime_minutes > 0
  );
}
function recordMatchesStatus(record: AttendanceRecord, status: RecordStatusFilter): boolean {
  if (status === "all") return true;
  if (status === "needs_review") return recordNeedsReview(record);
  if (status === "checked_in") return record.status === "checked_in";
  if (status === "present") return record.attendance_status === "present";
  return record.attendance_status === status;
}

function statusTone(record: AttendanceRecord): "good" | "warn" | "bad" | "neutral" {
  if (record.exception_state === "open") return "bad";
  if (recordNeedsReview(record)) return "warn";
  if (record.status === "checked_in" || record.attendance_status === "present") return "good";
  return "neutral";
}

function compactDateRange(dates: string[]): string {
  if (dates.length === 0) return "All dates";
  if (dates.length === 1) return formatAttendanceDate(dates[0] ?? "");
  return `${formatAttendanceDate(dates[dates.length - 1] ?? "")} – ${formatAttendanceDate(
    dates[0] ?? ""
  )}`;
}

function selectedDateLabel(value: string, dateOptions: string[]): string {
  if (value === "all") return compactDateRange(dateOptions);
  return formatAttendanceDate(value);
}

function RecordCard({
  record,
  selected,
  highlighted,
  onSelect,
}: {
  record: AttendanceRecord;
  selected: boolean;
  highlighted: boolean;
  onSelect: () => void;
}) {
  const displayName = staffDisplayName(record);
  const hasLate = record.late_minutes > 0;
  const hasOvertime = record.overtime_minutes > 0;
  const hasEarlyLeave = record.early_leave_minutes > 0;
  const issueCount = [
    hasLate,
    hasOvertime,
    hasEarlyLeave,
    record.exception_state === "open",
  ].filter(Boolean).length;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-2xl border px-4 py-3 text-left transition hover:border-emerald-800 hover:shadow-sm ${
        selected
          ? "border-emerald-800 bg-emerald-50/70 shadow-sm"
          : highlighted
            ? "border-amber-300 bg-amber-50/50"
            : "border-border bg-white"
      }`}
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <StaffAvatar name={displayName} />

          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-foreground" title={displayName}>
              {displayName}
            </div>
            <div className="truncate text-xs capitalize text-muted-foreground">
              {humanizeAttendanceValue(record.staff_type ?? "staff")}
            </div>
          </div>
        </div>

        <StatusPill value={record.attendance_status} tone={statusTone(record)} />
      </div>

      <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
        <div className="min-w-0 rounded-xl bg-stone-50 px-3 py-2">
          <div className="font-bold text-foreground">{shiftLabel(record)}</div>
          <div className="mt-0.5 truncate text-muted-foreground">
            {formatAttendanceDate(record.shift_date)}
          </div>
        </div>

        <div className="min-w-0 rounded-xl bg-stone-50 px-3 py-2">
          <div className="font-bold text-foreground">
            {formatAttendanceDateTime(record.checked_in_at)}
            <span className="mx-1 text-muted-foreground">–</span>
            {formatAttendanceDateTime(record.checked_out_at)}
          </div>
          <div className="mt-0.5 text-muted-foreground">Clock in / out</div>
        </div>

        <div className="min-w-0 rounded-xl bg-stone-50 px-3 py-2">
          <div className="font-bold text-foreground">
            {formatMinutesCompact(record.worked_minutes)}
          </div>
          <div className="mt-0.5 text-muted-foreground">Worked</div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap gap-1.5">
          {hasLate ? (
            <span className="rounded-full border border-red-100 bg-red-50 px-2 py-0.5 text-[0.68rem] font-bold text-red-700">
              {formatMinutesCompact(record.late_minutes)} late
            </span>
          ) : null}

          {hasOvertime ? (
            <span className="rounded-full border border-orange-100 bg-orange-50 px-2 py-0.5 text-[0.68rem] font-bold text-orange-700">
              {formatMinutesCompact(record.overtime_minutes)} overtime
            </span>
          ) : null}

          {hasEarlyLeave ? (
            <span className="rounded-full border border-amber-100 bg-amber-50 px-2 py-0.5 text-[0.68rem] font-bold text-amber-700">
              {formatMinutesCompact(record.early_leave_minutes)} early leave
            </span>
          ) : null}

          {issueCount === 0 ? (
            <span className="rounded-full border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-[0.68rem] font-bold text-emerald-700">
              No timing issue
            </span>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2 text-xs font-semibold text-muted-foreground">
          <span className="hidden sm:inline">{methodLabel(record)}</span>
          <ArrowRight className="size-4" />
        </div>
      </div>
    </button>
  );
}

function DetailTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "warn" | "bad" | "neutral";
}) {
  return (
    <div className="rounded-2xl border border-border bg-white p-4">
      <div className="text-[0.68rem] font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div
        className={`mt-2 text-sm font-bold ${
          tone === "good"
            ? "text-emerald-800"
            : tone === "warn"
              ? "text-amber-800"
              : tone === "bad"
                ? "text-red-700"
                : "text-foreground"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
function AttendanceTimeline({ record }: { record: AttendanceRecord }) {
  return (
    <div className="rounded-2xl border border-border bg-white p-4">
      <h3 className="text-sm font-bold text-foreground">Attendance Timeline</h3>

      <div className="mt-5 grid grid-cols-3 items-start gap-3">
        <div className="text-center">
          <div className="mx-auto flex size-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100">
            <CalendarDays className="size-4" />
          </div>
          <div className="mt-2 text-xs font-semibold text-muted-foreground">Scheduled Start</div>
          <div className="mt-1 text-sm font-bold">
            {formatAttendanceDateTime(record.scheduled_start_at)}
          </div>
        </div>

        <div className="relative text-center">
          <span className="absolute left-[-50%] top-4 h-px w-full border-t border-dashed border-border" />
          <span className="absolute right-[-50%] top-4 h-px w-full border-t border-dashed border-border" />
          <div className="relative z-10 mx-auto flex size-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100">
            <Clock3 className="size-4" />
          </div>
          <div className="mt-2 text-xs font-semibold text-muted-foreground">Clock In</div>
          <div className="mt-1 text-sm font-bold">
            {formatAttendanceDateTime(record.checked_in_at)}
          </div>
          {record.late_minutes > 0 ? (
            <div className="mt-1 text-xs font-bold text-amber-700">
              +{formatMinutesCompact(record.late_minutes)} late
            </div>
          ) : null}
        </div>

        <div className="text-center">
          <div className="mx-auto flex size-8 items-center justify-center rounded-full bg-stone-100 text-muted-foreground ring-1 ring-border">
            <Clock3 className="size-4" />
          </div>
          <div className="mt-2 text-xs font-semibold text-muted-foreground">Clock Out</div>
          <div className="mt-1 text-sm font-bold">
            {formatAttendanceDateTime(record.checked_out_at)}
          </div>
        </div>
      </div>
    </div>
  );
}

function SelectedRecordPanel({
  record,
  onOpenRecovery,
}: {
  record: AttendanceRecord | null;
  onOpenRecovery?: () => void;
}) {
  if (!record) {
    return (
      <aside className="rounded-2xl border border-dashed border-border bg-white p-8 text-center">
        <FileText className="mx-auto mb-3 size-8 text-muted-foreground" />
        <h2 className="font-bold text-foreground">Select a record</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose a staff attendance record to view timing details and correction actions.
        </p>
      </aside>
    );
  }

  const displayName = staffDisplayName(record);

  return (
    <aside className="sticky top-4 grid gap-4 rounded-2xl border border-border bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-bold text-foreground">Selected Record</h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-stone-100"
            aria-label="Record options"
          >
            <MoreVertical className="size-4" />
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-white">
        <div className="flex items-center justify-between gap-4 border-b border-border p-4">
          <div className="flex min-w-0 items-center gap-4">
            <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-lg font-bold text-emerald-900">
              {displayName
                .split(" ")
                .filter(Boolean)
                .slice(0, 2)
                .map((part) => part[0])
                .join("")
                .toUpperCase()}
            </span>
            <div className="min-w-0">
              <div className="truncate text-lg font-bold text-foreground" title={displayName}>
                {displayName}
              </div>
              <div className="mt-0.5 text-sm capitalize text-muted-foreground">
                {humanizeAttendanceValue(record.staff_type ?? "staff")}
              </div>
            </div>
          </div>

          <StatusPill value={record.attendance_status} tone={statusTone(record)} />
        </div>

        <div className="grid border-b border-border md:grid-cols-3">
          <div className="border-b border-border p-4 md:border-b-0 md:border-r">
            <div className="text-[0.68rem] font-bold uppercase tracking-wide text-muted-foreground">
              Shift Type
            </div>
            <div className="mt-2 text-sm font-bold">{shiftLabel(record)}</div>
          </div>
          <div className="border-b border-border p-4 md:border-b-0 md:border-r">
            <div className="text-[0.68rem] font-bold uppercase tracking-wide text-muted-foreground">
              Date
            </div>
            <div className="mt-2 text-sm font-bold">{formatAttendanceDate(record.shift_date)}</div>
          </div>
          <div className="p-4">
            <div className="text-[0.68rem] font-bold uppercase tracking-wide text-muted-foreground">
              Method
            </div>
            <div className="mt-2 text-sm font-bold">{methodLabel(record)}</div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <DetailTile label="Clock In" value={formatAttendanceDateTime(record.checked_in_at)} />
        <DetailTile label="Clock Out" value={formatAttendanceDateTime(record.checked_out_at)} />
        <DetailTile label="Worked" value={formatMinutesCompact(record.worked_minutes)} />
        <DetailTile
          label="Late"
          value={formatMinutesCompact(record.late_minutes)}
          tone={record.late_minutes > 0 ? "warn" : "neutral"}
        />
        <DetailTile
          label="Early Leave"
          value={formatMinutesCompact(record.early_leave_minutes)}
          tone={record.early_leave_minutes > 0 ? "warn" : "neutral"}
        />
        <DetailTile
          label="Overtime"
          value={formatMinutesCompact(record.overtime_minutes)}
          tone={record.overtime_minutes > 0 ? "warn" : "neutral"}
        />
      </div>

      <AttendanceTimeline record={record} />

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-start gap-3">
          <FileText className="mt-0.5 size-4 shrink-0 text-amber-800" />
          <div>
            <div className="text-sm font-bold text-foreground">Record Notes</div>
            <p className="mt-1 text-sm text-amber-900">
              {recordNeedsReview(record)
                ? "Auto-flagged for review because this record contains late time, overtime, early leave, or an open exception."
                : "No major attendance issue detected for this record."}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-3">
        <Link
          href={`/crm/staff?tab=management&staffId=${encodeURIComponent(record.staff_id)}`}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-emerald-800 bg-white px-4 text-sm font-bold text-emerald-900 hover:bg-emerald-50"
        >
          <UserRound className="size-4" />
          View Staff
        </Link>

        <button
          type="button"
          onClick={onOpenRecovery}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-white px-4 text-sm font-bold text-foreground hover:border-emerald-800 hover:text-emerald-900"
        >
          <Wrench className="size-4" />
          Fix / Review
        </button>

        <button
          type="button"
          onClick={onOpenRecovery}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-900 px-4 text-sm font-bold text-white hover:bg-emerald-950"
        >
          <RefreshCw className="size-4" />
          Recovery
        </button>
      </div>

      <div className="text-xs text-muted-foreground">
        Created by system · Record ID: {record.id.slice(0, 8)}
      </div>
    </aside>
  );
}

export function AttendanceRecordsTab({
  data,
  initialFilters,
  onTabChange,
}: {
  data: AttendanceWorkspaceData;
  initialFilters?: AttendanceRecordFilters;
  onTabChange?: (tab: AttendanceTab) => void;
}) {
  const initialStaffId = initialFilters?.staffId ?? null;
  const initialDate = initialFilters?.date ?? null;

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<RecordStatusFilter>("all");
  const [staffId, setStaffId] = useState(initialStaffId ?? "all");
  const [selectedDate, setSelectedDate] = useState(initialDate ?? "all");
  const [method, setMethod] = useState("all");
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const pageSize = 10;

  const dateOptions = useMemo(() => {
    const dates = new Set(data.records.map((record) => record.shift_date));
    if (initialDate) dates.add(initialDate);
    return Array.from(dates).sort((a, b) => b.localeCompare(a));
  }, [data.records, initialDate]);

  const methodOptions = useMemo(() => {
    return Array.from(
      new Set(data.records.map((record) => methodLabel(record)).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));
  }, [data.records]);

  const highlightedRecordId = useMemo(() => {
    if (!initialStaffId) return null;

    return (
      data.records.find(
        (record) =>
          record.staff_id === initialStaffId && (!initialDate || record.shift_date === initialDate)
      )?.id ?? null
    );
  }, [data.records, initialDate, initialStaffId]);

  const rows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return data.records.filter((record) => {
      const searchableText = [
        record.staff_name,
        record.staff_nickname ?? "",
        record.staff_type ?? "",
        record.shift_type,
        record.attendance_status,
        methodLabel(record),
      ]
        .join(" ")
        .toLowerCase();

      const matchesQuery = !normalizedQuery || searchableText.includes(normalizedQuery);
      const matchesStatus = recordMatchesStatus(record, status);
      const matchesStaff = staffId === "all" || record.staff_id === staffId;
      const matchesDate = selectedDate === "all" || record.shift_date === selectedDate;
      const matchesMethod = method === "all" || methodLabel(record) === method;

      return matchesQuery && matchesStatus && matchesStaff && matchesDate && matchesMethod;
    });
  }, [data.records, method, query, selectedDate, staffId, status]);

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const pageStart = currentPage * pageSize;
  const pageRows = rows.slice(pageStart, pageStart + pageSize);
  const selectedRecord =
    pageRows.find((record) => record.id === selectedRecordId) ??
    pageRows.find((record) => record.id === highlightedRecordId) ??
    pageRows[0] ??
    null;

  function resetPage() {
    setPage(0);
  }

  return (
    <div className="grid gap-4">
      <ToolbarShell
        fieldsClassName="xl:grid-cols-[1fr_1fr_1fr_1fr_1.2fr]"
        actions={
          <Button type="button" variant="outline" className="h-10 rounded-lg">
            <Download className="mr-2 size-4" />
            Export
          </Button>
        }
      >
        <ToolbarSelect
          label="Date"
          value={selectedDate}
          onChange={(value) => {
            setSelectedDate(value);
            resetPage();
          }}
        >
          <option value="all">{selectedDateLabel("all", dateOptions)}</option>
          {dateOptions.map((date) => (
            <option key={date} value={date}>
              {formatAttendanceDate(date)}
            </option>
          ))}
        </ToolbarSelect>

        <ToolbarSelect
          label="Staff"
          value={staffId}
          onChange={(value) => {
            setStaffId(value);
            resetPage();
          }}
        >
          <option value="all">All Staff</option>
          {data.staffOptions.map((staff) => (
            <option key={staff.id} value={staff.id}>
              {staff.full_name}
            </option>
          ))}
        </ToolbarSelect>

        <ToolbarSelect
          label="Status"
          value={status}
          onChange={(value) => {
            setStatus(value as RecordStatusFilter);
            resetPage();
          }}
        >
          {STATUS_FILTERS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </ToolbarSelect>

        <ToolbarSelect
          label="Method"
          value={method}
          onChange={(value) => {
            setMethod(value);
            resetPage();
          }}
        >
          <option value="all">All Methods</option>
          {methodOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </ToolbarSelect>

        <ToolbarSearch
          label="Search"
          value={query}
          onChange={(value) => {
            setQuery(value);
            resetPage();
          }}
          placeholder="Search staff or record..."
        />
      </ToolbarShell>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(420px,0.95fr)]">
        <section className="overflow-hidden rounded-2xl border border-border bg-white p-4 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-foreground">Records ({rows.length})</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Attendance history, timing issues, and correction review.
              </p>
            </div>

            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-stone-50 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
              <Filter className="size-3.5" />
              Sort by: Newest
            </div>
          </div>

          {rows.length === 0 ? (
            data.records.length === 0 &&
            data.scanEvents.some(
              (event) =>
                event.scan_type === "attendance" &&
                event.outcome === "success" &&
                (event.action === "clock_in" || event.action === "clock_out")
            ) ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <div className="font-semibold">
                  Attendance scans were found, but no staff time records were loaded.
                </div>
                <div className="mt-1">
                  This usually means the scan event was saved but the staff_shift_checkins record
                  was not created, or the records query is failing.
                </div>
              </div>
            ) : (
              <EmptyState
                title="No attendance records found."
                detail="Try a different date, status, staff, method, or search."
              />
            )
          ) : (
            <div className="grid max-h-[760px] gap-2 overflow-y-auto overflow-x-hidden pr-1">
              {pageRows.map((record) => (
                <RecordCard
                  key={record.id}
                  record={record}
                  selected={selectedRecord?.id === record.id}
                  highlighted={highlightedRecordId === record.id}
                  onSelect={() => setSelectedRecordId(record.id)}
                />
              ))}
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3 text-xs text-muted-foreground">
            <span>
              Showing {rows.length === 0 ? 0 : pageStart + 1}–{Math.min(pageStart + pageRows.length, rows.length)} of {rows.length} records
            </span>

            {pageCount > 1 ? (
              <div className="flex items-center gap-2" aria-label="Attendance records pages">
                {Array.from({ length: pageCount }, (_, index) => (
                  <button
                    key={index}
                    type="button"
                    aria-label={`Show records page ${index + 1}`}
                    aria-current={index === currentPage ? "page" : undefined}
                    onClick={() => setPage(index)}
                    className={`inline-flex size-8 items-center justify-center rounded-lg border border-border bg-white font-bold ${
                      index === currentPage ? "text-emerald-900" : "text-muted-foreground"
                    }`}
                  >
                    {index + 1}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </section>

        <SelectedRecordPanel
          record={selectedRecord}
          onOpenRecovery={onTabChange ? () => onTabChange("exceptions") : undefined}
        />
      </div>
    </div>
  );
}
