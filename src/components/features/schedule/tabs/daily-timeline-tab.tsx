"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, RefreshCw, Settings2 } from "lucide-react";
import type { DailyScheduleStaffRow } from "@/lib/queries/schedule";
import type { StaffScheduleItem } from "@/components/features/staff-schedule/staff-schedule-list";
import { useScheduleRealtime } from "../daily-schedule-board";
import { buildDailyTimelineAlerts } from "./daily-timeline-alerts";
import { DailyTimelineBoard } from "./daily-timeline-board";
import {
  buildStaffTypeMap,
  filterTimelineRows,
  getStaffGroupKey,
  STAFF_GROUPS,
  type StaffGroupKey,
  type TimelineFilters,
} from "./daily-timeline-operations";
import { DailyTimelineOperationsRail } from "./daily-timeline-operations-rail";
import { DailyTimelineSummary } from "./daily-timeline-summary";
import { DailyTimelineToolbar } from "./daily-timeline-toolbar";

const DEFAULT_FILTERS: TimelineFilters = { query: "", shift: "all", status: "all" };

type Props = {
  branchId: string;
  branchName: string;
  date: string;
  staffRows: DailyScheduleStaffRow[];
  availabilityItems: StaffScheduleItem[];
  loadError: string | null;
  initialNow: string;
};

function parseStaffGroup(value: string | null): StaffGroupKey {
  return STAFF_GROUPS.some((group) => group.key === value) ? (value as StaffGroupKey) : "all";
}

export function DailyTimelineTab({
  branchId,
  branchName,
  date,
  staffRows,
  availabilityItems,
  loadError,
  initialNow,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<TimelineFilters>(DEFAULT_FILTERS);
  const [now, setNow] = useState<Date>(() => new Date(initialNow));
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const activeGroup = parseStaffGroup(searchParams.get("staffType"));

  useScheduleRealtime(branchId, date);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const staffTypeById = useMemo(() => buildStaffTypeMap(availabilityItems), [availabilityItems]);
  const groupOptions = useMemo(() => {
    const counts = new Map<StaffGroupKey, number>();
    for (const row of staffRows) {
      const key = getStaffGroupKey(staffTypeById.get(row.staff_id));
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return STAFF_GROUPS
      .map((group) => ({ ...group, count: group.key === "all" ? staffRows.length : counts.get(group.key) ?? 0 }))
      .filter((group) => group.key === "all" || group.count > 0);
  }, [staffRows, staffTypeById]);

  const visibleRows = useMemo(
    () => filterTimelineRows({ rows: staffRows, staffTypeById, group: activeGroup, filters, date, now }),
    [activeGroup, date, filters, now, staffRows, staffTypeById]
  );
  const alerts = useMemo(() => buildDailyTimelineAlerts(visibleRows), [visibleRows]);
  const selectedStaff =
    visibleRows.find((row) => row.staff_id === selectedStaffId) ?? visibleRows[0] ?? null;
  const selectedBooking =
    selectedStaff?.bookings.find((booking) => booking.id === selectedBookingId) ?? null;
  const activeGroupLabel = groupOptions.find((group) => group.key === activeGroup)?.label ?? "All Staff";

  const handleGroupChange = useCallback((group: StaffGroupKey) => {
    const params = new URLSearchParams(searchParams.toString());
    if (group === "all") params.delete("staffType");
    else params.set("staffType", group);
    router.replace(`?${params.toString()}`, { scroll: false });
    setSelectedStaffId(null);
    setSelectedBookingId(null);
  }, [router, searchParams]);

  if (loadError) {
    return <DailyTimelineErrorState message={loadError} onRetry={() => router.refresh()} />;
  }

  return (
    <section className="space-y-3" aria-label="Daily Timeline operations board">
      <DailyTimelineToolbar
        branchName={branchName}
        groups={groupOptions}
        activeGroup={activeGroup}
        filters={filters}
        onGroupChange={handleGroupChange}
        onFiltersChange={setFilters}
      />

      <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-3">
          <DailyTimelineBoard
            rows={visibleRows}
            date={date}
            now={now}
            staffTypeById={staffTypeById}
            alerts={alerts}
            selectedStaffId={selectedStaff?.staff_id ?? null}
            onStaffSelect={(staffId) => {
              setSelectedStaffId(staffId);
              setSelectedBookingId(null);
            }}
            onBookingSelect={(staffId, bookingId) => {
              setSelectedStaffId(staffId);
              setSelectedBookingId(bookingId);
            }}
          />
          <DailyTimelineSummary rows={visibleRows} date={date} now={now} groupLabel={activeGroupLabel} alerts={alerts} />
        </div>
        <DailyTimelineOperationsRail
          rows={visibleRows}
          alerts={alerts}
          groupLabel={activeGroupLabel}
          selectedStaff={selectedStaff}
          selectedBooking={selectedBooking}
          selectedStaffType={selectedStaff ? staffTypeById.get(selectedStaff.staff_id) ?? null : null}
          date={date}
          now={now}
          onStaffSelect={(staffId) => {
            setSelectedStaffId(staffId);
            setSelectedBookingId(null);
          }}
        />
      </div>
    </section>
  );
}

function DailyTimelineErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
      <AlertTriangle className="mx-auto size-6 text-red-700" />
      <h2 className="mt-3 text-sm font-bold text-red-950">We could not load the daily schedule.</h2>
      <p className="mt-1 text-xs text-red-800">{message}</p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <button type="button" onClick={onRetry} className="inline-flex h-9 items-center gap-2 rounded-md bg-red-800 px-3 text-xs font-semibold text-white">
          <RefreshCw className="size-3.5" /> Refresh timeline
        </button>
        <Link href="/crm/staff-availability" className="inline-flex h-9 items-center gap-2 rounded-md border border-red-200 bg-white px-3 text-xs font-semibold text-red-900">
          <Settings2 className="size-3.5" /> Open Schedule Setup
        </Link>
      </div>
    </div>
  );
}
