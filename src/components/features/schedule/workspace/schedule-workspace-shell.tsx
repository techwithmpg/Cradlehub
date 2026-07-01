"use client";

import { useCallback, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Leaf,
  Users,
  AlertTriangle,
} from "lucide-react";
import { ScheduleWorkspaceHeader, type ScheduleViewMode } from "./schedule-workspace-header";
import { ScheduleWorkspaceTabs, type ScheduleTabKey } from "./schedule-workspace-tabs";
import { ScheduleStatusChipRow } from "./schedule-status-chip-row";
import { ScheduleMetricGrid, type ScheduleMetricItem } from "./schedule-metric-grid";
import { ScheduleContentGrid } from "./schedule-content-grid";
import { SchedulePanel } from "./schedule-panel";
import { ScheduleActionTile } from "./schedule-action-tile";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdministrativeBookingModal } from "@/components/features/bookings/administrative-booking-modal-provider";
import { CheckAvailabilityModal } from "@/components/features/crm/schedule/check-availability-modal";

const DailyTimelineTab = dynamic(() => import("../tabs/daily-timeline-tab").then((m) => m.DailyTimelineTab), {
  loading: () => <TabSkeleton rows={6} />,
});
const LiveAvailabilityTab = dynamic(() => import("../tabs/live-availability-tab").then((m) => m.LiveAvailabilityTab), {
  loading: () => <TabSkeleton rows={4} />,
});
const ScheduleSetupTab = dynamic(() => import("../tabs/schedule-setup-tab").then((m) => m.ScheduleSetupTab), {
  loading: () => <TabSkeleton rows={4} />,
});
const CoverageIssuesTab = dynamic(() => import("../tabs/coverage-issues-tab").then((m) => m.CoverageIssuesTab), {
  loading: () => <TabSkeleton rows={4} />,
});
const StaffScheduleTab = dynamic(() => import("../tabs/staff-schedule-tab").then((m) => m.StaffScheduleTab), {
  loading: () => <TabSkeleton rows={4} />,
});
const FullScheduleLiveBookingsView = dynamic(
  () => import("../tabs/full-schedule-live-bookings-view").then((m) => m.FullScheduleLiveBookingsView),
  { loading: () => <TabSkeleton rows={6} /> }
);

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
import type { Database } from "@/types/supabase";
import type { ReadinessResult } from "@/types/readiness";
import type { StaffScheduleItem } from "@/components/features/staff-schedule/staff-schedule-list";

const TAB_PARAM = "tab";
const VIEW_PARAM = "view";
const DEFAULT_TAB: ScheduleTabKey = "daily";
const DEFAULT_VIEW: ScheduleViewMode = "daily_timeline";

function getTabFromSearchParams(sp: URLSearchParams): ScheduleTabKey {
  const raw = sp.get(TAB_PARAM);
  const valid: ScheduleTabKey[] = ["daily", "availability", "setup", "coverage", "staff"];
  return valid.includes(raw as ScheduleTabKey) ? (raw as ScheduleTabKey) : DEFAULT_TAB;
}

function getViewModeFromSearchParams(sp: URLSearchParams): ScheduleViewMode {
  return sp.get(VIEW_PARAM) === "full" ? "full_schedule" : DEFAULT_VIEW;
}

type ResourceRow = Database["public"]["Tables"]["branch_resources"]["Row"];

function computeAlerts(staffRows: DailyScheduleStaffRow[]) {
  let travelBuffer = 0;
  let missingAssignment = 0;
  const resourceBookings = new Map<string, import("@/lib/queries/schedule").DailyScheduleBooking[]>();

  for (const staff of staffRows) {
    for (const booking of staff.bookings) {
      if (booking.type === "home_service" && booking.status !== "cancelled" && booking.status !== "no_show") {
        travelBuffer++;
      }
      if (booking.type !== "home_service" && !booking.resource_id && booking.status !== "cancelled" && booking.status !== "no_show") {
        missingAssignment++;
      }
      if (booking.resource_id && booking.status !== "cancelled" && booking.status !== "no_show") {
        const list = resourceBookings.get(booking.resource_id) ?? [];
        list.push(booking);
        resourceBookings.set(booking.resource_id, list);
      }
    }
  }

  let roomConflicts = 0;
  for (const list of resourceBookings.values()) {
    if (list.length > 1) {
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const a = list[i]!;
          const b = list[j]!;
          if (a.start_time < b.end_time && b.start_time < a.end_time) {
            roomConflicts++;
          }
        }
      }
    }
  }

  return { travelBuffer, missingAssignment, roomConflicts, total: travelBuffer + missingAssignment + roomConflicts };
}

