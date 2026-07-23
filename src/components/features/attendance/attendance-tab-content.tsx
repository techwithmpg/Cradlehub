"use client";

import type { ReactNode } from "react";
import { AttendanceTabPanel, EmptyState } from "@/components/features/attendance/attendance-ui";
import { RegisteredDevicesTab } from "@/components/features/attendance/devices/registered-devices-tab";
import { AttendanceOverview } from "@/components/features/attendance/overview/attendance-overview";
import { QrCodesTab } from "@/components/features/attendance/qr-codes/qr-codes-tab";
import { AttendanceRecordsTab } from "@/components/features/attendance/records/attendance-records-tab";
import { AttendanceRecoveryTab } from "@/components/features/attendance/recovery/attendance-recovery-tab";
import { AttendanceReportsTab } from "@/components/features/attendance/reports/attendance-reports-tab";
import { ServiceSessionsTab } from "@/components/features/attendance/sessions/service-sessions-tab";
import type { AttendanceActionResult } from "@/app/(dashboard)/crm/attendance/actions";
import { attendanceTabId, attendanceTabPanelId } from "@/lib/attendance/tabs";
import type {
  AttendanceRecordFilters,
  AttendanceTab,
  AttendanceWorkspaceData,
} from "@/lib/attendance/types";
import type { QrPrintFormat } from "@/lib/attendance/qr-print-layout";

type AttendanceTabContentProps = {
  data: AttendanceWorkspaceData;
  selectedTab: AttendanceTab;
  mountedTabs: Set<AttendanceTab>;
  nowMs: number;
  initialRecordFilters?: AttendanceRecordFilters;
  activeQrId: string | null;
  selectedFormat: QrPrintFormat;
  routeBasePath?: string;
  routeBranchId?: string | null;
  onTabChange: (tab: AttendanceTab) => void;
  onSelectedQrChange: (id: string | null) => void;
  onFormatChange: (format: QrPrintFormat) => void;
  onActionResult: (result: AttendanceActionResult) => void;
};

function Panel({
  tab,
  selectedTab,
  mountedTabs,
  children,
}: {
  tab: AttendanceTab;
  selectedTab: AttendanceTab;
  mountedTabs: Set<AttendanceTab>;
  children: ReactNode;
}) {
  if (!mountedTabs.has(tab)) return null;
  return (
    <AttendanceTabPanel
      id={attendanceTabPanelId(tab)}
      labelledBy={attendanceTabId(tab)}
      active={selectedTab === tab}
    >
      {children}
    </AttendanceTabPanel>
  );
}

export function AttendanceTabContent(props: AttendanceTabContentProps) {
  const { data, selectedTab, mountedTabs, nowMs, onTabChange, onActionResult } = props;

  return (
    <>
      <Panel tab="overview" selectedTab={selectedTab} mountedTabs={mountedTabs}>
        <AttendanceOverview data={data} nowMs={nowMs} onTabChange={onTabChange} />
      </Panel>
      <Panel tab="exceptions" selectedTab={selectedTab} mountedTabs={mountedTabs}>
        <AttendanceRecoveryTab
          data={data}
          onActionResult={onActionResult}
          onTabChange={onTabChange}
        />
      </Panel>
      <Panel tab="records" selectedTab={selectedTab} mountedTabs={mountedTabs}>
        <AttendanceRecordsTab
          data={data}
          initialFilters={props.initialRecordFilters}
          onTabChange={onTabChange}
        />
      </Panel>
      <Panel tab="sessions" selectedTab={selectedTab} mountedTabs={mountedTabs}>
        <ServiceSessionsTab
          data={data}
          nowMs={nowMs}
          onActionResult={onActionResult}
          onTabChange={onTabChange}
        />
      </Panel>
      <Panel tab="qr" selectedTab={selectedTab} mountedTabs={mountedTabs}>
        <QrCodesTab
          data={data}
          nowMs={nowMs}
          selectedQrId={props.activeQrId}
          selectedFormat={props.selectedFormat}
          onSelectedQrChange={props.onSelectedQrChange}
          onFormatChange={props.onFormatChange}
          onActionResult={onActionResult}
        />
      </Panel>
      <Panel tab="devices" selectedTab={selectedTab} mountedTabs={mountedTabs}>
        <RegisteredDevicesTab
          data={data}
          nowMs={nowMs}
          routeBasePath={props.routeBasePath}
          routeBranchId={props.routeBranchId}
        />
      </Panel>
      <Panel tab="reports" selectedTab={selectedTab} mountedTabs={mountedTabs}>
        <AttendanceReportsTab data={data} />
      </Panel>
      {data.staffOptions.length === 0 ? (
        <EmptyState
          title="No active staff loaded"
          detail="Attendance needs active branch staff before live status can be useful."
        />
      ) : null}
    </>
  );
}
