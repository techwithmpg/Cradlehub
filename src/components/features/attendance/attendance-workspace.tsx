"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AttendanceHeader } from "@/components/features/attendance/attendance-header";
import { AttendanceTabs } from "@/components/features/attendance/attendance-tabs";
import {
  AttendanceTabPanel,
  EmptyState,
  WorkspaceNotice,
} from "@/components/features/attendance/attendance-ui";
import { RegisteredDevicesTab } from "@/components/features/attendance/devices/registered-devices-tab";
import { AttendanceOverview } from "@/components/features/attendance/overview/attendance-overview";
import { QrCodesTab } from "@/components/features/attendance/qr-codes/qr-codes-tab";
import { AttendanceRecordsTab } from "@/components/features/attendance/records/attendance-records-tab";
import { AttendanceRecoveryTab } from "@/components/features/attendance/recovery/attendance-recovery-tab";
import { AttendanceReportsTab } from "@/components/features/attendance/reports/attendance-reports-tab";
import { ServiceSessionsTab } from "@/components/features/attendance/sessions/service-sessions-tab";
import { createClient } from "@/lib/supabase/client";
import type { AttendanceActionResult } from "@/app/(dashboard)/crm/attendance/actions";
import { attendanceTabHref, attendanceTabId, attendanceTabPanelId } from "@/lib/attendance/tabs";
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
  initialNowMs: number;
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

type WorkspacePatch = Partial<
  Pick<AttendanceWorkspaceData, "qrPoints" | "devices" | "exceptions">
>;

