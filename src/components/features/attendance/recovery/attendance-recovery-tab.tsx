"use client";

import { useMemo, useState, useTransition } from "react";
import { CalendarDays, DoorOpen } from "lucide-react";
import {
  applyAttendanceCorrectionAction,
  askStaffAboutAttendanceIssueAction,
  escalateAttendanceIssueAction,
  reviewAttendanceExceptionAction,
  updateAttendanceRulesAction,
  type AttendanceActionResult,
} from "@/app/(dashboard)/crm/attendance/actions";
import { RecoveryAuditLogPanel } from "@/components/features/attendance/recovery/recovery-audit-log-panel";
import { RecoveryIssueQueue } from "@/components/features/attendance/recovery/recovery-issue-queue";
import { RulesSafetyPanel } from "@/components/features/attendance/recovery/rules-safety-panel";
import { SelectedRecoveryIssuePanel } from "@/components/features/attendance/recovery/selected-recovery-issue-panel";
import { StaffDayRepairPanel } from "@/components/features/attendance/recovery/staff-day-repair-panel";
import {
  buildRecoveryIssues,
  countRecoveryIssues,
} from "@/components/features/attendance/recovery/recovery-issue-utils";
import { ContextChip, WorkspaceSection } from "@/components/features/attendance/attendance-ui";
import type {
  RecoveryIssue,
  RecoveryIssueCategory,
  RecoveryView,
} from "@/components/features/attendance/recovery/recovery-issue-types";
import type {
  AttendanceRecord,
  AttendanceSettings,
  AttendanceTab,
  AttendanceWorkspaceData,
} from "@/lib/attendance/types";

const RECOVERY_VIEWS: Array<{
  key: RecoveryView;
  label: string;
}> = [
  { key: "today", label: "Review Queue" },
  { key: "device_recovery", label: "Device Recovery" },
  { key: "staff_day_repair", label: "Staff Day Repair" },
  { key: "rules_safety", label: "Rules & Safety" },
  { key: "audit_log", label: "Audit Log" },
];

