"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { AttendanceCreditDetails } from "@/components/features/attendance/shared/attendance-credit-details";
import { attendanceClockOutLabel } from "@/lib/attendance/v2-policy";
import {
  AlertTriangle,
  ArrowUpDown,
  Calendar,
  CheckCircle2,
  Clock3,
  Download,
  Eye,
  Filter,
  History as HistoryIcon,
  MoreHorizontal,
  RefreshCw,
  Search,
  Users,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { loadAttendanceHistoryAction } from "@/app/(dashboard)/crm/attendance/actions";
import {
  AttendanceCorrectionModal,
  type AttendanceCorrectionModalTarget,
} from "@/components/features/attendance/attendance-correction-modal";
import {
  StaffAvatar,
  formatAttendanceDateTime,
} from "@/components/features/attendance/attendance-ui";
import { AttendancePagination } from "@/components/features/attendance/shared/attendance-pagination";
import { CrmStatCard } from "@/components/features/crm/shared/crm-cards";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  formatAttendanceRole,
  formatShortClock,
  formatShortShiftDate,
  formatWorkedDuration,
} from "@/lib/attendance/crm-attendance-presenter";
import type { AttendanceHistoryData } from "@/lib/attendance/queries";
import type {
  AttendanceCorrection,
  AttendanceRecord,
  AttendanceWorkspaceData,
} from "@/lib/attendance/types";
import { addDaysToYmd } from "@/lib/engine/slot-time";
import { cn } from "@/lib/utils";

type HistoryStatusFilter = "all" | "present" | "late" | "incomplete" | "corrected";
type HistorySortOrder = "date_desc" | "date_asc" | "staff_asc" | "hours_desc";

function csvCell(value: unknown): string {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function getRecordDisplayStatus(
  row: AttendanceRecord,
  hasCorrection: boolean
): { key: Exclude<HistoryStatusFilter, "all">; label: string; badgeClass: string } {
  if (
    !row.checked_out_at ||
    row.attendance_status === "incomplete" ||
    row.status === "checked_in"
  ) {
    return {
      key: "incomplete",
      label: "Incomplete",
      badgeClass: "border-rose-200 bg-rose-50 text-rose-700",
    };
  }
  if (row.late_minutes > 0 || row.attendance_status === "late") {
    return {
      key: "late",
      label: "Late",
      badgeClass: "border-amber-200 bg-amber-50 text-amber-800",
    };
  }
  if (hasCorrection && row.attendance_status === "corrected") {
    return {
      key: "corrected",
      label: "Corrected",
      badgeClass: "border-emerald-200 bg-[#EEF8F2] text-[#1F4E33]",
    };
  }
  return {
    key: "present",
    label: row.attendance_status
      ? row.attendance_status.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())
      : "Present",
    badgeClass: "border-emerald-200 bg-[#EEF8F2] text-[#1F4E33]",
  };
}

