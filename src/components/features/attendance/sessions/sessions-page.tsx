"use client";

import { CalendarDays, DoorOpen } from "lucide-react";
import { ActiveAttendanceSection } from "@/components/features/attendance/sessions/active-attendance-section";
import { ContextChip, WorkspaceSection } from "@/components/features/attendance/attendance-ui";
import { LiveBoardCard } from "@/components/features/attendance/sessions/live-board-card";
import { RecentActivityCard } from "@/components/features/attendance/sessions/recent-activity-card";
import { ServiceSessionManagementSection } from "@/components/features/attendance/sessions/session-management-section";
import { SessionInsightsCard } from "@/components/features/attendance/sessions/session-insights-card";
import type { AttendanceActionResult } from "@/app/(dashboard)/crm/attendance/actions";
import type { AttendanceTab, AttendanceWorkspaceData } from "@/lib/attendance/types";

export function SessionsPage({
  data,
  nowMs,
  onActionResult,
  onTabChange,
}: {
  data: AttendanceWorkspaceData;
  nowMs: number;
  onActionResult?: (result: AttendanceActionResult) => void;
  onTabChange?: (tab: AttendanceTab) => void;
}) {
  return (
    <WorkspaceSection
      title="Sessions"
      description="Monitor live attendance sessions and manage service countdowns."
      context={
        <>
          <ContextChip
            ariaLabel={`Sessions branch: ${data.branchName}`}
            className="min-h-10"
            icon={<DoorOpen className="size-4" />}
          >
            {data.branchName}
          </ContextChip>
          <ContextChip
            ariaLabel="Sessions date range: Today"
            className="min-h-10"
            icon={<CalendarDays className="size-4" />}
          >
            Today
          </ContextChip>
        </>
      }
    >
      <div className="grid items-start gap-5 p-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <main className="grid min-w-0 gap-5">
          <ActiveAttendanceSection data={data} nowMs={nowMs} onTabChange={onTabChange} />
          <ServiceSessionManagementSection
            data={data}
            nowMs={nowMs}
            onActionResult={onActionResult}
          />
        </main>

        <aside className="grid min-w-0 content-start gap-5">
          <SessionInsightsCard data={data} nowMs={nowMs} onTabChange={onTabChange} />
          <RecentActivityCard data={data} onTabChange={onTabChange} />
          <LiveBoardCard onTabChange={onTabChange} />
        </aside>
      </div>
    </WorkspaceSection>
  );
}