export function AttendanceRecoveryTab({
  data,
  onActionResult,
  onTabChange,
}: {
  data: AttendanceWorkspaceData;
  onActionResult: (result: AttendanceActionResult) => void;
  onTabChange: (tab: AttendanceTab) => void;
}) {
  const [view, setView] = useState<RecoveryView>("today");
  const [activeCategory, setActiveCategory] = useState<RecoveryIssueCategory | "all">("all");
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [reason, setReason] = useState("Attendance recovery correction.");
  const [notes, setNotes] = useState("");
  const [rules, setRules] = useState<AttendanceSettings>(data.settings);
  const [rulesReason, setRulesReason] = useState(
    data.settings.test_mode_reason ?? data.settings.launch_recovery_reason ?? ""
  );
  const [isPending, startTransition] = useTransition();

  const allIssues = useMemo(() => {
    return buildRecoveryIssues(data);
  }, [data]);

  const counts = useMemo(() => countRecoveryIssues(allIssues), [allIssues]);

  const visibleIssues = useMemo(() => {
    if (view === "device_recovery") {
      return allIssues.filter((issue) => issue.category === "device_access");
    }

    if (view === "staff_day_repair") {
      return allIssues.filter((issue) => issue.category === "staff_day_repair");
    }

    if (view === "rules_safety") {
      return allIssues.filter((issue) => issue.category === "rules_safety");
    }

    if (activeCategory === "all") return allIssues;

    return allIssues.filter((issue) => issue.category === activeCategory);
  }, [activeCategory, allIssues, view]);

  const selectedIssue =
    visibleIssues.find((issue) => issue.id === selectedIssueId) ?? visibleIssues[0] ?? null;

  function markLocalReviewed(issue: RecoveryIssue) {
    onActionResult({
      ok: true,
      kind: "exception_reviewed",
      tab: "exceptions",
      message: "Issue acknowledged and kept open.",
      exceptionId: issue.id,
    });
  }

  function markReviewed(issue: RecoveryIssue) {
    if (!issue.exception) {
      markLocalReviewed(issue);
      return;
    }

    const formData = new FormData();
    formData.set("exceptionId", issue.exception.id);
    startTransition(async () => {
      onActionResult(await reviewAttendanceExceptionAction(formData));
    });
  }

  function ignoreAsTest(issue: RecoveryIssue) {
    if (!issue.exception) {
      markLocalReviewed(issue);
      return;
    }

    startTransition(async () => {
      onActionResult(await applyAttendanceCorrectionAction({
        branchId: data.branchId,
        actionType: "ignore_scan",
        exceptionId: issue.exception!.id,
        checkinId: issue.exception!.checkin_id,
        staffId: issue.exception!.staff_id,
        reason: `Marked as an accidental or test scan. ${notes || reason}`,
      }));
    });
  }

  function resolveBranchAssignment(issue: RecoveryIssue, permanent: boolean) {
    if (!issue.exception || !issue.staffId) return;
    const scannedBranchId = typeof issue.exception.metadata.scanned_branch_id === "string"
      ? issue.exception.metadata.scanned_branch_id
      : data.branchId;
    startTransition(async () => {
      onActionResult(await applyAttendanceCorrectionAction({
        branchId: data.branchId,
        targetBranchId: scannedBranchId,
        actionType: permanent ? "change_permanent_branch" : "allow_branch_today",
        exceptionId: issue.exception!.id,
        staffId: issue.staffId,
        attendanceDate: data.businessDate,
        reason: `${reason}${notes ? ` ${notes}` : ""}`,
      }));
    });
  }

  function askStaff(issue: RecoveryIssue) {
    if (!issue.exception || !issue.staffId) return;
    startTransition(async () => onActionResult(await askStaffAboutAttendanceIssueAction({
      exceptionId: issue.exception!.id,
      message: notes.trim() || "Please tell CRM what happened when you attempted this Attendance scan.",
    })));
  }

  function escalateTechnical(issue: RecoveryIssue) {
    if (!issue.exception) return;
    startTransition(async () => onActionResult(await escalateAttendanceIssueAction(issue.exception!.id)));
  }

  function applyManualClockOut(record: AttendanceRecord, repairReason: string) {
    startTransition(async () => {
      onActionResult(
        await applyAttendanceCorrectionAction({
          branchId: data.branchId,
          actionType: "set_manual_clock_out",
          checkinId: record.id,
          reason: repairReason,
        })
      );
    });
  }

  function resetAttendanceState(record: AttendanceRecord, repairReason: string, confirmVoid: boolean) {
    startTransition(async () => {
      onActionResult(
        await applyAttendanceCorrectionAction({
          branchId: data.branchId,
          actionType: "reset_attendance_state",
          checkinId: record.id,
          staffId: record.staff_id,
          attendanceDate: record.shift_date,
          resetMode: "next_scan_state",
          confirmVoid,
          reason: repairReason,
        })
      );
    });
  }

  function saveRules() {
    startTransition(async () => {
      const result = await updateAttendanceRulesAction({
        branchId: data.branchId,
        settings: rules,
        reason: rulesReason || "Attendance recovery rule update.",
      });

      onActionResult(result);

      if (result.ok && result.kind === "attendance_rules") {
        setRules(result.settings);
        setRulesReason(
          result.settings.test_mode_reason ?? result.settings.launch_recovery_reason ?? ""
        );
      }
    });
  }

  function archiveTestData() {
    startTransition(async () => {
      onActionResult(
        await applyAttendanceCorrectionAction({
          branchId: data.branchId,
          actionType: "archive_test_data",
          reason: rulesReason || "Archive attendance test data.",
        })
      );
    });
  }

  return (
    <WorkspaceSection
      title="Attendance Review Queue"
      description="One queue for uncertain scans, attendance corrections, device recovery, and audit history."
      context={
        <>
          <ContextChip
            ariaLabel={`Review queue branch: ${data.branchName}`}
            className="min-h-10"
            icon={<DoorOpen className="size-4" />}
          >
            {data.branchName}
          </ContextChip>
          <ContextChip
            ariaLabel="Attendance review workspace mode"
            className="min-h-10"
            icon={<CalendarDays className="size-4" />}
          >
            Review Queue
          </ContextChip>
        </>
      }
    >
      <div className="border-b border-border px-5 py-4">
        <div className="grid overflow-hidden rounded-2xl border border-border bg-card md:grid-cols-5">
          {RECOVERY_VIEWS.map((item) => {
            const selected = view === item.key;
            const badge =
              item.key === "today"
                ? counts.all
                : item.key === "device_recovery"
                  ? counts.deviceAccess
                  : item.key === "staff_day_repair"
                    ? counts.staffDayRepair
                    : item.key === "rules_safety"
                      ? counts.rulesSafety
                      : data.corrections.length;

            return (
              <button
                key={item.key}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  setView(item.key);
                  setSelectedIssueId(null);
                }}
                className={`flex h-14 items-center justify-center gap-2 border-b-2 px-3 text-sm font-semibold transition ${
                  selected
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-transparent text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                }`}
              >
                {item.label}
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-bold text-muted-foreground">
                  {badge}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-5">
        {view === "audit_log" ? (
          <RecoveryAuditLogPanel data={data} />
        ) : view === "staff_day_repair" ? (
          <StaffDayRepairPanel
            data={data}
            isPending={isPending}
            onManualClockOut={applyManualClockOut}
            onResetAttendanceState={resetAttendanceState}
          />
        ) : view === "rules_safety" ? (
          <RulesSafetyPanel
            data={data}
            isPending={isPending}
            onArchiveTestData={archiveTestData}
            onSaveRules={saveRules}
            rules={rules}
            rulesReason={rulesReason}
            setRules={setRules}
            setRulesReason={setRulesReason}
          />
        ) : (
          <div className="grid items-start gap-4 xl:grid-cols-[390px_minmax(0,1fr)]">
            <RecoveryIssueQueue
              activeCategory={activeCategory}
              issues={visibleIssues}
              onCategoryChange={setActiveCategory}
              onSelectIssue={(issue) => setSelectedIssueId(issue.id)}
              selectedIssueId={selectedIssue?.id ?? null}
            />

            <SelectedRecoveryIssuePanel
              issue={selectedIssue}
              isPending={isPending}
              notes={notes}
              onAllowBranchToday={(issue) => resolveBranchAssignment(issue, false)}
              onAskStaff={askStaff}
              onEscalateTechnical={escalateTechnical}
              onIgnoreAsTest={ignoreAsTest}
              onMarkReviewed={markReviewed}
              onCorrectPermanentBranch={(issue) => resolveBranchAssignment(issue, true)}
              onOpenDevices={() => onTabChange("devices")}
              onOpenStateReset={() => {
                setView("staff_day_repair");
                setSelectedIssueId(null);
              }}
              onOpenStaffRecords={() => onTabChange("records")}
              reason={reason}
              setNotes={setNotes}
              setReason={setReason}
            />
          </div>
        )}
      </div>
    </WorkspaceSection>
  );
}
