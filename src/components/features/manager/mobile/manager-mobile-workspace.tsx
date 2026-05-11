"use client";

import { useState } from "react";
import { ManagerBottomNav } from "./manager-bottom-nav";
import { ManagerTodayScreen } from "./manager-today-screen";
import { ManagerScheduleScreen } from "./manager-schedule-screen";
import { ManagerBookingsScreen } from "./manager-bookings-screen";
import { ManagerStaffScreen } from "./manager-staff-screen";
import { ManagerApprovalsScreen } from "./manager-approvals-screen";
import { ManagerMoreScreen } from "./manager-more-screen";
import type { MobileTab, MobileManagerData } from "./types";

export function ManagerMobileWorkspace(data: MobileManagerData) {
  const [tab, setTab] = useState<MobileTab>("today");

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        paddingBottom: 96,
        background: "var(--cs-bg)",
      }}
    >
      <main style={{ flex: 1, padding: "12px 12px 0" }}>
        {tab === "today" && <ManagerTodayScreen {...data} />}
        {tab === "schedule" && <ManagerScheduleScreen {...data} />}
        {tab === "bookings" && <ManagerBookingsScreen {...data} />}
        {tab === "staff" && <ManagerStaffScreen {...data} />}
        {tab === "approvals" && <ManagerApprovalsScreen {...data} />}
        {tab === "more" && <ManagerMoreScreen {...data} />}
      </main>

      <ManagerBottomNav active={tab} onChange={setTab} />
    </div>
  );
}
