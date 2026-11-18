"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useGenerationAwareWorkspaceSWR } from "@/components/features/dashboard/use-workspace-generation";
import { refreshCrmAttendanceWorkspaceAction } from "@/app/(dashboard)/crm/attendance/actions";
import {
  AttendanceCorrectionModal,
  type AttendanceCorrectionModalTarget,
} from "@/components/features/attendance/attendance-correction-modal";
import { CrmAttendanceHeader } from "@/components/features/attendance/crm-attendance-header";
import { CrmAttendanceNavigation } from "@/components/features/attendance/crm-attendance-navigation";
import { WorkspaceNotice } from "@/components/features/attendance/attendance-ui";
import { AttendanceHistoryView } from "@/components/features/attendance/history/attendance-history-view";
import { AttendanceIssueModalRouter } from "@/components/features/attendance/review/attendance-issue-modal-router";
import { AttendanceReviewView } from "@/components/features/attendance/review/attendance-review-view";
import { AttendanceSetupView } from "@/components/features/attendance/setup/attendance-setup-view";
import { AttendanceTodayView } from "@/components/features/attendance/today/attendance-today-view";
import { AttendanceTestModeBanner } from "@/components/features/attendance/attendance-test-mode-banner";
import { useAttendanceWorkspaceRealtime } from "@/components/features/attendance/use-attendance-workspace-realtime";
import {
  crmAttendanceHref,
  crmAttendancePanelId,
  crmAttendanceTabId,
  type AttendanceSetupSection,
  type CrmAttendanceNavigation as CrmAttendanceNavigationState,
  type CrmAttendanceView,
} from "@/lib/attendance/crm-navigation";
import {
  applyCanonicalReviewToStaff,
  buildAttendanceReviewItems,
  type AttendanceReviewItem,
} from "@/lib/attendance/crm-review";
import { buildAttendanceStaffDiagnostics } from "@/lib/attendance/staff-diagnostics";
import { matchTodayReviewItemForStaffRow } from "@/lib/attendance/crm-attendance-presenter";
import type { AttendanceWorkspaceData } from "@/lib/attendance/types";
import {
  mergeAttendanceWorkspaceCheckin,
  type AttendanceCheckinRealtimeRow,
} from "@/lib/attendance/attendance-workspace-realtime-merge";

