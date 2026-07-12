"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Clock3, Search, UserRound } from "lucide-react";
import {
  StaffAvatar,
  StatusPill,
  formatAttendanceDateTime,
  formatMinutesCompact,
  humanizeAttendanceValue,
} from "@/components/features/attendance/attendance-ui";
import type {
  AttendanceRecord,
  AttendanceSession,
  AttendanceWorkspaceData,
} from "@/lib/attendance/types";

type StaffFilter = "all" | "available" | "in_service" | "late" | "not_arrived";

type StaffBoardRow = {
  staff: AttendanceWorkspaceData["staffOptions"][number];
  record: AttendanceRecord | undefined;
  session: AttendanceSession | undefined;
  queuePosition: number | null;
  state: "available" | "in_service" | "clocked_out" | "not_arrived";
  isLate: boolean;
};

const FILTERS: Array<{ key: StaffFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "available", label: "Available" },
  { key: "in_service", label: "In Service" },
  { key: "late", label: "Late" },
  { key: "not_arrived", label: "Not Arrived" },
];

function workedMinutesSince(checkedInAt: string, nowMs: number): number {
  return Math.max(0, Math.round((nowMs - new Date(checkedInAt).getTime()) / 60000));
}

function activeSessionForStaff(
  sessions: AttendanceSession[],
  staffId: string
): AttendanceSession | undefined {
  return sessions.find(
    (session) =>
      session.booking_progress_status === "session_started" && session.staff_id === staffId
  );
}

function attendanceAvailabilityState(
  record: AttendanceRecord | undefined,
  activeService?: AttendanceSession
): StaffBoardRow["state"] {
  if (!record) return "not_arrived";
  if (record.status === "checked_out" || record.checked_out_at) return "clocked_out";
  if (activeService) return "in_service";
  if (record.status === "checked_in") return "available";
  return "not_arrived";
}

function filterMatches(row: StaffBoardRow, filter: StaffFilter): boolean {
  if (filter === "all") return true;
  if (filter === "late") return row.isLate;
  return row.state === filter;
}

function shiftLabel(row: StaffBoardRow): string {
  if (row.record?.shift_type) {
    return `${humanizeAttendanceValue(row.record.shift_type)} shift`;
  }

  return "Scheduled today";
}

function rowSubtitle(row: StaffBoardRow): string {
  if (row.session) {
    return `${row.session.resource_name ?? "Room"} · ${row.session.service_name}`;
  }

  if (row.record?.checked_in_at && !row.record.checked_out_at) {
    return `Clocked in ${formatAttendanceDateTime(row.record.checked_in_at)}`;
  }

  if (row.record?.checked_out_at) {
    return `Clocked out ${formatAttendanceDateTime(row.record.checked_out_at)}`;
  }

  return "Shift not started";
}

function stateTone(row: StaffBoardRow): "good" | "warn" | "bad" | "neutral" {
  if (row.state === "not_arrived") return "bad";
  if (row.isLate) return "warn";
  if (row.state === "available" || row.state === "in_service") return "good";
  return "neutral";
}

function stateLabel(row: StaffBoardRow): string {
  if (row.state === "not_arrived") return row.state;
  if (row.isLate) return "late";
  return row.state;
}

function staffDisplayName(row: StaffBoardRow): string {
  return row.record?.staff_nickname ?? row.staff.full_name;
}

function isCheckedIn(row: StaffBoardRow): boolean {
  return row.record?.status === "checked_in" && !row.record.checked_out_at;
}

function rowShellClass(row: StaffBoardRow): string {
  if (row.state === "not_arrived") {
    return "border-red-100 bg-red-50/55";
  }

  if (row.isLate) {
    return "border-amber-200 bg-amber-50/45";
  }

  if (isCheckedIn(row)) {
    return "border-emerald-100 bg-white";
  }

  return "border-border bg-white";
}

function branchDate(nowMs: number): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(nowMs));
  const year = parts.find((part) => part.type === "year")?.value ?? "2026";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

function openStaffRecords(staffId: string, nowMs: number) {
  const params = new URLSearchParams({
    tab: "records",
    staffId,
    date: branchDate(nowMs),
  });
  window.location.href = `/crm/attendance?${params.toString()}`;
}

