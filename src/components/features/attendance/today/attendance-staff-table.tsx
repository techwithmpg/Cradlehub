"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AttendanceStaffRow } from "@/components/features/attendance/today/attendance-staff-row";
import type { AttendanceStaffDiagnostic } from "@/lib/attendance/staff-diagnostics";
import { cn } from "@/lib/utils";

type StaffFilter =
  | "all"
  | "needs_help"
  | "working"
  | "not_scanned_in"
  | "checked_out"
  | "late"
  | "in_service"
  | "not_expected";

const PRIMARY_FILTERS: Array<{ key: StaffFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "needs_help", label: "Needs help" },
  { key: "working", label: "Working" },
  { key: "not_scanned_in", label: "Not scanned in" },
  { key: "checked_out", label: "Checked out" },
];

function matches(row: AttendanceStaffDiagnostic, filter: StaffFilter): boolean {
  if (filter === "all") return true;
  if (filter === "needs_help") return row.needsHelp;
  if (filter === "working") return row.working;
  if (filter === "not_scanned_in") return row.notScannedIn;
  if (filter === "checked_out") return row.checkedOut;
  if (filter === "late") return row.status === "late";
  if (filter === "in_service") return row.status === "in_service";
  return row.status === "not_expected";
}

export function AttendanceStaffTable({
  rows,
  onOpen,
  onOpenHistory,
  onOpenPhone,
}: {
  rows: AttendanceStaffDiagnostic[];
  onOpen: (row: AttendanceStaffDiagnostic) => void;
  onOpenHistory: (row: AttendanceStaffDiagnostic) => void;
  onOpenPhone: (row: AttendanceStaffDiagnostic) => void;
}) {
  const [filter, setFilter] = useState<StaffFilter>("all");
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter(
      (row) => matches(row, filter) && (!query || row.staff.staffName.toLowerCase().includes(query))
    );
  }, [filter, rows, search]);
  const secondaryLabel =
    filter === "late"
      ? "Late"
      : filter === "in_service"
        ? "In service"
        : filter === "not_expected"
          ? "Not expected"
          : "More filters";

  return (
    <section
      className="overflow-hidden rounded-2xl border border-[var(--cs-border)] bg-white shadow-sm"
      aria-labelledby="attendance-staff-heading"
    >
      <div className="flex flex-col gap-3 border-b border-[var(--cs-border-soft)] p-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 id="attendance-staff-heading" className="text-base font-bold text-[var(--cs-text)]">
            Today’s Staff
          </h2>
          <p className="mt-0.5 text-xs text-[var(--cs-text-muted)]">
            One current Attendance state per staff member.
          </p>
        </div>
        <label className="relative block w-full lg:w-72">
          <span className="sr-only">Search staff by name</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--cs-text-muted)]" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search staff by name"
            className="h-10 w-full rounded-lg border border-[var(--cs-border)] bg-white pl-9 pr-3 text-sm outline-none focus:border-[#2A5A3A] focus:ring-2 focus:ring-[#2A5A3A]/15"
          />
        </label>
      </div>
      <div className="flex flex-wrap gap-2 border-b border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)] px-4 py-3">
        {PRIMARY_FILTERS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setFilter(item.key)}
            aria-pressed={filter === item.key}
            className={cn(
              "min-h-9 rounded-lg border px-3 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2A5A3A]",
              filter === item.key
                ? "border-[#2A5A3A] bg-[#2A5A3A] text-white"
                : "border-[var(--cs-border)] bg-white text-[var(--cs-text-secondary)] hover:border-[#2A5A3A]"
            )}
          >
            {item.label}
          </button>
        ))}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                aria-label="More staff filters"
                className={cn(
                  "inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-bold",
                  ["late", "in_service", "not_expected"].includes(filter)
                    ? "border-[#2A5A3A] bg-[#2A5A3A] text-white"
                    : "border-[var(--cs-border)] bg-white text-[var(--cs-text-secondary)]"
                )}
              />
            }
          >
            {secondaryLabel}
            <ChevronDown className="size-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => setFilter("late")}>Late</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setFilter("in_service")}>In service</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setFilter("not_expected")}>
              Not expected today
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="overflow-x-auto">
        <div role="table" aria-label="Today staff Attendance status" className="min-w-[980px]">
          <div
            role="row"
            className="grid grid-cols-[minmax(190px,1.25fr)_minmax(135px,.85fr)_minmax(125px,.8fr)_100px_100px_minmax(130px,.8fr)_100px_40px] bg-white px-4 py-2 text-[0.68rem] font-bold uppercase tracking-wide text-[var(--cs-text-muted)]"
          >
            <div role="columnheader">Staff member</div>
            <div role="columnheader">Schedule</div>
            <div role="columnheader">Status</div>
            <div role="columnheader">Clock in</div>
            <div role="columnheader">Clock out</div>
            <div role="columnheader">Last scan</div>
            <div role="columnheader">Action</div>
            <div role="columnheader">
              <span className="sr-only">More</span>
            </div>
          </div>
          {filtered.map((row) => (
            <AttendanceStaffRow
              key={row.staff.staffId}
              row={row}
              onOpen={onOpen}
              onOpenHistory={onOpenHistory}
              onOpenPhone={onOpenPhone}
            />
          ))}
          {filtered.length === 0 ? (
            <div className="border-t border-dashed border-[var(--cs-border)] p-8 text-center text-sm text-[var(--cs-text-muted)]">
              No staff match this view.
            </div>
          ) : null}
        </div>
      </div>
      <div className="border-t border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)] px-4 py-3 text-xs text-[var(--cs-text-muted)]">
        Showing {filtered.length} of {rows.length} staff
      </div>
    </section>
  );
}