export function CrmAttendanceWorkspace({
  data,
  initialNavigation,
  initialStaffId,
  flash,
}: {
  data: AttendanceWorkspaceData;
  initialNavigation: CrmAttendanceNavigationState;
  initialStaffId?: string | null;
  flash?: { status?: string | null; message?: string | null };
}) {
  const [view, setView] = useState<CrmAttendanceView>(initialNavigation.view);
  const [section, setSection] = useState<AttendanceSetupSection>(initialNavigation.section);
  const [phoneStaffId, setPhoneStaffId] = useState(initialStaffId ?? null);
  const [modalTarget, setModalTarget] = useState<AttendanceCorrectionModalTarget | null>(null);
  const [fullIssueItem, setFullIssueItem] = useState<AttendanceReviewItem | null>(null);
  const [nowMs, setNowMs] = useState(data.serverNowMs);

  const attendanceFetcher = useCallback(async () => {
    const result = await refreshCrmAttendanceWorkspaceAction();
    if (!result.ok) throw new Error(result.error);
    return result.data;
  }, []);

  const {
    data: authoritativeData,
    error: refreshError,
    generation,
    revalidate,
  } = useGenerationAwareWorkspaceSWR<AttendanceWorkspaceData>(
    "crm-attendance",
    "/crm/attendance",
    attendanceFetcher,
    data
  );

  const authoritativeWorkspace = authoritativeData ?? data;
  const [tacticalWorkspace, setTacticalWorkspace] = useState<AttendanceWorkspaceData | null>(null);
  const [prevAuthoritativeWorkspace, setPrevAuthoritativeWorkspace] =
    useState(authoritativeWorkspace);
  if (prevAuthoritativeWorkspace !== authoritativeWorkspace) {
    setPrevAuthoritativeWorkspace(authoritativeWorkspace);
    setTacticalWorkspace(null);
  }

  const current = tacticalWorkspace ?? authoritativeWorkspace;
  const reviewItems = useMemo(
    () => buildAttendanceReviewItems(current.exceptions),
    [current.exceptions]
  );
  const staffRows = useMemo(
    () => applyCanonicalReviewToStaff(buildAttendanceStaffDiagnostics(current), reviewItems),
    [current, reviewItems]
  );
  const unscannedCount = useMemo(
    () =>
      current.dailyStaffStates.filter(
        (r) => !r.clockInAt && Boolean(r.scheduledStart && !r.clockOutAt)
      ).length,
    [current.dailyStaffStates]
  );

  const invalidateAttendance = useCallback(() => {
    generation.store?.invalidate("crm-attendance");
  }, [generation.store]);

  const refresh = useCallback(() => {
    setTacticalWorkspace(null);
    void revalidate().catch((error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Attendance could not be refreshed.")
    );
  }, [revalidate]);

  const handleCheckinChange = useCallback(
    (row: AttendanceCheckinRealtimeRow) => {
      const patched = mergeAttendanceWorkspaceCheckin(current, row);
      if (patched !== current) {
        setTacticalWorkspace(patched);
      } else {
        invalidateAttendance();
      }
    },
    [current, invalidateAttendance]
  );

  useAttendanceWorkspaceRealtime({
    branchId: current.branchId,
    onCheckinChange: handleCheckinChange,
    onRefresh: invalidateAttendance,
  });

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  function updateNavigation(nextView: CrmAttendanceView, nextSection = section) {
    setView(nextView);
    setSection(nextSection);
    window.history.replaceState(
      null,
      "",
      crmAttendanceHref(
        { view: nextView, section: nextSection },
        new URLSearchParams(window.location.search)
      )
    );
  }

  function openPhones(staffId: string | null) {
    setPhoneStaffId(staffId);
    updateNavigation("setup", "phones");
  }

  return (
    <div className="grid gap-4">
      <CrmAttendanceHeader
        branchName={current.branchName}
        timezone={current.timezone}
        businessDate={current.businessDate}
        nowMs={nowMs}
        activeView={view}
        unscannedCount={unscannedCount}
        refreshing={generation.isRefreshing}
        onRefresh={refresh}
      />

      {current.settings.test_mode_enabled ? (
        <AttendanceTestModeBanner reason={current.settings.test_mode_reason} />
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-[var(--cs-border-soft)] bg-[#F7F5F0] shadow-xs">
        <CrmAttendanceNavigation
          activeView={view}
          reviewCount={reviewItems.length}
          onChange={(next) => updateNavigation(next)}
        />

        <div className="@container grid min-w-0 gap-4 p-3.5 sm:p-5">
          {flash?.message ? (
            <WorkspaceNotice tone={flash.status === "ok" ? "success" : "error"}>
              {flash.message}
            </WorkspaceNotice>
          ) : null}

          {refreshError ? (
            <WorkspaceNotice tone="error">
              Attendance could not refresh. Showing the last validated workspace data.
            </WorkspaceNotice>
          ) : null}

          <div
            id={crmAttendancePanelId(view)}
            role="tabpanel"
            aria-labelledby={crmAttendanceTabId(view)}
          >
            {view === "today" ? (
              <AttendanceTodayView
                data={current}
                rows={staffRows}
                reviewItems={reviewItems}
                onOpen={(row) => {
                  const matchedReview = matchTodayReviewItemForStaffRow({
                    row,
                    reviewItems,
                    records: current.records,
                    exceptionRecords: current.exceptionRecords,
                    businessDate: current.businessDate,
                    timezone: current.timezone,
                  });
                  setModalTarget({ kind: "staff", row, reviewItem: matchedReview });
                }}
                onOpenReviewItem={(item) => {
                  const matchedRow =
                    staffRows.find((r) => r.staff.staffId === item.exception.staff_id) ?? null;
                  setModalTarget({ kind: "review", item, row: matchedRow });
                }}
                onOpenAllReview={() => updateNavigation("review")}
                onOpenHistory={() => updateNavigation("history")}
                onOpenPhone={(row) => openPhones(row?.staff.staffId ?? null)}
              />
            ) : null}

            {view === "review" ? (
              <AttendanceReviewView
                data={current}
                items={reviewItems}
                onRefresh={refresh}
                onManagePhone={openPhones}
              />
            ) : null}

            {view === "history" ? (
              <AttendanceHistoryView workspace={current} onRefresh={refresh} />
            ) : null}

            {view === "setup" ? (
              <AttendanceSetupView
                data={current}
                section={section}
                initialStaffId={phoneStaffId}
                onSectionChange={(next) => updateNavigation("setup", next)}
                onRefresh={refresh}
              />
            ) : null}
          </div>
        </div>
      </section>

      <AttendanceCorrectionModal
        data={current}
        target={modalTarget}
        onClose={() => setModalTarget(null)}
        onSaved={refresh}
        onOpenHistory={() => updateNavigation("history")}
        onOpenPhone={openPhones}
        onOpenFullIssueDialog={(item) => setFullIssueItem(item)}
      />

      <AttendanceIssueModalRouter
        data={current}
        item={fullIssueItem}
        onClose={() => setFullIssueItem(null)}
        onRefresh={refresh}
        onManagePhone={openPhones}
      />
    </div>
  );
}
