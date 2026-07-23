"use client";

import { BarChart3, ClipboardList, QrCode, Smartphone, Timer } from "lucide-react";
import type { ComponentType } from "react";
import type { AttendanceActionResult } from "@/app/(dashboard)/crm/attendance/actions";
import { RegisteredDevicesTab } from "@/components/features/attendance/devices/registered-devices-tab";
import { QrCodesTab } from "@/components/features/attendance/qr-codes/qr-codes-tab";
import { AttendanceRecordsTab } from "@/components/features/attendance/records/attendance-records-tab";
import { AttendanceReportsTab } from "@/components/features/attendance/reports/attendance-reports-tab";
import { ServiceSessionsTab } from "@/components/features/attendance/sessions/service-sessions-tab";
import { ATTENDANCE_TOOLS, type AttendanceTool } from "@/lib/attendance/workspace-navigation";
import type {
  AttendanceRecordFilters,
  AttendanceTab,
  AttendanceWorkspaceData,
} from "@/lib/attendance/types";
import type { QrPrintFormat } from "@/lib/attendance/qr-print-layout";
import { cn } from "@/lib/utils";

const ICONS: Record<AttendanceTool, ComponentType<{ className?: string }>> = {
  history: ClipboardList,
  sessions: Timer,
  phones: Smartphone,
  qr: QrCode,
  reports: BarChart3,
};

export function AttendanceToolsView({
  data,
  activeTool,
  nowMs,
  initialRecordFilters,
  routeBasePath,
  routeBranchId,
  selectedQrId,
  selectedFormat,
  initialStaffId,
  onToolChange,
  onLegacyTabChange,
  onActionResult,
  onSelectedQrChange,
  onFormatChange,
}: {
  data: AttendanceWorkspaceData;
  activeTool: AttendanceTool;
  nowMs: number;
  initialRecordFilters?: AttendanceRecordFilters;
  routeBasePath?: string;
  routeBranchId?: string | null;
  selectedQrId: string | null;
  selectedFormat: QrPrintFormat;
  initialStaffId?: string | null;
  onToolChange: (tool: AttendanceTool) => void;
  onLegacyTabChange: (tab: AttendanceTab) => void;
  onActionResult: (result: AttendanceActionResult) => void;
  onSelectedQrChange: (id: string | null) => void;
  onFormatChange: (format: QrPrintFormat) => void;
}) {
  return (
    <div className="grid gap-4">
      <section
        aria-label="Attendance tools"
        role="tablist"
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"
      >
        {ATTENDANCE_TOOLS.map((tool) => {
          const Icon = ICONS[tool.key];
          const active = activeTool === tool.key;
          return (
            <button
              key={tool.key}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={`attendance-tool-panel-${tool.key}`}
              onClick={() => onToolChange(tool.key)}
              className={cn(
                "min-h-32 rounded-2xl border p-4 text-left shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sp-forest)]",
                active
                  ? "border-[var(--sp-forest)] bg-[var(--sp-forest)] text-white"
                  : "border-[var(--cs-border)] bg-white text-[var(--cs-text)] hover:border-[var(--sp-forest)]"
              )}
            >
              <span
                className={cn(
                  "flex size-9 items-center justify-center rounded-full",
                  active ? "bg-white/15" : "bg-[var(--cs-surface-warm)] text-[var(--sp-forest)]"
                )}
              >
                <Icon className="size-4" />
              </span>
              <span className="mt-3 block text-sm font-bold">{tool.label}</span>
              <span
                className={cn(
                  "mt-1 block text-xs leading-5",
                  active ? "text-white/75" : "text-[var(--cs-text-muted)]"
                )}
              >
                {tool.description}
              </span>
            </button>
          );
        })}
      </section>
      <section id="attendance-tool-panel-history" role="tabpanel" hidden={activeTool !== "history"}>
        <AttendanceRecordsTab
          key={`${initialRecordFilters?.staffId ?? "all"}-${initialRecordFilters?.date ?? "all"}`}
          data={data}
          initialFilters={initialRecordFilters}
          onTabChange={onLegacyTabChange}
        />
      </section>
      <section
        id="attendance-tool-panel-sessions"
        role="tabpanel"
        hidden={activeTool !== "sessions"}
      >
        <ServiceSessionsTab
          data={data}
          nowMs={nowMs}
          onActionResult={onActionResult}
          onTabChange={onLegacyTabChange}
        />
      </section>
      <section id="attendance-tool-panel-phones" role="tabpanel" hidden={activeTool !== "phones"}>
        <RegisteredDevicesTab
          key={initialStaffId ?? "all"}
          data={data}
          nowMs={nowMs}
          routeBasePath={routeBasePath}
          routeBranchId={routeBranchId}
          initialStaffId={initialStaffId}
        />
      </section>
      <section id="attendance-tool-panel-qr" role="tabpanel" hidden={activeTool !== "qr"}>
        <QrCodesTab
          data={data}
          nowMs={nowMs}
          selectedQrId={selectedQrId}
          selectedFormat={selectedFormat}
          onSelectedQrChange={onSelectedQrChange}
          onFormatChange={onFormatChange}
          onActionResult={onActionResult}
        />
      </section>
      <section id="attendance-tool-panel-reports" role="tabpanel" hidden={activeTool !== "reports"}>
        <AttendanceReportsTab data={data} />
      </section>
    </div>
  );
}
