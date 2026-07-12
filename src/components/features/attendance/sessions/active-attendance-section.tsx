"use client";

import { List, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StaffSessionCard } from "@/components/features/attendance/sessions/staff-session-card";
import { EmptyState } from "@/components/features/attendance/attendance-ui";
import type {
  AttendanceRecord,
  AttendanceSession,
  AttendanceTab,
  AttendanceWorkspaceData,
} from "@/lib/attendance/types";

type ActiveStaffSession = {
  record: AttendanceRecord;
  session: AttendanceSession | undefined;
  queuePosition: number;
};

function activeSessionForStaff(
  sessions: AttendanceSession[],
  staffId: string
): AttendanceSession | undefined {
  return sessions.find(
    (session) =>
      session.staff_id === staffId &&
      session.booking_progress_status === "session_started"
  );
}

function getActiveStaffSessions(data: AttendanceWorkspaceData): ActiveStaffSession[] {
  return data.records
    .filter((record) => record.status === "checked_in" && !record.checked_out_at)
    .sort(
      (a, b) =>
        new Date(a.checked_in_at).getTime() - new Date(b.checked_in_at).getTime()
    )
    .map((record, index) => ({
      record,
      session: activeSessionForStaff(data.sessions, record.staff_id),
      queuePosition: index + 1,
    }));
}

export function ActiveAttendanceSection({
  data,
  nowMs,
  onTabChange,
}: {
  data: AttendanceWorkspaceData;
  nowMs: number;
  onTabChange?: (tab: AttendanceTab) => void;
}) {
  const activeStaff = getActiveStaffSessions(data);

  return (
    <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h2 className="text-base font-bold text-foreground">Active Attendance Sessions</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Staff currently clocked in and available for service.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => onTabChange?.("records")}>
            <List className="mr-2 size-4" />
            View all
          </Button>

          <Button type="button" size="sm" disabled>
            <PlusCircle className="mr-2 size-4" />
            Add Walk-in
          </Button>
        </div>
      </div>

      {activeStaff.length === 0 ? (
        <div className="p-5">
          <EmptyState
            title="No active attendance sessions"
            detail="Clocked-in staff will appear here once they scan the attendance QR."
          />
        </div>
      ) : (
        <div className="overflow-hidden px-5 py-4">
          <div className="flex snap-x gap-4 overflow-x-auto pb-3">
            {activeStaff.slice(0, 10).map((item) => (
              <StaffSessionCard
                key={item.record.id}
                item={item}
                nowMs={nowMs}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
