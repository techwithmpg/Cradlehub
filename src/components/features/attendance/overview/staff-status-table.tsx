"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  EmptyState,
  Panel,
  humanizeAttendanceValue,
} from "@/components/features/attendance/attendance-ui";
import { StaffStatusRow } from "@/components/features/attendance/overview/staff-status-row";
import {
  getAttendanceOverviewStatus,
  type AttendanceOverviewStatusKey,
} from "@/lib/attendance/overview-summary";
import type { AttendanceTab, AttendanceWorkspaceData } from "@/lib/attendance/types";

const STATUS_FILTERS: Array<{ value: "all" | AttendanceOverviewStatusKey; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "on_duty", label: "On duty" },
  { value: "not_in_yet", label: "Not in yet" },
  { value: "completed", label: "Completed" },
  { value: "needs_review", label: "Needs review" },
  { value: "off_duty", label: "Off duty" },
];

export function StaffStatusTable({
  data,
  onTabChange,
}: {
  data: AttendanceWorkspaceData;
  onTabChange: (tab: AttendanceTab) => void;
}) {
  const [search, setSearch] = useState("");
  const [staffType, setStaffType] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | AttendanceOverviewStatusKey>("all");

  const staffTypes = useMemo(
    () =>
      Array.from(
        new Set(
          data.dailyStaffStates
            .map((row) => row.staffType)
            .filter((value): value is string => Boolean(value))
        )
      ).sort(),
    [data.dailyStaffStates]
  );

  const lastScanByName = useMemo(() => {
    const scans = new Map<string, AttendanceWorkspaceData["scanEvents"][number]>();
    for (const event of data.scanEvents) {
      const name = event.staff_name?.trim().toLowerCase();
      if (name && !scans.has(name)) scans.set(name, event);
    }
    return scans;
  }, [data.scanEvents]);

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return data.dailyStaffStates.filter((row) => {
      if (staffType !== "all" && row.staffType !== staffType) return false;
      const status = getAttendanceOverviewStatus(row);
      if (statusFilter !== "all" && status.key !== statusFilter) return false;
      if (!query) return true;
      return [row.staffName, row.staffType ?? "", row.displayLabel]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [data.dailyStaffStates, search, staffType, statusFilter]);

  return (
    <Panel
      title="Staff status"
      description={`${rows.length} of ${data.dailyStaffStates.length} staff shown`}
      action={
        <Button type="button" variant="ghost" size="sm" onClick={() => onTabChange("records")}>
          View all
        </Button>
      }
      className="min-w-0"
    >
      <div className="grid gap-2 border-y border-[var(--cs-border-soft)] py-3 sm:grid-cols-[minmax(180px,1fr)_170px_170px]">
        <label className="flex h-9 min-w-0 items-center gap-2 rounded-[var(--cs-r-md)] border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3">
          <Search className="size-4 shrink-0 text-[var(--cs-text-muted)]" aria-hidden="true" />
          <span className="sr-only">Search staff</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search staff…"
            className="min-w-0 flex-1 bg-transparent text-sm text-[var(--cs-text)] outline-none placeholder:text-[var(--cs-text-subtle)]"
          />
        </label>
        <label>
          <span className="sr-only">Filter by staff type</span>
          <select
            value={staffType}
            onChange={(event) => setStaffType(event.target.value)}
            className="h-9 w-full rounded-[var(--cs-r-md)] border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 text-sm font-medium text-[var(--cs-text)] outline-none focus:border-[var(--cs-crm-accent)]"
          >
            <option value="all">All roles</option>
            {staffTypes.map((value) => (
              <option key={value} value={value}>
                {humanizeAttendanceValue(value)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Filter by attendance status</span>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
            className="h-9 w-full rounded-[var(--cs-r-md)] border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 text-sm font-medium text-[var(--cs-text)] outline-none focus:border-[var(--cs-crm-accent)]"
          >
            {STATUS_FILTERS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No staff match these filters"
          detail="Clear the search or choose a different role or status."
        />
      ) : (
        <div className="max-h-[520px] overflow-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="sticky top-0 z-10 bg-[var(--cs-surface-warm)] text-left text-[11px] font-bold uppercase tracking-wide text-[var(--cs-text-muted)]">
              <tr>
                <th className="px-3 py-2.5">Staff</th>
                <th className="px-3 py-2.5">Shift</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5">Clock in</th>
                <th className="px-3 py-2.5">Clock out</th>
                <th className="px-3 py-2.5">Last scan</th>
                <th className="px-3 py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <StaffStatusRow
                  key={row.staffId}
                  row={row}
                  lastScan={lastScanByName.get(row.staffName.trim().toLowerCase())}
                  onTabChange={onTabChange}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
