"use client";

import { SessionsPage } from "@/components/features/attendance/sessions/sessions-page";
import type { AttendanceActionResult } from "@/app/(dashboard)/crm/attendance/actions";
import type { AttendanceTab, AttendanceWorkspaceData } from "@/lib/attendance/types";

export function ServiceSessionsTab({
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
    <SessionsPage
      data={data}
      nowMs={nowMs}
      onActionResult={onActionResult}
      onTabChange={onTabChange}
    />
  );
}