function exportFilteredCsv(
  records: AttendanceRecord[],
  correctionsByCheckin: Map<string, AttendanceCorrection[]>,
  fromDate: string,
  toDate: string,
  timezone: string
) {
  const rows = [
    ["Date", "Staff", "Role", "Clock In", "Clock Out", "Worked Minutes", "Status", "Audit Note"],
    ...records.map((row) => {
      const corrs = correctionsByCheckin.get(row.id) ?? [];
      const latestCorr = corrs[0];
      return [
        row.shift_date,
        row.staff_name,
        formatAttendanceRole(row.staff_type),
        formatShortClock(row.checked_in_at, timezone),
        row.checked_out_at
          ? attendanceClockOutLabel(row, (value) => formatShortClock(value, timezone))
          : "Open",
        row.worked_minutes,
        getRecordDisplayStatus(row, corrs.length > 0).label,
        latestCorr
          ? `${latestCorr.action_type.replaceAll("_", " ")} (${latestCorr.corrected_by_name ?? "CRM"}): ${latestCorr.reason}`
          : "",
      ];
    }),
  ];
  const blob = new Blob([rows.map((row) => row.map(csvCell).join(",")).join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `attendance-${fromDate}-${toDate}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function AttendanceHistoryView({
  workspace,
  onRefresh,
}: {
  workspace: AttendanceWorkspaceData;
  onRefresh: () => void;
}) {
  const [fromDate, setFromDate] = useState(addDaysToYmd(workspace.businessDate, -13));
  const [toDate, setToDate] = useState(workspace.businessDate);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showMoreFilters, setShowMoreFilters] = useState(false);

  const [mode, setMode] = useState<"records" | "changes">("records");
  const [statusFilter, setStatusFilter] = useState<HistoryStatusFilter>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<HistorySortOrder>("date_desc");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [data, setData] = useState<AttendanceHistoryData | null>(null);
  const [inspectRecord, setInspectRecord] = useState<AttendanceRecord | null>(null);
  const [modalTarget, setModalTarget] = useState<AttendanceCorrectionModalTarget | null>(null);
  const [pending, startTransition] = useTransition();

  const load = useCallback(
    (range?: { from: string; to: string }) => {
      const targetFrom = range?.from ?? fromDate;
      const targetTo = range?.to ?? toDate;
      startTransition(async () => {
        const result = await loadAttendanceHistoryAction({
          fromDate: targetFrom,
          toDate: targetTo,
        });
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        setData(result.data);
        setPage(1);
      });
    },
    [fromDate, toDate]
  );

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const correctionsByCheckin = useMemo(() => {
    const map = new Map<string, AttendanceCorrection[]>();
    for (const corr of data?.corrections ?? []) {
      if (!corr.checkin_id) continue;
      const existing = map.get(corr.checkin_id) ?? [];
      existing.push(corr);
      map.set(corr.checkin_id, existing);
    }
    return map;
  }, [data?.corrections]);

  const roleOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of data?.records ?? []) {
      if (r.staff_type) set.add(r.staff_type);
    }
    return Array.from(set).sort((a, b) =>
      formatAttendanceRole(a).localeCompare(formatAttendanceRole(b))
    );
  }, [data?.records]);

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();
    const list = (data?.records ?? []).filter((row) => {
      const hasCorrection = (correctionsByCheckin.get(row.id)?.length ?? 0) > 0;
      const disp = getRecordDisplayStatus(row, hasCorrection);

      if (statusFilter === "corrected" && !hasCorrection && row.attendance_status !== "corrected") {
        return false;
      } else if (
        statusFilter !== "all" &&
        statusFilter !== "corrected" &&
        disp.key !== statusFilter
      ) {
        return false;
      }

      if (roleFilter !== "all" && (row.staff_type ?? "") !== roleFilter) return false;

      if (query) {
        const hay =
          `${row.staff_name} ${row.shift_date} ${disp.label} ${row.staff_type ?? ""}`.toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    });

    return [...list].sort((a, b) => {
      if (sortOrder === "date_asc") {
        return a.checked_in_at.localeCompare(b.checked_in_at);
      }
      if (sortOrder === "staff_asc") {
        return a.staff_name.localeCompare(b.staff_name);
      }
      if (sortOrder === "hours_desc") {
        return b.worked_minutes - a.worked_minutes;
      }
      return b.checked_in_at.localeCompare(a.checked_in_at);
    });
  }, [correctionsByCheckin, data?.records, roleFilter, search, sortOrder, statusFilter]);

  const filteredCorrections = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (data?.corrections ?? []).filter(
      (c) =>
        !query ||
        `${c.staff_name ?? ""} ${c.action_type} ${c.reason} ${c.corrected_by_name ?? ""}`
          .toLowerCase()
          .includes(query)
    );
  }, [data?.corrections, search]);

  const summaryStats = useMemo(() => {
    const total = filteredRecords.length;
    const completed = filteredRecords.filter((r) => Boolean(r.checked_out_at)).length;
    const totalMinutes = filteredRecords.reduce((acc, r) => acc + Math.max(0, r.worked_minutes), 0);
    const withCorrections = filteredRecords.filter(
      (r) => (correctionsByCheckin.get(r.id)?.length ?? 0) > 0
    ).length;
    return {
      total,
      completed,
      completionPct: total > 0 ? Math.round((completed / total) * 1000) / 10 : 0,
      totalMinutes,
      withCorrections,
      correctionPct: total > 0 ? Math.round((withCorrections / total) * 1000) / 10 : 0,
    };
  }, [correctionsByCheckin, filteredRecords]);

  const activeItemsCount = mode === "records" ? filteredRecords.length : filteredCorrections.length;
  const totalPages = Math.max(1, Math.ceil(activeItemsCount / pageSize));
  const safePage = Math.min(page, totalPages);

  const pagedRecords = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, pageSize, safePage]);

  const pagedCorrections = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredCorrections.slice(start, start + pageSize);
  }, [filteredCorrections, pageSize, safePage]);

  const formattedPeriod = `${formatShortShiftDate(fromDate).replace(/, \d{4}$/, "")} – ${formatShortShiftDate(toDate)}`;

  function applyQuickPreset(daysBack: number) {
    const nextFrom = addDaysToYmd(workspace.businessDate, -daysBack);
    const nextTo = workspace.businessDate;
    setFromDate(nextFrom);
    setToDate(nextTo);
    setShowDatePicker(false);
    load({ from: nextFrom, to: nextTo });
  }

  return (
    <>
      <div className="grid gap-4">
        {/* Header + 4 Period Summary Cards + Filter Bar */}
        <section className="rounded-2xl border border-[var(--cs-border-soft)] bg-white p-4 shadow-2xs sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#EEF7F1] text-[#1F4E33]">
                <HistoryIcon className="size-5" />
              </span>
              <div>
                <h2 className="text-base font-bold text-[var(--cs-text)] sm:text-lg">
                  Attendance History
                </h2>
                <p className="mt-0.5 text-xs text-[var(--cs-text-muted)]">
                  Search, filter, and review staff attendance records with audit details.
                </p>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!data || filteredRecords.length === 0}
              onClick={() =>
                data &&
                exportFilteredCsv(
                  filteredRecords,
                  correctionsByCheckin,
                  data.fromDate,
                  data.toDate,
                  workspace.timezone
                )
              }
              className="h-9 rounded-lg border-[var(--cs-border)] bg-white px-3.5 text-xs font-semibold text-[var(--cs-text)] hover:bg-[#FAF8F5]"
            >
              <Download className="mr-1.5 size-3.5" />
              Export CSV
            </Button>
          </div>

          {/* 4 Summary Cards matching Canonical Card Standard */}
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <CrmStatCard
              title="Attendance Records"
              value={summaryStats.total}
              subtitle={formattedPeriod}
              icon={<Users className="size-4.5" aria-hidden="true" />}
              tone="neutral"
            />
            <CrmStatCard
              title="Completed Shifts"
              value={summaryStats.completed}
              subtitle={`${summaryStats.completionPct}% completion rate`}
              icon={<CheckCircle2 className="size-4.5" aria-hidden="true" />}
              tone="success"
            />
            <CrmStatCard
              title="Total Worked Hours"
              value={formatWorkedDuration(summaryStats.totalMinutes, "0m")}
              subtitle={`Filtered period (${filteredRecords.length} shifts)`}
              icon={<Clock3 className="size-4.5" aria-hidden="true" />}
              tone="info"
            />
            <CrmStatCard
              title="With Corrections"
              value={summaryStats.withCorrections}
              subtitle={`${summaryStats.correctionPct}% of records`}
              icon={<AlertTriangle className="size-4.5" aria-hidden="true" />}
              tone="warning"
            />
          </div>

          {/* Filter Strip: Date Range, Search, Status Pills, More Filters */}
          <div className="mt-4 flex flex-wrap items-center gap-2.5 border-t border-[var(--cs-border-soft)] pt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowDatePicker((v) => !v)}
              className="h-9 rounded-lg border-[var(--cs-border)] bg-white px-3 text-xs font-semibold text-[var(--cs-text)]"
            >
              <Calendar className="mr-1.5 size-3.5 text-[var(--cs-text-muted)]" />
              {formatShortShiftDate(fromDate)} – {formatShortShiftDate(toDate)}
            </Button>

            <label className="relative min-w-[200px] flex-1">
              <span className="sr-only">Search staff by name</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--cs-text-muted)]" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search staff by name..."
                className="h-9 rounded-lg border-[var(--cs-border)] bg-white pl-9 text-xs"
              />
            </label>

            <div
              className="flex flex-wrap items-center gap-1"
              role="group"
              aria-label="Status filters"
            >
              {(
                [
                  { key: "all", label: "All" },
                  { key: "present", label: "Present" },
                  { key: "late", label: "Late" },
                  { key: "incomplete", label: "Incomplete" },
                  { key: "corrected", label: "Corrected" },
                ] as const
              ).map((item) => {
                const active = statusFilter === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      setStatusFilter(item.key);
                      setPage(1);
                    }}
                    className={cn(
                      "h-8 rounded-lg border px-2.5 text-xs font-bold transition",
                      active
                        ? "border-[#1F4E33] bg-[#1F4E33] text-white"
                        : "border-[var(--cs-border)] bg-white text-[var(--cs-text-secondary)] hover:border-[#1F4E33]/50"
                    )}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowMoreFilters((v) => !v)}
              className={cn(
                "h-9 rounded-lg border-[var(--cs-border)] px-3 text-xs font-semibold",
                showMoreFilters ? "bg-[#FAF8F5] text-[#1F4E33]" : "bg-white text-[var(--cs-text)]"
              )}
            >
              <Filter className="mr-1.5 size-3.5" />
              More filters
            </Button>
          </div>

          {/* Expandable Custom Date Range Bar */}
          {showDatePicker ? (
            <div className="mt-3 flex flex-wrap items-end gap-2.5 rounded-xl border border-[var(--cs-border-soft)] bg-[#FAF8F5] p-3">
              <div className="grid gap-1">
                <label
                  htmlFor="history-from"
                  className="text-[0.68rem] font-bold text-[var(--cs-text-muted)]"
                >
                  From
                </label>
                <Input
                  id="history-from"
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="h-8 bg-white text-xs"
                />
              </div>
              <div className="grid gap-1">
                <label
                  htmlFor="history-to"
                  className="text-[0.68rem] font-bold text-[var(--cs-text-muted)]"
                >
                  To
                </label>
                <Input
                  id="history-to"
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="h-8 bg-white text-xs"
                />
              </div>
              <Button
                type="button"
                size="sm"
                disabled={pending}
                onClick={() => {
                  setShowDatePicker(false);
                  load();
                }}
                className="h-8 rounded-lg bg-[#1F4E33] px-3 text-xs font-semibold text-white"
              >
                {pending ? "Loading…" : "Apply Range"}
              </Button>
              <div className="ml-auto flex flex-wrap gap-1.5">
                {[
                  { label: "Today", days: 0 },
                  { label: "7 Days", days: 6 },
                  { label: "14 Days", days: 13 },
                  { label: "30 Days", days: 29 },
                ].map((preset) => (
                  <Button
                    key={preset.label}
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => applyQuickPreset(preset.days)}
                    className="h-8 rounded-lg bg-white text-xs"
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}

          {/* Expandable Secondary Filters (Role + Audit Log toggle) */}
          {showMoreFilters ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--cs-border-soft)] bg-[#FAF8F5] p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-[var(--cs-text-secondary)]">Role:</span>
                <select
                  aria-label="Filter history by role"
                  value={roleFilter}
                  onChange={(e) => {
                    setRoleFilter(e.target.value);
                    setPage(1);
                  }}
                  className="h-8 rounded-lg border border-[var(--cs-border)] bg-white px-2.5 text-xs font-semibold"
                >
                  <option value="all">All roles</option>
                  {roleOptions.map((role) => (
                    <option key={role} value={role}>
                      {formatAttendanceRole(role)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="inline-flex rounded-lg border border-[var(--cs-border)] bg-white p-0.5">
                {(["records", "changes"] as const).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => {
                      setMode(item);
                      setPage(1);
                    }}
                    className={cn(
                      "rounded-md px-3 py-1 text-xs font-bold transition",
                      mode === item
                        ? "bg-[#1F4E33] text-white"
                        : "text-[var(--cs-text-muted)] hover:text-[var(--cs-text)]"
                    )}
                  >
                    {item === "records"
                      ? `Attendance Records (${filteredRecords.length})`
                      : `Audit Log (${filteredCorrections.length})`}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        {/* Main Records / Audit Table Card */}
        <section className="overflow-hidden rounded-2xl border border-[var(--cs-border-soft)] bg-white shadow-2xs">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--cs-border-soft)] px-5 py-3.5">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-[var(--cs-text)]">
                {mode === "records"
                  ? `Attendance Records (${filteredRecords.length})`
                  : `Corrections & Audit Log (${filteredCorrections.length})`}
              </h3>
              {pending ? (
                <RefreshCw className="size-3.5 animate-spin text-[var(--cs-text-muted)]" />
              ) : null}
            </div>

            {mode === "records" ? (
              <div className="flex items-center gap-2">
                <ArrowUpDown className="size-3.5 text-[var(--cs-text-muted)]" />
                <select
                  aria-label="Sort attendance records"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as HistorySortOrder)}
                  className="h-8 rounded-lg border border-[var(--cs-border)] bg-white px-2.5 text-xs font-semibold text-[var(--cs-text)] outline-none focus:border-[#1F4E33]"
                >
                  <option value="date_desc">Sort: Date (Newest)</option>
                  <option value="date_asc">Sort: Date (Oldest)</option>
                  <option value="staff_asc">Sort: Staff Name (A–Z)</option>
                  <option value="hours_desc">Sort: Worked Hours (High–Low)</option>
                </select>
              </div>
            ) : null}
          </div>

          {activeItemsCount === 0 && !pending ? (
            <div className="p-12 text-center text-sm text-[var(--cs-text-muted)]">
              No attendance records match the selected date range and filters.
            </div>
          ) : mode === "records" ? (
            <>
              {/* Desktop 8-Column Table */}
              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="border-b border-[var(--cs-border-soft)] bg-[#FAF8F5] text-[0.68rem] font-bold uppercase tracking-wider text-[var(--cs-text-muted)]">
                    <tr>
                      <th className="px-5 py-3">Staff Member</th>
                      <th className="px-3 py-3">
                        <button
                          type="button"
                          onClick={() =>
                            setSortOrder((s) => (s === "date_desc" ? "date_asc" : "date_desc"))
                          }
                          className="inline-flex items-center gap-1 hover:text-[var(--cs-text)]"
                        >
                          Date
                        </button>
                      </th>
                      <th className="px-3 py-3">Clock In</th>
                      <th className="px-3 py-3">Clock Out</th>
                      <th className="px-3 py-3">Total Hours</th>
                      <th className="px-3 py-3">Status</th>
                      <th className="px-3 py-3">Correction / Audit</th>
                      <th className="px-5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--cs-border-soft)]">
                    {pagedRecords.map((row) => {
                      const corrs = correctionsByCheckin.get(row.id) ?? [];
                      const latestCorr = corrs[0] ?? null;
                      const statusInfo = getRecordDisplayStatus(row, corrs.length > 0);
                      return (
                        <tr key={row.id} className="transition hover:bg-[#FAF8F5]">
                          <td className="px-5 py-3.5 align-middle">
                            <div className="flex items-center gap-2.5">
                              <StaffAvatar
                                name={row.staff_name}
                                className="size-9 bg-[#2D6A45] text-[0.7rem] font-bold text-white"
                              />
                              <div className="min-w-0">
                                <div className="truncate text-xs font-bold text-[var(--cs-text)] sm:text-sm">
                                  {row.staff_name}
                                </div>
                                <div className="truncate text-xs text-[var(--cs-text-muted)]">
                                  {formatAttendanceRole(row.staff_type)}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-3 py-3.5 align-middle text-xs font-semibold text-[var(--cs-text-secondary)]">
                            {formatShortShiftDate(row.shift_date)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3.5 align-middle text-xs font-semibold text-[var(--cs-text)] tabular-nums">
                            {formatShortClock(row.checked_in_at, workspace.timezone)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3.5 align-middle text-xs font-semibold text-[var(--cs-text)] tabular-nums">
                            {row.checked_out_at
                              ? attendanceClockOutLabel(row, (value) =>
                                  formatShortClock(value, workspace.timezone)
                                )
                              : "—"}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3.5 align-middle text-xs font-semibold text-[var(--cs-text)] tabular-nums">
                            {row.checked_out_at
                              ? formatWorkedDuration(row.worked_minutes, "0m")
                              : "—"}
                          </td>
                          <td className="px-3 py-3.5 align-middle">
                            <span
                              className={cn(
                                "inline-flex rounded-md border px-2 py-0.5 text-xs font-bold",
                                statusInfo.badgeClass
                              )}
                            >
                              {statusInfo.label}
                            </span>
                          </td>
                          <td className="max-w-[210px] px-3 py-3.5 align-middle text-xs">
                            {!row.checked_out_at ? (
                              <div className="flex items-start gap-1.5 text-amber-900">
                                <Wrench className="mt-0.5 size-3.5 shrink-0 text-amber-700" />
                                <div>
                                  <div className="font-semibold">Missing clock-out</div>
                                  <div className="text-[0.68rem] text-[var(--cs-text-muted)]">
                                    Open shift
                                  </div>
                                </div>
                              </div>
                            ) : latestCorr ? (
                              <div className="flex items-start gap-1.5">
                                <RefreshCw className="mt-0.5 size-3 shrink-0 text-[#1F4E33]" />
                                <div className="min-w-0">
                                  <div className="truncate font-semibold text-[var(--cs-text)]">
                                    Corrected
                                  </div>
                                  <div className="truncate text-[0.68rem] text-[var(--cs-text-muted)]">
                                    by {latestCorr.corrected_by_name ?? "Front Desk"} ·{" "}
                                    {formatAttendanceDateTime(
                                      latestCorr.corrected_at ?? latestCorr.created_at,
                                      workspace.timezone
                                    )}
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <span className="text-[var(--cs-text-muted)]">—</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 align-middle">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => setInspectRecord(row)}
                                className="h-8 rounded-lg border-[var(--cs-border)] bg-white px-2.5 text-xs font-semibold hover:bg-[#FAF8F5]"
                              >
                                <Eye className="mr-1 size-3.5" />
                                View
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger
                                  render={
                                    <Button
                                      type="button"
                                      size="icon-sm"
                                      variant="ghost"
                                      aria-label={`Actions for ${row.staff_name}`}
                                    />
                                  }
                                >
                                  <MoreHorizontal className="size-4" />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() => setModalTarget({ kind: "record", record: row })}
                                  >
                                    Correct Attendance
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => setInspectRecord(row)}>
                                    View Full Audit Details
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Record Cards */}
              <div className="divide-y divide-[var(--cs-border-soft)] lg:hidden">
                {pagedRecords.map((row) => {
                  const corrs = correctionsByCheckin.get(row.id) ?? [];
                  const statusInfo = getRecordDisplayStatus(row, corrs.length > 0);
                  return (
                    <div key={row.id} className="grid gap-2.5 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <StaffAvatar
                            name={row.staff_name}
                            className="size-9 bg-[#2D6A45] text-xs font-bold text-white"
                          />
                          <div>
                            <div className="text-sm font-bold text-[var(--cs-text)]">
                              {row.staff_name}
                            </div>
                            <div className="text-xs text-[var(--cs-text-muted)]">
                              {formatShortShiftDate(row.shift_date)} ·{" "}
                              {formatAttendanceRole(row.staff_type)}
                            </div>
                          </div>
                        </div>
                        <span
                          className={cn(
                            "rounded-md border px-2 py-0.5 text-xs font-bold",
                            statusInfo.badgeClass
                          )}
                        >
                          {statusInfo.label}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 rounded-xl bg-[#FAF8F5] p-2.5 text-xs tabular-nums">
                        <div>
                          <div className="text-[0.65rem] text-[var(--cs-text-muted)]">Clock In</div>
                          <div className="font-semibold">
                            {formatShortClock(row.checked_in_at, workspace.timezone)}
                          </div>
                        </div>
                        <div>
                          <div className="text-[0.65rem] text-[var(--cs-text-muted)]">
                            Clock Out
                          </div>
                          <div className="font-semibold">
                            {row.checked_out_at
                              ? attendanceClockOutLabel(row, (value) =>
                                  formatShortClock(value, workspace.timezone)
                                )
                              : "—"}
                          </div>
                        </div>
                        <div>
                          <div className="text-[0.65rem] text-[var(--cs-text-muted)]">Worked</div>
                          <div className="font-semibold">
                            {row.checked_out_at
                              ? formatWorkedDuration(row.worked_minutes, "0m")
                              : "Open"}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setInspectRecord(row)}
                          className="h-8 flex-1 rounded-lg text-xs font-semibold"
                        >
                          View Details
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => setModalTarget({ kind: "record", record: row })}
                          className="h-8 flex-1 rounded-lg bg-[#1F4E33] text-xs font-semibold text-white"
                        >
                          Correct
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="divide-y divide-[var(--cs-border-soft)]">
              {pagedCorrections.map((item) => (
                <article
                  key={item.id}
                  className="grid gap-2 px-5 py-3.5 text-xs sm:grid-cols-[1.1fr_1fr_1.8fr_auto] sm:items-center"
                >
                  <div>
                    <div className="font-bold text-[var(--cs-text)]">
                      {item.staff_name ?? "System update"}
                    </div>
                    <div className="text-[var(--cs-text-muted)]">
                      {item.attendance_date ? formatShortShiftDate(item.attendance_date) : "—"}
                    </div>
                  </div>
                  <div className="font-semibold capitalize text-[#1F4E33]">
                    {item.action_type.replaceAll("_", " ")}
                  </div>
                  <div className="text-[var(--cs-text-secondary)]">{item.reason}</div>
                  <div className="text-right text-[0.7rem] text-[var(--cs-text-muted)]">
                    {item.corrected_by_name ?? "System"} ·{" "}
                    {formatAttendanceDateTime(
                      item.corrected_at ?? item.created_at,
                      workspace.timezone
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}

          {activeItemsCount > 0 ? (
            <AttendancePagination
              page={safePage}
              pageSize={pageSize}
              totalItems={activeItemsCount}
              itemLabel={mode === "records" ? "records" : "audit entries"}
              onPageChange={setPage}
              onPageSizeChange={(next) => {
                setPageSize(next);
                setPage(1);
              }}
            />
          ) : null}
        </section>
      </div>

      {/* Record Inspection Modal */}
      <Dialog
        open={Boolean(inspectRecord)}
        onOpenChange={(open) => {
          if (!open) setInspectRecord(null);
        }}
      >
        <DialogContent className="max-w-lg rounded-2xl border-[var(--cs-border)] bg-white p-0 overflow-hidden">
          {inspectRecord ? (
            <>
              <DialogHeader className="border-b border-[var(--cs-border-soft)] bg-[#FAF8F5] px-6 py-4 text-left">
                <DialogTitle className="text-base font-bold text-[var(--cs-text)]">
                  {inspectRecord.staff_name}
                </DialogTitle>
                <DialogDescription className="text-xs text-[var(--cs-text-muted)]">
                  {formatShortShiftDate(inspectRecord.shift_date)} ·{" "}
                  {formatAttendanceRole(inspectRecord.staff_type)}
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 p-6">
                <dl className="grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-xl border border-[var(--cs-border-soft)] bg-[#FAF8F5] p-3">
                    <dt className="font-bold text-[var(--cs-text-muted)]">Clock In</dt>
                    <dd className="mt-1 text-sm font-bold text-[var(--cs-text)] tabular-nums">
                      {formatShortClock(inspectRecord.checked_in_at, workspace.timezone)}
                    </dd>
                  </div>
                  <div className="rounded-xl border border-[var(--cs-border-soft)] bg-[#FAF8F5] p-3">
                    <dt className="font-bold text-[var(--cs-text-muted)]">Clock Out</dt>
                    <dd className="mt-1 text-sm font-bold text-[var(--cs-text)] tabular-nums">
                      {inspectRecord.checked_out_at
                        ? attendanceClockOutLabel(inspectRecord, (value) =>
                            formatShortClock(value, workspace.timezone)
                          )
                        : "Open shift"}
                    </dd>
                  </div>
                  <div className="rounded-xl border border-[var(--cs-border-soft)] bg-[#FAF8F5] p-3">
                    <dt className="font-bold text-[var(--cs-text-muted)]">Total Worked</dt>
                    <dd className="mt-1 text-sm font-bold text-[var(--cs-text)] tabular-nums">
                      {inspectRecord.checked_out_at
                        ? formatWorkedDuration(inspectRecord.worked_minutes, "0m")
                        : "In progress"}
                    </dd>
                  </div>
                  <div className="rounded-xl border border-[var(--cs-border-soft)] bg-[#FAF8F5] p-3">
                    <dt className="font-bold text-[var(--cs-text-muted)]">Late / Overtime</dt>
                    <dd className="mt-1 text-sm font-bold text-[var(--cs-text)] tabular-nums">
                      {inspectRecord.late_minutes}m late · {inspectRecord.overtime_minutes}m OT
                    </dd>
                  </div>
                </dl>

                {/* Matched Audit Trail */}
                <AttendanceCreditDetails
                  snapshot={inspectRecord.attendance_policy_snapshot}
                  timezone={workspace.timezone}
                />
                {(correctionsByCheckin.get(inspectRecord.id)?.length ?? 0) > 0 ? (
                  <div className="rounded-xl border border-[var(--cs-border-soft)] p-3.5">
                    <div className="text-xs font-bold text-[var(--cs-text)]">
                      Correction &amp; Audit History
                    </div>
                    <div className="mt-2 divide-y divide-[var(--cs-border-soft)]">
                      {(correctionsByCheckin.get(inspectRecord.id) ?? []).map((corr) => (
                        <div key={corr.id} className="py-2 text-xs first:pt-0 last:pb-0">
                          <div className="font-semibold capitalize text-[#1F4E33]">
                            {corr.action_type.replaceAll("_", " ")} ·{" "}
                            <span className="text-[var(--cs-text-muted)]">
                              by {corr.corrected_by_name ?? "Front Desk"}
                            </span>
                          </div>
                          <p className="mt-0.5 text-[var(--cs-text-secondary)]">{corr.reason}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <DialogFooter className="border-t border-[var(--cs-border-soft)] bg-[#FAF8F5] px-6 py-3.5">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setInspectRecord(null)}
                  className="rounded-lg"
                >
                  Close
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    const rec = inspectRecord;
                    setInspectRecord(null);
                    setModalTarget({ kind: "record", record: rec });
                  }}
                  className="rounded-lg bg-[#1F4E33] text-white hover:bg-[#163B26]"
                >
                  <Wrench className="mr-1.5 size-3.5" />
                  Correct Attendance
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <AttendanceCorrectionModal
        data={workspace}
        target={modalTarget}
        onClose={() => setModalTarget(null)}
        onSaved={() => {
          load();
          onRefresh();
        }}
      />
    </>
  );
}
