"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { AttendanceHeader } from "@/components/features/attendance/attendance-header";
import { AttendanceTabContent } from "@/components/features/attendance/attendance-tab-content";
import { AttendanceTabs } from "@/components/features/attendance/attendance-tabs";
import { WorkspaceNotice } from "@/components/features/attendance/attendance-ui";
import { useAttendanceWorkspaceRealtime } from "@/components/features/attendance/use-attendance-workspace-realtime";
import {
  refreshAttendanceWorkspaceAction,
  type AttendanceActionResult,
} from "@/app/(dashboard)/crm/attendance/actions";
import { attendanceTabHref, isAttendanceTab } from "@/lib/attendance/tabs";
import type {
  AttendanceQrPoint,
  AttendanceRecordFilters,
  AttendanceTab,
  AttendanceWorkspaceData,
} from "@/lib/attendance/types";
import type { QrPrintFormat } from "@/lib/attendance/qr-print-layout";

type AttendanceWorkspaceProps = {
  data: AttendanceWorkspaceData;
  activeTab?: AttendanceTab;
  initialNavigation?: unknown;
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

type WorkspacePatch = Partial<Pick<AttendanceWorkspaceData, "qrPoints" | "devices" | "exceptions">>;

export function AttendanceWorkspace(props: AttendanceWorkspaceProps) {
  const { data, activeTab, initialNavigation, initialNowMs, routeBasePath, routeBranchId, flash } =
    props;
  const initialNavigationTab = (() => {
    if (typeof initialNavigation === "string" && isAttendanceTab(initialNavigation)) {
      return initialNavigation;
    }
    if (!initialNavigation || typeof initialNavigation !== "object") return null;

    const navigationRecord = initialNavigation as Record<string, unknown>;
    const candidate =
      navigationRecord.activeTab ?? navigationRecord.tab ?? navigationRecord.selectedTab;
    return typeof candidate === "string" && isAttendanceTab(candidate) ? candidate : null;
  })();
  const initialActiveTab: AttendanceTab = activeTab ?? initialNavigationTab ?? "overview";
  const {
    data: refreshedData,
    mutate: refreshAttendance,
    isValidating,
  } = useSWR(
    ["attendance-workspace", data.branchId],
    async () => {
      const result = await refreshAttendanceWorkspaceAction(routeBranchId ?? data.branchId);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    {
      fallbackData: data,
      keepPreviousData: true,
      revalidateOnFocus: false,
      revalidateOnMount: false,
    }
  );
  const serverData = refreshedData ?? data;
  const [localPatch, setLocalPatch] = useState<WorkspacePatch | null>(null);
  const [selectedTab, setSelectedTab] = useState<AttendanceTab>(initialActiveTab);
  const [mountedTabs, setMountedTabs] = useState<Set<AttendanceTab>>(
    () => new Set<AttendanceTab>([initialActiveTab])
  );
  const [nowMs, setNowMs] = useState(initialNowMs);
  const [selectedFormat, setSelectedFormat] = useState<QrPrintFormat>("a4");
  const [selectedQrId, setSelectedQrId] = useState<string | null>(data.qrPoints[0]?.id ?? null);
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(
    flash?.message ? { ok: flash.status === "ok", message: flash.message } : null
  );

  const workspaceData = useMemo<AttendanceWorkspaceData>(() => {
    if (!localPatch) return serverData;
    return {
      ...serverData,
      ...(localPatch.qrPoints && { qrPoints: localPatch.qrPoints }),
      ...(localPatch.devices && { devices: localPatch.devices }),
      ...(localPatch.exceptions && { exceptions: localPatch.exceptions }),
    };
  }, [localPatch, serverData]);
  const reviewCount = useMemo(
    () => workspaceData.exceptions.filter((exception) => exception.status === "open").length,
    [workspaceData.exceptions]
  );
  const activeQrId = useMemo(() => {
    if (selectedQrId && workspaceData.qrPoints.some((point) => point.id === selectedQrId)) {
      return selectedQrId;
    }
    return (
      workspaceData.qrPoints.find((point) => point.is_active)?.id ??
      workspaceData.qrPoints[0]?.id ??
      null
    );
  }, [selectedQrId, workspaceData.qrPoints]);

  const refreshFromServer = useCallback(() => {
    setLocalPatch(null);
    void refreshAttendance().catch((error: unknown) => {
      setNotice({
        ok: false,
        message: error instanceof Error ? error.message : "Attendance could not be refreshed.",
      });
    });
  }, [refreshAttendance]);
  useAttendanceWorkspaceRealtime({
    branchId: workspaceData.branchId,
    onRefresh: refreshFromServer,
  });

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  function setTab(nextTab: AttendanceTab) {
    setMountedTabs((current) => (current.has(nextTab) ? current : new Set(current).add(nextTab)));
    setSelectedTab(nextTab);
    window.history.replaceState(
      null,
      "",
      attendanceTabHref(nextTab, { basePath: routeBasePath, branchId: routeBranchId })
    );
  }

  async function handleManualRefresh() {
    try {
      setLocalPatch(null);
      await refreshAttendance();
      toast.success("Attendance refreshed.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Attendance could not be refreshed.");
    }
  }

  function upsertQrPoints(points: AttendanceQrPoint[]) {
    setLocalPatch((current) => {
      const byId = new Map(
        (current?.qrPoints ?? serverData.qrPoints).map((point) => [point.id, point])
      );
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
    } else if (result.kind === "room_qrs") {
      upsertQrPoints(result.qrPoints);
      if (result.qrPoints[0]) setSelectedQrId(result.qrPoints[0].id);
    } else if (result.kind === "device_revoked") {
      setLocalPatch((current) => ({
        ...current,
        devices: (current?.devices ?? serverData.devices).map((device) =>
          device.id === result.deviceId ? { ...device, status: "revoked" as const } : device
        ),
      }));
    } else if (result.kind === "exception_resolved") {
      setLocalPatch((current) => ({
        ...current,
        exceptions: (current?.exceptions ?? serverData.exceptions).map((exception) =>
          exception.id === result.exceptionId
            ? { ...exception, status: "resolved", resolved_at: new Date().toISOString() }
            : exception
        ),
      }));
    } else if (result.kind === "qr_deactivated") {
      setLocalPatch((current) => ({
        ...current,
        qrPoints: (current?.qrPoints ?? serverData.qrPoints).map((point) =>
          point.id === result.qrPointId ? { ...point, is_active: false } : point
        ),
      }));
    } else if (result.kind === "attendance_correction" || result.kind === "attendance_rules") {
      refreshFromServer();
    }
  }

  return (
    <div className="grid gap-4">
      <AttendanceHeader
        branchName={workspaceData.branchName}
        timezone={workspaceData.timezone}
        nowMs={nowMs}
        reviewCount={reviewCount}
        refreshing={isValidating}
        onRefresh={() => void handleManualRefresh()}
        onTabChange={setTab}
      />
      <section className="overflow-hidden rounded-[var(--cs-r-lg)] border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] shadow-[var(--cs-shadow-sm)]">
        <div className="border-b border-[var(--cs-border-soft)]">
          <AttendanceTabs activeTab={selectedTab} reviewCount={reviewCount} onTabChange={setTab} />
        </div>
        <div className="grid gap-4 p-3 sm:p-4 lg:p-5">
          {notice ? (
            <WorkspaceNotice tone={notice.ok ? "success" : "error"} className="font-semibold">
              {notice.message}
            </WorkspaceNotice>
          ) : null}
          <AttendanceTabContent
            data={workspaceData}
            selectedTab={selectedTab}
            mountedTabs={mountedTabs}
            nowMs={nowMs}
            initialRecordFilters={props.initialRecordFilters}
            activeQrId={activeQrId}
            selectedFormat={selectedFormat}
            routeBasePath={routeBasePath}
            routeBranchId={routeBranchId}
            onTabChange={setTab}
            onSelectedQrChange={setSelectedQrId}
            onFormatChange={setSelectedFormat}
            onActionResult={handleActionResult}
          />
        </div>
      </section>
    </div>
  );
}
