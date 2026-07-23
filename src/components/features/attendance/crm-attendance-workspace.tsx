"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { refreshCrmAttendanceWorkspaceAction } from "@/app/(dashboard)/crm/attendance/actions";
import { CrmAttendanceHeader } from "@/components/features/attendance/crm-attendance-header";
import { CrmAttendanceNavigation } from "@/components/features/attendance/crm-attendance-navigation";
import { AttendanceStaffDrawer } from "@/components/features/attendance/attendance-staff-drawer";
import { WorkspaceNotice } from "@/components/features/attendance/attendance-ui";
import { AttendanceHistoryView } from "@/components/features/attendance/history/attendance-history-view";
import { AttendanceReviewView } from "@/components/features/attendance/review/attendance-review-view";
import { AttendanceSetupView } from "@/components/features/attendance/setup/attendance-setup-view";
import { AttendanceTodayView } from "@/components/features/attendance/today/attendance-today-view";
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
} from "@/lib/attendance/crm-review";
import {
  buildAttendanceStaffDiagnostics,
  type AttendanceStaffDiagnostic,
} from "@/lib/attendance/staff-diagnostics";
import type { AttendanceIssueAction } from "@/lib/attendance/issue-presentation-types";
import type { AttendanceWorkspaceData } from "@/lib/attendance/types";

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
  const [selectedStaff, setSelectedStaff] = useState<AttendanceStaffDiagnostic | null>(null);
  const [nowMs, setNowMs] = useState(data.serverNowMs);
  const {
    data: current = data,
    mutate,
    isValidating,
  } = useSWR(
    ["crm-attendance-workspace", data.branchId],
    async () => {
      const result = await refreshCrmAttendanceWorkspaceAction();
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    { fallbackData: data, revalidateOnFocus: false, revalidateOnMount: false }
  );
  const reviewItems = useMemo(
    () => buildAttendanceReviewItems(current.exceptions),
    [current.exceptions]
  );
  const staffRows = useMemo(
    () => applyCanonicalReviewToStaff(buildAttendanceStaffDiagnostics(current), reviewItems),
    [current, reviewItems]
  );
  const refresh = useCallback(() => {
    void mutate().catch((error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Attendance could not be refreshed.")
    );
  }, [mutate]);
  useAttendanceWorkspaceRealtime({ branchId: current.branchId, onRefresh: refresh });
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
  function handleStaffAction(action: AttendanceIssueAction, row: AttendanceStaffDiagnostic) {
    setSelectedStaff(null);
    if (action.id === "manage_phone") return openPhones(row.staff.staffId);
    if (action.id === "view_attendance_history") return updateNavigation("history");
    const incident = reviewItems.find((item) => item.exception.staff_id === row.staff.staffId);
    if (incident) updateNavigation("review");
    else updateNavigation("history");
  }

  return (
    <div className="grid gap-4">
      <CrmAttendanceHeader
        branchName={current.branchName}
        timezone={current.timezone}
        businessDate={current.businessDate}
        nowMs={nowMs}
        refreshing={isValidating}
        onRefresh={refresh}
      />
      <section className="overflow-hidden rounded-[var(--cs-r-lg)] border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] shadow-[var(--cs-shadow-sm)]">
        <CrmAttendanceNavigation
          activeView={view}
          reviewCount={reviewItems.length}
          onChange={(next) => updateNavigation(next)}
        />
        <div className="grid gap-4 p-3 sm:p-4 lg:p-5">
          {flash?.message ? (
            <WorkspaceNotice tone={flash.status === "ok" ? "success" : "error"}>
              {flash.message}
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
                onOpen={setSelectedStaff}
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
      <AttendanceStaffDrawer
        data={current}
        row={selectedStaff}
        onClose={() => setSelectedStaff(null)}
        onAction={handleStaffAction}
      />
    </div>
  );
}