export function AttendanceWorkspace({
  data,
  activeTab,
  initialNowMs,
  initialRecordFilters,
  routeBasePath,
  routeBranchId,
  flash,
}: AttendanceWorkspaceProps) {
  const router = useRouter();
  const [localPatch, setLocalPatch] = useState<WorkspacePatch | null>(null);
  const [selectedTab, setSelectedTab] = useState<AttendanceTab>(activeTab);
  const [nowMs, setNowMs] = useState(() => initialNowMs);
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<QrPrintFormat>("a4");
  const [selectedQrId, setSelectedQrId] = useState<string | null>(() => data.qrPoints[0]?.id ?? null);
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(() =>
    flash?.message ? { ok: flash.status === "ok", message: flash.message } : null
  );

  // Merge server-rendered data with local optimistic patches. This keeps the UI
  // in sync when router.refresh() or realtime updates push new props, while
  // preserving local mutations (QR generation, device revocation, etc.).
  const workspaceData = useMemo<AttendanceWorkspaceData>(() => {
    if (!localPatch) return data;
    return {
      ...data,
      ...(localPatch.qrPoints && { qrPoints: localPatch.qrPoints }),
      ...(localPatch.devices && { devices: localPatch.devices }),
      ...(localPatch.exceptions && { exceptions: localPatch.exceptions }),
    };
  }, [data, localPatch]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const activeQrId = useMemo(() => {
    if (selectedQrId && workspaceData.qrPoints.some((point) => point.id === selectedQrId)) return selectedQrId;
    return workspaceData.qrPoints.find((point) => point.is_active)?.id ?? workspaceData.qrPoints[0]?.id ?? null;
  }, [selectedQrId, workspaceData.qrPoints]);

  useEffect(() => {
    const branchId = workspaceData.branchId;
    if (!branchId) return;

    const supabase = createClient();
    const channel = supabase.channel(`attendance-workspace-${branchId}`);
    const filter = `branch_id=eq.${branchId}`;

    function scheduleRefresh() {
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = setTimeout(() => {
        router.refresh();
      }, 500);
    }

    const tables = [
      "staff_shift_checkins",
      "qr_scan_events",
      "attendance_exceptions",
      "attendance_corrections",
      "staff_devices",
      "bookings",
    ] as const;

    for (const table of tables) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter },
        scheduleRefresh
      );
    }

    channel.subscribe();

    return () => {
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
      void supabase.removeChannel(channel);
    };
  }, [router, workspaceData.branchId]);

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
    setLocalPatch((current) => {
      const base = current?.qrPoints ?? data.qrPoints;
      const byId = new Map(base.map((point) => [point.id, point]));
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
    if (result.kind === "device_revoked") {
      setLocalPatch((current) => ({
        ...current,
        devices: (current?.devices ?? data.devices).map((device) =>
          device.id === result.deviceId ? { ...device, status: "revoked" as const } : device
        ),
      }));
    }
    if (result.kind === "exception_resolved") {
      setLocalPatch((current) => ({
        ...current,
        exceptions: (current?.exceptions ?? data.exceptions).map((exception) =>
          exception.id === result.exceptionId
            ? { ...exception, status: "resolved", resolved_at: new Date().toISOString() }
            : exception
        ),
      }));
    }
    if (result.kind === "qr_deactivated") {
      setLocalPatch((current) => ({
        ...current,
        qrPoints: (current?.qrPoints ?? data.qrPoints).map((point) =>
          point.id === result.qrPointId ? { ...point, is_active: false } : point
        ),
      }));
    }
    if (result.kind === "attendance_correction" || result.kind === "attendance_rules") {
      router.refresh();
    }
  }

  return (
    <div className="grid gap-5">
      <AttendanceHeader branchName={workspaceData.branchName} nowMs={nowMs} onTabChange={setTab} />
      <AttendanceTabs activeTab={selectedTab} onTabChange={setTab} />
      {notice ? (
        <WorkspaceNotice tone={notice.ok ? "success" : "error"} className="font-semibold">
          {notice.message}
        </WorkspaceNotice>
      ) : null}

      <AttendanceTabPanel
        id={attendanceTabPanelId("overview")}
        labelledBy={attendanceTabId("overview")}
        active={selectedTab === "overview"}
      >
        <AttendanceOverview data={workspaceData} nowMs={nowMs} onTabChange={setTab} />
      </AttendanceTabPanel>
      <AttendanceTabPanel
        id={attendanceTabPanelId("records")}
        labelledBy={attendanceTabId("records")}
        active={selectedTab === "records"}
      >
        <AttendanceRecordsTab data={workspaceData} initialFilters={initialRecordFilters} onTabChange={setTab} />
      </AttendanceTabPanel>
      <AttendanceTabPanel
        id={attendanceTabPanelId("sessions")}
        labelledBy={attendanceTabId("sessions")}
        active={selectedTab === "sessions"}
      >
        <ServiceSessionsTab
          data={workspaceData}
          nowMs={nowMs}
          onActionResult={handleActionResult}
          onTabChange={setTab}
        />
      </AttendanceTabPanel>
      <AttendanceTabPanel
        id={attendanceTabPanelId("qr")}
        labelledBy={attendanceTabId("qr")}
        active={selectedTab === "qr"}
      >
        <QrCodesTab
          data={workspaceData}
          nowMs={nowMs}
          selectedQrId={activeQrId}
          selectedFormat={selectedFormat}
          onSelectedQrChange={setSelectedQrId}
          onFormatChange={setSelectedFormat}
          onActionResult={handleActionResult}
        />
      </AttendanceTabPanel>
      <AttendanceTabPanel
        id={attendanceTabPanelId("devices")}
        labelledBy={attendanceTabId("devices")}
        active={selectedTab === "devices"}
      >
        <RegisteredDevicesTab
          data={workspaceData}
          nowMs={nowMs}
          routeBasePath={routeBasePath}
          routeBranchId={routeBranchId}
        />
      </AttendanceTabPanel>
      <AttendanceTabPanel
        id={attendanceTabPanelId("exceptions")}
        labelledBy={attendanceTabId("exceptions")}
        active={selectedTab === "exceptions"}
      >
        <AttendanceRecoveryTab data={workspaceData} onActionResult={handleActionResult} onTabChange={setTab} />
      </AttendanceTabPanel>
      <AttendanceTabPanel
        id={attendanceTabPanelId("reports")}
        labelledBy={attendanceTabId("reports")}
        active={selectedTab === "reports"}
      >
        <AttendanceReportsTab data={workspaceData} />
      </AttendanceTabPanel>
      {workspaceData.staffOptions.length === 0 ? (
        <EmptyState title="No active staff loaded." detail="Attendance needs active branch staff before live status can be useful." />
      ) : null}
    </div>
  );
}
