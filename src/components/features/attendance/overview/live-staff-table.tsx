"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Clock3, Search, UserRound } from "lucide-react";
import {
  StaffAvatar,
  StatusPill,
  formatMinutesCompact,
  humanizeAttendanceValue,
} from "@/components/features/attendance/attendance-ui";
import type { AttendanceDayStaffState } from "@/lib/attendance/day-model";
import type { AttendanceWorkspaceData } from "@/lib/attendance/types";

type StaffFilter = "all" | "available" | "in_service" | "late" | "not_arrived";

const FILTERS: Array<{ key: StaffFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "available", label: "Available" },
  { key: "in_service", label: "In Service" },
  { key: "late", label: "Late" },
  { key: "not_arrived", label: "Not Arrived" },
];

function filterMatches(row: AttendanceDayStaffState, filter: StaffFilter): boolean {
  if (filter === "all") return true;
  if (filter === "available") return row.operationalStatus === "clocked_in" && row.availabilityState === "available";
  if (filter === "in_service") return row.operationalStatus === "on_service";
  if (filter === "late") return row.operationalStatus === "missing";
  return row.operationalStatus === "expected_later";
}

function formatShiftTime(value: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function shiftLabel(row: AttendanceDayStaffState): string {
  const window = row.currentShiftWindow ?? row.nextShiftWindow ?? row.shiftWindows[0];
  if (!window) return row.displayLabel;
  const times = `${formatShiftTime(window.scheduledStartAt, row.timezone)}–${formatShiftTime(window.scheduledEndAt, row.timezone)}`;
  if (row.scheduleState === "scheduled_later" || row.scheduleState === "expected_soon") {
    return `${row.displayLabel} · ${times}`;
  }
  return `${humanizeAttendanceValue(window.shiftType)} shift · ${times}`;
}

function rowSubtitle(row: AttendanceDayStaffState): string {
  if (row.activeServiceSession) {
    return `${row.activeServiceSession.resource_name ?? "Room"} · ${row.activeServiceSession.service_name}`;
  }
  if (row.clockInAt && !row.clockOutAt) {
    return `Clocked in ${formatShiftTime(row.clockInAt, row.timezone)}`;
  }
  if (row.clockOutAt) {
    return `Clocked out ${formatShiftTime(row.clockOutAt, row.timezone)}`;
  }
  if (row.scheduleState === "day_off") return "No attendance expected";
  if (row.scheduleState === "not_scheduled") return "Not part of the operational roster";
  if (row.scheduleState === "schedule_missing") return "No schedule is configured";
  if (row.scheduleState === "schedule_conflict") return "Schedule needs CRM review";
  if (row.scheduleState === "scheduled_later") return "Shift has not reached its arrival window";
  if (row.scheduleState === "expected_soon") return "Arrival window opens soon";
  if (row.scheduleState === "shift_complete") return "Scheduled windows are complete";
  return "Shift is currently expected";
}

function stateTone(row: AttendanceDayStaffState): "good" | "warn" | "bad" | "neutral" {
  if (row.operationalStatus === "missing") return "bad";
  if (row.operationalStatus === "expected_later" || row.operationalStatus === "needs_review" || row.operationalStatus === "scan_captured") return "warn";
  if (row.operationalStatus === "clocked_in" || row.operationalStatus === "on_service") return "good";
  return "neutral";
}

function rowShellClass(row: AttendanceDayStaffState): string {
  if (row.operationalStatus === "missing") return "border-red-100 bg-red-50/55";
  if (["expected_later", "needs_review", "scan_captured"].includes(row.operationalStatus)) {
    return "border-amber-200 bg-amber-50/45";
  }
  if (row.operationalStatus === "clocked_in" || row.operationalStatus === "on_service") {
    return "border-emerald-100 bg-white";
  }
  return "border-border bg-white";
}

function openStaffRecords(staffId: string, businessDate: string) {
  const params = new URLSearchParams({ tab: "records", staffId, date: businessDate });
  window.location.href = `/crm/attendance?${params.toString()}`;
}

export function LiveStaffTable({ data }: { data: AttendanceWorkspaceData; nowMs: number }) {
  const [activeFilter, setActiveFilter] = useState<StaffFilter>("all");
  const [search, setSearch] = useState("");

  const rows = useMemo(
    () =>
      [...data.dailyStaffStates].sort((first, second) => {
        const priority = (row: AttendanceDayStaffState) => {
          if (row.operationalStatus === "on_service") return 0;
          if (row.availabilityState === "available") return 1;
          if (row.operationalStatus === "missing") return 2;
          if (row.operationalStatus === "expected_later") return 3;
          if (row.operationalStatus === "needs_review" || row.operationalStatus === "scan_captured") return 4;
          return 5;
        };
        return priority(first) - priority(second) || first.staffName.localeCompare(second.staffName);
      }),
    [data.dailyStaffStates]
  );

  const counts = useMemo(
    () =>
      FILTERS.reduce<Record<StaffFilter, number>>(
        (result, filter) => {
          result[filter.key] = rows.filter((row) => filterMatches(row, filter.key)).length;
          return result;
        },
        { all: 0, available: 0, in_service: 0, late: 0, not_arrived: 0 }
      ),
    [rows]
  );

  const filteredRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (!filterMatches(row, activeFilter)) return false;
      if (!normalizedSearch) return true;
      return [
        row.staffName,
        row.staffType ?? "",
        row.displayLabel,
        row.scheduleState,
        row.activeServiceSession?.service_name ?? "",
        row.activeServiceSession?.resource_name ?? "",
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
          <p className="mt-0.5 text-xs text-muted-foreground">Resolved schedule, presence, service, and availability.</p>
        </div>
        <div className="relative w-full lg:w-[280px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Search staff attendance" placeholder="Search staff..." className="h-10 w-full rounded-xl border border-border bg-white pl-9 pr-3 text-sm outline-none transition focus:border-emerald-800" />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-stone-50/60 px-4 py-3">
        {FILTERS.map((filter) => {
          const selected = activeFilter === filter.key;
          return (
            <button key={filter.key} type="button" onClick={() => setActiveFilter(filter.key)} className={`inline-flex h-8 shrink-0 items-center gap-2 rounded-full border px-3 text-xs font-bold transition ${selected ? "border-emerald-800 bg-emerald-50 text-emerald-900 shadow-sm" : "border-border bg-white text-muted-foreground hover:border-emerald-800 hover:text-emerald-900"}`}>
              {filter.label}<span className={`rounded-full px-1.5 py-0.5 text-[0.65rem] ${selected ? "bg-emerald-100 text-emerald-900" : "bg-stone-100 text-muted-foreground"}`}>{counts[filter.key]}</span>
            </button>
          );
        })}
      </div>
      <div className="max-h-[560px] overflow-y-auto overflow-x-hidden px-3 py-3">
        <div className="grid gap-2">
          {filteredRows.map((row) => (
            <div key={row.staffId} className={`grid min-h-[64px] gap-3 rounded-2xl border px-3 py-3 transition hover:border-emerald-800/40 hover:shadow-sm lg:grid-cols-[46px_minmax(150px,1.05fr)_minmax(145px,0.9fr)_90px_105px_28px] lg:items-center ${rowShellClass(row)}`}>
              <div className="text-sm font-bold text-foreground">—</div>
              <div className="flex min-w-0 items-center gap-3"><StaffAvatar name={row.staffName} /><div className="min-w-0"><div className="truncate text-sm font-bold text-foreground" title={row.staffName}>{row.staffName}</div><div className="truncate text-xs capitalize text-muted-foreground">{humanizeAttendanceValue(row.staffType ?? "staff")}</div></div></div>
              <div className="min-w-0 text-sm"><div className="truncate font-semibold text-foreground">{shiftLabel(row)}</div><div className="truncate text-xs text-muted-foreground" title={rowSubtitle(row)}>{rowSubtitle(row)}</div></div>
              <div className="text-sm">{row.clockInAt ? <><div className="text-[0.68rem] font-semibold leading-none text-muted-foreground">Worked</div><div className="mt-1 font-bold">{formatMinutesCompact(row.workedMinutes)}</div></> : <span className="text-muted-foreground">—</span>}</div>
              <div><StatusPill value={humanizeAttendanceValue(row.operationalStatus)} tone={stateTone(row)} /></div>
              <button type="button" className="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-stone-100 hover:text-foreground" aria-label={`Open attendance records for ${row.staffName}`} onClick={() => openStaffRecords(row.staffId, row.businessDate)}><ArrowRight className="size-4" /></button>
            </div>
          ))}
          {filteredRows.length === 0 ? <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No staff match this view.</div> : null}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-stone-50/60 px-4 py-3 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1.5"><UserRound className="size-3.5" />{filteredRows.length} staff shown</span><span className="inline-flex items-center gap-1.5"><Clock3 className="size-3.5" />Auto-refreshes with live attendance updates</span></div>
    </section>
  );
}
