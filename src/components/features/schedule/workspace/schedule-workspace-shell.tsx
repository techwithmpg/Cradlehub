"use client";

import { useCallback, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ScheduleWorkspaceHeader } from "./schedule-workspace-header";
import { ScheduleWorkspaceTabs, type ScheduleTabKey } from "./schedule-workspace-tabs";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import {
  type DailyScheduleApiResponse,
  type ScheduleStats,
  useLiveDailySchedule,
} from "../hooks/use-live-daily-schedule";
import { useScheduleRealtime } from "../hooks/use-schedule-realtime";

const DailyTimelineTab = dynamic(() => import("../tabs/daily-timeline-tab").then((m) => m.DailyTimelineTab), {
  loading: () => <TabSkeleton rows={6} />,
});
const ScheduleSetupTab = dynamic(() => import("../tabs/schedule-setup-tab").then((m) => m.ScheduleSetupTab), {
  loading: () => <TabSkeleton rows={4} />,
});

function TabSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-20 rounded-xl" />
      ))}
    </div>
  );
}
import type { DailyScheduleStaffRow } from "@/lib/queries/schedule";
import type { SchedulingRules } from "@/lib/scheduling/types";
import type { Database } from "@/types/supabase";
import type { ReadinessResult } from "@/types/readiness";
import type { StaffScheduleItem } from "@/components/features/staff-schedule/staff-schedule-types";
import { useWorkspaceReactivationRefresh } from "@/components/features/dashboard/use-workspace-visibility";

const TAB_PARAM = "tab";
const DEFAULT_TAB: ScheduleTabKey = "daily";

function getTabFromSearchParams(sp: URLSearchParams): ScheduleTabKey {
  const raw = sp.get(TAB_PARAM);
  const valid: ScheduleTabKey[] = ["daily", "setup"];
  return valid.includes(raw as ScheduleTabKey) ? (raw as ScheduleTabKey) : DEFAULT_TAB;
}

type ResourceRow = Database["public"]["Tables"]["branch_resources"]["Row"];

export function ScheduleWorkspaceShell({
  branchId,
  branchName,
  date,
  staffRows: initialStaffRows,
  availabilityItems,
  branchResources: initialBranchResources,
  stats: initialStats,
  readiness: initialReadiness,
  schedulingRules,
  dailyTimelineError,
  dailyTimelineNow,
}: {
  branchId: string;
  branchName: string;
  date: string;
  staffRows: DailyScheduleStaffRow[];
  availabilityItems: StaffScheduleItem[];
  branchResources: ResourceRow[];
  stats: ScheduleStats;
  readiness: ReadinessResult | null;
  schedulingRules: SchedulingRules | null;
  dailyTimelineError: string | null;
  dailyTimelineNow: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = getTabFromSearchParams(searchParams);
  const [mountedTabs, setMountedTabs] = useState<Set<ScheduleTabKey>>(
    () => new Set([activeTab])
  );
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);

  const fallbackScheduleData = useMemo<DailyScheduleApiResponse>(
    () => ({
      branchId,
      branchName,
      staffRows: initialStaffRows,
      branchResources: initialBranchResources,
      stats: initialStats,
      readiness: initialReadiness,
      schedulingRules,
    }),
    [branchId, branchName, initialBranchResources, initialReadiness, initialStaffRows, initialStats, schedulingRules]
  );
  const {
    data: liveScheduleData,
    mutate: refreshDailySchedule,
    isValidating,
    error: liveScheduleError,
  } = useLiveDailySchedule({
    date,
    fallbackData: fallbackScheduleData,
  });
  const scheduleData = liveScheduleData ?? fallbackScheduleData;
  const staffRows = scheduleData.staffRows;
  const validSelectedStaffId =
    selectedStaffId && staffRows.some((row) => row.staff_id === selectedStaffId)
      ? selectedStaffId
      : null;
  const validSelectedBookingId =
    selectedBookingId &&
    staffRows.some((row) => row.bookings.some((booking) => booking.id === selectedBookingId))
      ? selectedBookingId
      : null;
  const liveScheduleErrorMessage =
    liveScheduleError instanceof Error
      ? liveScheduleError.message
      : liveScheduleError
        ? "The live schedule could not be refreshed."
        : null;

  const refreshRetainedSchedule = useWorkspaceReactivationRefresh(async () => {
    await refreshDailySchedule();
  });
  const handleScheduleChanged = useCallback(async () => {
    await refreshRetainedSchedule();
  }, [refreshRetainedSchedule]);

  useScheduleRealtime({
    branchId,
    date,
    onInvalidate: () => {
      void handleScheduleChanged();
    },
  });

  const setTab = useCallback(
    (tab: ScheduleTabKey) => {
      setMountedTabs((current) => {
        if (current.has(tab)) return current;
        const next = new Set(current);
        next.add(tab);
        return next;
      });
      const params = new URLSearchParams(searchParams.toString());
      if (tab === DEFAULT_TAB) {
        params.delete(TAB_PARAM);
      } else {
        params.set(TAB_PARAM, tab);
      }
      const query = params.toString();
      window.history.pushState(null, "", query ? `?${query}` : window.location.pathname);
    },
    [searchParams]
  );

  const handleDateChange = useCallback(
    (nextDate: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("date", nextDate);
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  const renderTabContent = () => (
    <>
      {mountedTabs.has("daily") ? (
        <div hidden={activeTab !== "daily"} aria-hidden={activeTab !== "daily"}>
          <DailyTimelineTab
            branchId={branchId}
            branchName={branchName}
            date={date}
            staffRows={staffRows}
            availabilityItems={availabilityItems}
            schedulingRules={scheduleData.schedulingRules}
            loadError={dailyTimelineError}
            initialNow={dailyTimelineNow}
            selectedStaffId={validSelectedStaffId}
            selectedBookingId={validSelectedBookingId}
            onSelectedStaffChange={setSelectedStaffId}
            onSelectedBookingChange={setSelectedBookingId}
            isRefreshing={isValidating}
            liveErrorMessage={liveScheduleErrorMessage}
            onRetryLiveData={handleScheduleChanged}
            onScheduleChanged={handleScheduleChanged}
          />
        </div>
      ) : null}
      {mountedTabs.has("setup") ? (
        <div hidden={activeTab !== "setup"} aria-hidden={activeTab !== "setup"}>
          <ScheduleSetupTab branchId={branchId} onScheduleChanged={handleScheduleChanged} />
        </div>
      ) : null}
    </>
  );

  return (
    <div className="px-3 py-3 md:px-0 md:py-0" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <ScheduleWorkspaceHeader
        branchName={branchName}
        date={date}
        initialNow={dailyTimelineNow}
        onDateChange={handleDateChange}
      />

      <ScheduleWorkspaceTabs activeTab={activeTab} onTabChange={setTab} />

      {renderTabContent()}
    </div>
  );
}