export function ScheduleWorkspaceShell({
  branchId,
  branchName,
  date,
  staffRows,
  availabilityItems,
  branchResources,
  stats,
  readiness,
  dailyTimelineError,
  dailyTimelineNow,
}: {
  branchId: string;
  branchName: string;
  date: string;
  staffRows: DailyScheduleStaffRow[];
  availabilityItems: StaffScheduleItem[];
  branchResources: ResourceRow[];
  stats: { total: number; confirmed: number; in_progress: number; completed: number; cancelled: number; no_show: number };
  readiness: ReadinessResult | null;
  dailyTimelineError: string | null;
  dailyTimelineNow: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { openBookingModal } = useAdministrativeBookingModal();
  const activeTab = getTabFromSearchParams(searchParams);
  const viewMode = getViewModeFromSearchParams(searchParams);
  const [checkAvailabilityOpen, setCheckAvailabilityOpen] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);

  const setTab = useCallback(
    (tab: ScheduleTabKey) => {
      const params = new URLSearchParams(searchParams.toString());
      if (tab === DEFAULT_TAB) {
        params.delete(TAB_PARAM);
      } else {
        params.set(TAB_PARAM, tab);
      }
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  const handleDateChange = useCallback(
    (nextDate: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("date", nextDate);
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  const setViewMode = useCallback(
    (mode: ScheduleViewMode) => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete(TAB_PARAM);
      params.set(VIEW_PARAM, mode === "full_schedule" ? "full" : "daily");
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  const alerts = useMemo(() => computeAlerts(staffRows), [staffRows]);
  const availableStaffCount = staffRows.filter((s) => s.work_start && s.work_end).length;
  const coverageIssueCount = readiness?.issues.filter((i) => i.scope === "setup").length ?? 0;
  const totalRooms = branchResources.length;
  const usedRooms = new Set(
    staffRows
      .flatMap((s) => s.bookings)
      .filter((b) => b.resource_id && b.status !== "cancelled" && b.status !== "no_show")
      .map((b) => b.resource_id)
  ).size;
  const roomsAvailable = Math.max(0, totalRooms - usedRooms);

  const readinessStatus = readiness?.status ?? "ok";
  const readinessIssues = readiness?.issues ?? [];

  const metrics: ScheduleMetricItem[] = useMemo(() => {
    return [
      {
        label: "Total Bookings",
        value: stats.total,
        color: "#5A8A6A",
        icon: <Calendar size={16} />,
        trend: "Scheduled today",
      },
      {
        label: "Confirmed",
        value: stats.confirmed,
        color: "#5A8A6A",
        icon: <CheckCircle2 size={16} />,
        trend: "Ready to serve",
      },
      {
        label: "In Progress",
        value: stats.in_progress,
        color: "#8A7A5A",
        icon: <Clock size={16} />,
        trend: "Currently serving",
      },
      {
        label: "Completed",
        value: stats.completed,
        color: "#5A8A6A",
        icon: <Leaf size={16} />,
        trend: "Finished today",
      },
      {
        label: "Available Staff",
        value: availableStaffCount,
        color: "#8A7A5A",
        icon: <Users size={16} />,
        trend: "On duty now",
      },
      {
        label: "Alerts",
        value: alerts.total,
        color: alerts.total > 0 ? "var(--cs-error)" : "var(--cs-text-muted)",
        icon: <AlertTriangle size={16} />,
        trend: alerts.total > 0 ? "Need attention" : "All clear",
      },
    ];
  }, [stats, availableStaffCount, alerts]);

  const tabBadges = useMemo(() => {
    const badges: Partial<Record<ScheduleTabKey, number>> = {};
    if (coverageIssueCount > 0) badges.coverage = coverageIssueCount;
    return badges;
  }, [coverageIssueCount]);

  const renderTabContent = () => {
    switch (activeTab) {
      case "daily":
        return (
          <>
            <div className={viewMode === "daily_timeline" ? "block" : "hidden"}>
              <DailyTimelineTab
                branchId={branchId}
                branchName={branchName}
                date={date}
                staffRows={staffRows}
                availabilityItems={availabilityItems}
                loadError={dailyTimelineError}
                initialNow={dailyTimelineNow}
                selectedStaffId={selectedStaffId}
                selectedBookingId={selectedBookingId}
                onSelectedStaffChange={setSelectedStaffId}
                onSelectedBookingChange={setSelectedBookingId}
              />
            </div>
            <div className={viewMode === "full_schedule" ? "block" : "hidden"}>
              <FullScheduleLiveBookingsView
                branchId={branchId}
                branchName={branchName}
                date={date}
                staffRows={staffRows}
                availabilityItems={availabilityItems}
                selectedStaffId={selectedStaffId}
                selectedBookingId={selectedBookingId}
                onSelectedStaffChange={setSelectedStaffId}
                onSelectedBookingChange={setSelectedBookingId}
              />
            </div>
          </>
        );
      case "availability":
        return <LiveAvailabilityTab branchId={branchId} date={date} />;
      case "setup":
        return <ScheduleSetupTab branchId={branchId} />;
      case "coverage":
        return <CoverageIssuesTab branchId={branchId} />;
      case "staff":
        return (
          <StaffScheduleTab
            branchId={branchId}
            branchName={branchName}
            initialItems={availabilityItems}
          />
        );
      default:
        return null;
    }
  };

  const renderRightRail = () => {
    // Daily timeline gets contextual right rail within the tab itself
    if (activeTab === "daily") return null;

    return (
      <>
        <SchedulePanel title="Quick Actions">
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <ScheduleActionTile
              label="Add Booking"
              onClick={() => openBookingModal({ mode: "standard_future", date })}
              primary
            />
            <ScheduleActionTile label="Block Staff Time" onClick={() => setTab("staff")} />
            <ScheduleActionTile label="Check Availability" onClick={() => setCheckAvailabilityOpen(true)} />
            <ScheduleActionTile label="Open Schedule Setup" onClick={() => setTab("setup")} />
          </div>
        </SchedulePanel>

        <SchedulePanel title="Day Snapshot">
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {[
              { label: "Total", value: stats.total, color: "var(--cs-text)" },
              { label: "Confirmed", value: stats.confirmed, color: "var(--cs-success)" },
              { label: "In Progress", value: stats.in_progress, color: "var(--cs-sand)" },
              { label: "Completed", value: stats.completed, color: "var(--cs-crm-accent)" },
            ].map((row) => (
              <div
                key={row.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0.4rem 0.5rem",
                  borderRadius: "var(--cs-r-sm)",
                  backgroundColor: "var(--cs-surface-warm)",
                }}
              >
                <span style={{ fontSize: "0.8125rem", color: "var(--cs-text-secondary)" }}>{row.label}</span>
                <span style={{ fontSize: "0.875rem", fontWeight: 700, color: row.color }}>{row.value}</span>
              </div>
            ))}
          </div>
        </SchedulePanel>
      </>
    );
  };

  return (
    <div className="px-3 py-3 md:px-0 md:py-0" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <ScheduleWorkspaceHeader
        branchName={branchName}
        date={date}
        initialNow={dailyTimelineNow}
        viewMode={viewMode}
        onDateChange={handleDateChange}
        onViewModeChange={setViewMode}
      />

      <ScheduleWorkspaceTabs activeTab={activeTab} onTabChange={setTab} tabBadges={tabBadges} />

      {activeTab !== "daily" ? (
        <>
          <ScheduleStatusChipRow
            readinessStatus={readinessStatus}
            readinessIssues={readinessIssues}
            availableStaffCount={availableStaffCount}
            coverageIssueCount={coverageIssueCount}
            roomsAvailable={roomsAvailable}
            totalRooms={totalRooms}
            conflictCount={alerts.roomConflicts}
            onSwitchTab={setTab}
          />
          <ScheduleMetricGrid metrics={metrics} />
        </>
      ) : null}

      {/* Main content area */}
      {activeTab === "daily" || activeTab === "setup" || activeTab === "staff" ? (
        renderTabContent()
      ) : (
        <ScheduleContentGrid main={renderTabContent()} rightRail={renderRightRail()} />
      )}

      <CheckAvailabilityModal
        open={checkAvailabilityOpen}
        onOpenChange={setCheckAvailabilityOpen}
        initialDate={date}
      />
    </div>
  );
}
