"use client";

import {
  computeKpiData,
  computeAlerts,
  type TodayBooking,
  type StaffAvailability,
} from "./manager-today-utils";
import { ManagerTodayHeader } from "./manager-today-header";
import { ManagerTodayKpiCards } from "./manager-today-kpi-cards";
import { TodayTimelinePreview } from "./today-timeline-preview";
import { BookingsNeedingAction } from "./bookings-needing-action";
import { UpcomingBookings } from "./upcoming-bookings";
import { ManagerActionCenter } from "./manager-action-center";
import { StaffAvailabilityPanel } from "./staff-availability-panel";
import { ManagerAlertsPanel } from "./manager-alerts-panel";

export function ManagerTodayWorkspace({
  branchName,
  todayLabel,
  bookings,
  staff,
  userRole,
}: {
  branchName: string;
  todayLabel: string;
  bookings: TodayBooking[];
  staff: StaffAvailability[];
  userRole: string;
}) {
  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();

  const kpiData = computeKpiData(bookings, staff.length);
  const alerts = computeAlerts(bookings, nowMins);

  return (
    <div>
      <ManagerTodayHeader branchName={branchName} todayLabel={todayLabel} />

      <ManagerTodayKpiCards data={kpiData} />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 320px",
          gap: "1.25rem",
          alignItems: "start",
        }}
      >
        {/* Left column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <TodayTimelinePreview bookings={bookings} />
          <BookingsNeedingAction
            bookings={bookings}
            nowMins={nowMins}
            userRole={userRole}
          />
          <UpcomingBookings bookings={bookings} />
        </div>

        {/* Right rail */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <ManagerActionCenter />
          <StaffAvailabilityPanel staff={staff} />
          <ManagerAlertsPanel alerts={alerts} />
        </div>
      </div>
    </div>
  );
}
