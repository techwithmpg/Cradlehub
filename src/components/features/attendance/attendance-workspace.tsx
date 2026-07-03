"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AttendanceHeader } from "@/components/features/attendance/attendance-header";
import { AttendanceTabs } from "@/components/features/attendance/attendance-tabs";
import { EmptyState } from "@/components/features/attendance/attendance-ui";
import { RegisteredDevicesTab } from "@/components/features/attendance/devices/registered-devices-tab";
import { AttendanceExceptionsTab } from "@/components/features/attendance/exceptions/attendance-exceptions-tab";
import { AttendanceOverview } from "@/components/features/attendance/overview/attendance-overview";
import { QrCodesTab } from "@/components/features/attendance/qr-codes/qr-codes-tab";
import { AttendanceRecordsTab } from "@/components/features/attendance/records/attendance-records-tab";
import { AttendanceReportsTab } from "@/components/features/attendance/reports/attendance-reports-tab";
import { ServiceSessionsTab } from "@/components/features/attendance/sessions/service-sessions-tab";
import type { AttendanceActionResult } from "@/app/(dashboard)/crm/attendance/actions";
import { attendanceTabHref } from "@/lib/attendance/tabs";
import type {
  AttendanceQrPoint,
  AttendanceRecordFilters,
  AttendanceTab,
  AttendanceWorkspaceData,
} from "@/lib/attendance/types";
import type { QrPrintFormat } from "@/lib/attendance/qr-print-layout";

type AttendanceWorkspaceProps = {
  data: AttendanceWorkspaceData;
  activeTab: AttendanceTab;
  initialRecordFilters?: AttendanceRecordFilters;
  routeBasePath?: string;
  routeBranchId?: string | null;
  flash?: {
    status?: string | null;
    message?: string | null;
    activationUrl?: string | null;
    expiresAt?: string | null;
  };
};

export function AttendanceWorkspace({
  data,
  activeTab,
  initialRecordFilters,
  routeBasePath,
  routeBranchId,
  flash,
}: AttendanceWorkspaceProps) {
  const [workspaceData, setWorkspaceData] = useState(data);
  const [selectedTab, setSelectedTab] = useState<AttendanceTab>(activeTab);
  const [selectedFormat, setSelectedFormat] = useState<QrPrintFormat>("a4");
  const [selectedQrId, setSelectedQrId] = useState<string | null>(() => data.qrPoints[0]?.id ?? null);
  const [activation, setActivation] = useState<{ activationUrl: string; expiresAt: string } | null>(
    flash?.activationUrl && flash.expiresAt ? { activationUrl: flash.activationUrl, expiresAt: flash.expiresAt } : null
  );
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(() =>
    flash?.message ? { ok: flash.status === "ok", message: flash.message } : null
  );

  const activeQrId = useMemo(() => {
    if (selectedQrId && workspaceData.qrPoints.some((point) => point.id === selectedQrId)) return selectedQrId;
    return workspaceData.qrPoints.find((point) => point.is_active)?.id ?? workspaceData.qrPoints[0]?.id ?? null;
  }, [selectedQrId, workspaceData.qrPoints]);

  function setTab(nextTab: AttendanceTab) {
    setSelectedTab(nextTab);
    window.history.replaceState(
      null,
      "",
      attendanceTabHref(nextTab, {
        basePath: routeBasePath,
        branchId: routeBranchId,
      })
    );
  }

  function upsertQrPoints(points: AttendanceQrPoint[]) {
    setWorkspaceData((current) => {
      const byId = new Map(current.qrPoints.map((point) => [point.id, point]));
      for (const point of points) byId.set(point.id, point);
      return { ...current, qrPoints: Array.from(byId.values()) };
    });
  }

  function handleActionResult(result: AttendanceActionResult) {
    setNotice({ ok: result.ok, message: result.message });
    if (result.ok) toast.success(result.message);
    else toast.error(result.message);
    if (!result.ok) return;

    setTab(result.tab);
    if (result.kind === "attendance_qr") {
      upsertQrPoints([result.qrPoint]);
      setSelectedQrId(result.qrPoint.id);
    }
    if (result.kind === "room_qrs") {
      upsertQrPoints(result.qrPoints);
      if (result.qrPoints[0]) setSelectedQrId(result.qrPoints[0].id);
    }
    if (result.kind === "activation") {
      setActivation({ activationUrl: result.activationUrl, expiresAt: result.expiresAt });
    }
    if (result.kind === "device_revoked") {
      setWorkspaceData((current) => ({
        ...current,
        devices: current.devices.map((device) =>
          device.id === result.deviceId ? { ...device, status: "revoked" } : device
        ),
      }));
    }
    if (result.kind === "exception_resolved") {
      setWorkspaceData((current) => ({
        ...current,
        exceptions: current.exceptions.map((exception) =>
          exception.id === result.exceptionId
            ? { ...exception, status: "resolved", resolved_at: new Date().toISOString() }
            : exception
        ),
      }));
    }
    if (result.kind === "qr_deactivated") {
      setWorkspaceData((current) => ({
        ...current,
        qrPoints: current.qrPoints.map((point) =>
          point.id === result.qrPointId ? { ...point, is_active: false } : point
        ),
      }));
    }
  }

  return (
    <div className="grid gap-5">
      <AttendanceHeader branchName={workspaceData.branchName} onTabChange={setTab} />
      <AttendanceTabs activeTab={selectedTab} onTabChange={setTab} />
      {notice ? (
        <div
          aria-live="polite"
          className={`rounded-lg border px-4 py-3 text-sm font-semibold ${notice.ok ? "border-emerald-800/20 bg-emerald-50 text-emerald-900" : "border-red-700/20 bg-red-50 text-red-800"}`}
        >
          {notice.message}
        </div>
      ) : null}

      <section role="tabpanel" hidden={selectedTab !== "overview"}>
        <AttendanceOverview data={workspaceData} onTabChange={setTab} />
      </section>
      <section role="tabpanel" hidden={selectedTab !== "records"}>
        <AttendanceRecordsTab data={workspaceData} initialFilters={initialRecordFilters} />
      </section>
      <section role="tabpanel" hidden={selectedTab !== "sessions"}>
        <ServiceSessionsTab data={workspaceData} onActionResult={handleActionResult} />
      </section>
      <section role="tabpanel" hidden={selectedTab !== "qr"}>
        <QrCodesTab
          data={workspaceData}
          selectedQrId={activeQrId}
          selectedFormat={selectedFormat}
          onSelectedQrChange={setSelectedQrId}
          onFormatChange={setSelectedFormat}
          onActionResult={handleActionResult}
        />
      </section>
      <section role="tabpanel" hidden={selectedTab !== "devices"}>
        <RegisteredDevicesTab data={workspaceData} activation={activation} onActionResult={handleActionResult} />
      </section>
      <section role="tabpanel" hidden={selectedTab !== "exceptions"}>
        <AttendanceExceptionsTab data={workspaceData} onActionResult={handleActionResult} />
      </section>
      <section role="tabpanel" hidden={selectedTab !== "reports"}>
        <AttendanceReportsTab data={workspaceData} />
      </section>
      {workspaceData.staffOptions.length === 0 ? (
        <EmptyState title="No active staff loaded." detail="Attendance needs active branch staff before live status can be useful." />
      ) : null}
    </div>
  );
}