export function LiveStaffTable({
  data,
  nowMs,
}: {
  data: AttendanceWorkspaceData;
  nowMs: number;
}) {
  const [activeFilter, setActiveFilter] = useState<StaffFilter>("all");
  const [search, setSearch] = useState("");

  const rows = useMemo<StaffBoardRow[]>(() => {
    const checkedInRecords = data.records
      .filter((record) => record.status === "checked_in" && !record.checked_out_at)
      .sort(
        (a, b) =>
          new Date(a.checked_in_at).getTime() - new Date(b.checked_in_at).getTime()
      );

    const checkedInByStaffId = new Map(
      checkedInRecords.map((record) => [record.staff_id, record])
    );

    return data.staffOptions
      .slice(0, 36)
      .map((staff) => {
        const record =
          checkedInByStaffId.get(staff.id) ??
          data.records.find((item) => item.staff_id === staff.id);

        const session = activeSessionForStaff(data.sessions, staff.id);
        const state = attendanceAvailabilityState(record, session);

        const queuePosition =
          record?.status === "checked_in" && !record.checked_out_at
            ? checkedInRecords.findIndex((item) => item.staff_id === staff.id) + 1
            : null;

        return {
          staff,
          record,
          session,
          queuePosition,
          state,
          isLate:
            Boolean(record?.late_minutes && record.late_minutes > 0) ||
            record?.attendance_status === "late",
        };
      })
      .sort((a, b) => {
        const priority = {
          in_service: 0,
          available: 1,
          not_arrived: 2,
          clocked_out: 3,
        };

        if (priority[a.state] !== priority[b.state]) {
          return priority[a.state] - priority[b.state];
        }

        if (a.queuePosition && b.queuePosition) {
          return a.queuePosition - b.queuePosition;
        }

        return staffDisplayName(a).localeCompare(staffDisplayName(b));
      });
  }, [data.records, data.sessions, data.staffOptions]);

  const counts = useMemo(() => {
    return FILTERS.reduce<Record<StaffFilter, number>>(
      (acc, filter) => {
        acc[filter.key] = rows.filter((row) => filterMatches(row, filter.key)).length;
        return acc;
      },
      {
        all: 0,
        available: 0,
        in_service: 0,
        late: 0,
        not_arrived: 0,
      }
    );
  }, [rows]);

  const filteredRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return rows.filter((row) => {
      if (!filterMatches(row, activeFilter)) return false;
      if (!normalizedSearch) return true;

      return [
        staffDisplayName(row),
        row.staff.full_name,
        row.staff.staff_type ?? "",
        row.record?.shift_type ?? "",
        row.session?.service_name ?? "",
        row.session?.resource_name ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);
    });
  }, [activeFilter, rows, search]);

  return (
    <section className="h-fit self-start overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-border px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-base font-bold text-foreground">Staff Attendance Board</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Live queue, shift state, work time, and staff availability.
          </p>
        </div>

        <div className="relative w-full lg:w-[280px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search staff attendance"
            placeholder="Search staff..."
            className="h-10 w-full rounded-xl border border-border bg-white pl-9 pr-3 text-sm outline-none transition focus:border-emerald-800"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-stone-50/60 px-4 py-3">
        {FILTERS.map((filter) => {
          const selected = activeFilter === filter.key;

          return (
            <button
              key={filter.key}
              type="button"
              onClick={() => setActiveFilter(filter.key)}
              className={`inline-flex h-8 shrink-0 items-center gap-2 rounded-full border px-3 text-xs font-bold transition ${
                selected
                  ? "border-emerald-800 bg-emerald-50 text-emerald-900 shadow-sm"
                  : "border-border bg-white text-muted-foreground hover:border-emerald-800 hover:text-emerald-900"
              }`}
            >
              {filter.label}
              <span
                className={`rounded-full px-1.5 py-0.5 text-[0.65rem] ${
                  selected ? "bg-emerald-100 text-emerald-900" : "bg-stone-100 text-muted-foreground"
                }`}
              >
                {counts[filter.key]}
              </span>
            </button>
          );
        })}
      </div>

      <div className="max-h-[560px] overflow-y-auto overflow-x-hidden px-3 py-3">
        <div className="grid gap-2">
          {filteredRows.map((row) => {
            const displayName = staffDisplayName(row);

            return (
              <div
                key={row.staff.id}
                className={`grid min-h-[64px] gap-3 rounded-2xl border px-3 py-3 transition hover:border-emerald-800/40 hover:shadow-sm lg:grid-cols-[46px_minmax(150px,1.05fr)_minmax(145px,0.9fr)_90px_105px_28px] lg:items-center ${rowShellClass(
                  row
                )}`}
              >
                <div className="text-sm font-bold text-foreground">
                  {row.queuePosition ? `#${row.queuePosition}` : "-"}
                </div>

                <div className="flex min-w-0 items-center gap-3">
                  <StaffAvatar name={displayName} />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold text-foreground" title={displayName}>
                      {displayName}
                    </div>
                    <div className="truncate text-xs capitalize text-muted-foreground">
                      {humanizeAttendanceValue(row.staff.staff_type ?? "staff")}
                    </div>
                  </div>
                </div>

                <div className="min-w-0 text-sm">
                  <div className="truncate font-semibold text-foreground">{shiftLabel(row)}</div>
                  <div className="truncate text-xs text-muted-foreground" title={rowSubtitle(row)}>
                    {rowSubtitle(row)}
                  </div>
                </div>

                <div className="text-sm">
                  {row.record?.checked_in_at ? (
                    <>
                      <div className="text-[0.68rem] font-semibold leading-none text-muted-foreground">
                        Worked
                      </div>
                      <div className="mt-1 font-bold">
                        {formatMinutesCompact(workedMinutesSince(row.record.checked_in_at, nowMs))}
                      </div>
                    </>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </div>

                <div>
                  <StatusPill value={stateLabel(row)} tone={stateTone(row)} />
                </div>

                <button
                  type="button"
                  className="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-stone-100 hover:text-foreground"
                  aria-label={`Open attendance records for ${row.staff.full_name}`}
                  onClick={() => openStaffRecords(row.staff.id, nowMs)}
                >
                  <ArrowRight className="size-4" />
                </button>
              </div>
            );
          })}

          {filteredRows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No staff match this view.
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-stone-50/60 px-4 py-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <UserRound className="size-3.5" />
          {filteredRows.length} staff shown
        </span>

        <span className="inline-flex items-center gap-1.5">
          <Clock3 className="size-3.5" />
          Auto-refreshes with live attendance updates
        </span>
      </div>
    </section>
  );
}

