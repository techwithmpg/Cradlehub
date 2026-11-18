"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  GitBranch,
  History,
  Pencil,
  ShieldAlert,
  Smartphone,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import {
  applyAttendanceCorrectionAction,
  loadOpenCheckinContextAction,
  quickFixAttendanceExceptionAction,
  resetStaffPhoneAndNotifyAction,
  resolveAttendanceExceptionAction,
  reviewAttendanceExceptionAction,
} from "@/app/(dashboard)/crm/attendance/actions";
import { StaffAvatar, formatAttendanceDateTime } from "@/components/features/attendance/attendance-ui";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { upsertCrmScheduleOverrideAction } from "@/lib/actions/crm-schedule-availability";
import {
  classifyReviewIssueBucket,
  findExceptionRecord,
  formatAttendanceRole,
  formatShortClock,
  formatShortShiftDate,
  getReviewIssueHeadline,
  getStaffShiftWindow,
  resolveExceptionTargetCheckinId,
} from "@/lib/attendance/crm-attendance-presenter";
import type { AttendanceReviewItem } from "@/lib/attendance/crm-review";
import { presentAttendanceScanEvent } from "@/lib/attendance/scan-event-presentation";
import { branchDateTimeToIsoInTimezone } from "@/lib/attendance/shift-instance";
import type { AttendanceStaffDiagnostic } from "@/lib/attendance/staff-diagnostics";
import type { AttendanceRecord, AttendanceWorkspaceData } from "@/lib/attendance/types";
import { cn } from "@/lib/utils";

export type AttendanceCorrectionModalTarget =
  | { kind: "staff"; row: AttendanceStaffDiagnostic; reviewItem?: AttendanceReviewItem | null }
  | { kind: "review"; item: AttendanceReviewItem; row?: AttendanceStaffDiagnostic | null }
  | { kind: "record"; record: AttendanceRecord };

type CorrectionOptionId =
  | "record_missing_clock_out"
  | "adjust_times"
  | "sync_scans"
  | "reset_phone"
  | "approve_schedule"
  | "allow_branch_today"
  | "acknowledge";

type CorrectionOption = {
  id: CorrectionOptionId;
  title: string;
  description: string;
  icon: typeof Clock3;
  requiresStep2: boolean;
};

type LoadedCheckin = {
  id: string;
  shift_date: string;
  checked_in_at: string;
  checked_out_at: string | null;
  scheduled_start_at: string | null;
  scheduled_end_at: string | null;
  status: string;
  attendance_status: string;
};

function toLocalDateTimeInput(iso: string | null | undefined, timezone: string): string {
  if (!iso) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

function localInputToIso(value: string, timezone: string): string {
  const [date = "", time = ""] = value.split("T");
  return branchDateTimeToIsoInTimezone({
    date,
    time: `${time}:00`,
    timezone,
  });
}

function isValidLocalDateTime(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value);
}

function getTargetKey(target: AttendanceCorrectionModalTarget): string {
  if (target.kind === "staff") {
    return `staff:${target.row.staff.staffId}:${target.reviewItem?.id ?? "none"}`;
  }
  if (target.kind === "review") {
    return `review:${target.item.id}`;
  }
  return `record:${target.record.id}`;
}

export function AttendanceCorrectionModal({
  data,
  target,
  onClose,
  onSaved,
  onOpenHistory,
  onOpenPhone,
  onOpenFullIssueDialog,
}: {
  data: AttendanceWorkspaceData;
  target: AttendanceCorrectionModalTarget | null;
  onClose: () => void;
  onSaved: () => void;
  onOpenHistory?: () => void;
  onOpenPhone?: (staffId: string | null) => void;
  onOpenFullIssueDialog?: (item: AttendanceReviewItem) => void;
}) {
  if (!target) return null;
  return (
    <AttendanceCorrectionModalInner
      key={getTargetKey(target)}
      data={data}
      target={target}
      onClose={onClose}
      onSaved={onSaved}
      onOpenHistory={onOpenHistory}
      onOpenPhone={onOpenPhone}
      onOpenFullIssueDialog={onOpenFullIssueDialog}
    />
  );
}

function AttendanceCorrectionModalInner({
  data,
  target,
  onClose,
  onSaved,
  onOpenHistory,
  onOpenPhone,
  onOpenFullIssueDialog,
}: {
  data: AttendanceWorkspaceData;
  target: AttendanceCorrectionModalTarget;
  onClose: () => void;
  onSaved: () => void;
  onOpenHistory?: () => void;
  onOpenPhone?: (staffId: string | null) => void;
  onOpenFullIssueDialog?: (item: AttendanceReviewItem) => void;
}) {
  const staffId =
    target.kind === "staff"
      ? target.row.staff.staffId
      : target.kind === "review"
        ? (target.item.exception.staff_id ?? null)
        : target.record.staff_id;

  const reviewItem: AttendanceReviewItem | null =
    target.kind === "review"
      ? target.item
      : target.kind === "staff"
        ? (target.reviewItem ?? null)
        : null;

  const staffRow: AttendanceStaffDiagnostic | null =
    target.kind === "staff" ? target.row : target.kind === "review" ? (target.row ?? null) : null;

  const recordInWorkspace: AttendanceRecord | null = useMemo(() => {
    if (target.kind === "record") return target.record;
    if (reviewItem) {
      return findExceptionRecord(reviewItem.exception, data.records, data.exceptionRecords);
    }
    if (staffRow?.staff.attendanceRecordId) {
      return data.records.find((r) => r.id === staffRow.staff.attendanceRecordId) ?? null;
    }
    return staffId ? (data.records.find((r) => r.staff_id === staffId) ?? null) : null;
  }, [data.exceptionRecords, data.records, reviewItem, staffId, staffRow, target]);

  const [fetchedCheckin, setFetchedCheckin] = useState<LoadedCheckin | null>(null);
  const targetCheckinId =
    (reviewItem ? resolveExceptionTargetCheckinId(reviewItem.exception) : null) ??
    staffRow?.staff.attendanceRecordId ??
    recordInWorkspace?.id ??
    null;

  useEffect(() => {
    let cancelled = false;
    if (!staffId || recordInWorkspace) return;
    void loadOpenCheckinContextAction({
      staffId,
      checkinId: targetCheckinId,
    }).then((res) => {
      if (!cancelled && res.ok && res.checkin) {
        setFetchedCheckin(res.checkin);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [recordInWorkspace, staffId, targetCheckinId]);

  const effectiveRecord: LoadedCheckin | AttendanceRecord | null =
    recordInWorkspace ?? fetchedCheckin;

  const issueBucket = reviewItem ? classifyReviewIssueBucket(reviewItem) : null;
  const issueCategory = reviewItem?.category ?? null;
  const hasOpenUnclosed = Boolean(
    issueBucket === "unclosed" ||
      (effectiveRecord && !effectiveRecord.checked_out_at) ||
      staffRow?.status === "stale_open_attendance"
  );

  const options = useMemo<CorrectionOption[]>(() => {
    const list: CorrectionOption[] = [];

    if (issueCategory === "phone") {
      list.push({
        id: "reset_phone",
        title: "Reset phone & send connect link",
        description: "Clear the old phone link and notify staff to connect cleanly.",
        icon: Smartphone,
        requiresStep2: true,
      });
    }
    if (issueCategory === "schedule") {
      list.push({
        id: "approve_schedule",
        title: "Add or approve today's shift schedule",
        description: "Save today's verified working hours so scans can proceed.",
        icon: CalendarClock,
        requiresStep2: true,
      });
    }
    if (issueCategory === "branch") {
      list.push({
        id: "allow_branch_today",
        title: "Approve scanned branch for today",
        description: "Allow this staff member's scans at this branch today.",
        icon: GitBranch,
        requiresStep2: true,
      });
    }

    if (hasOpenUnclosed || target.kind === "record" || effectiveRecord) {
      list.push({
        id: "record_missing_clock_out",
        title: "Record missing clock-out",
        description:
          effectiveRecord && effectiveRecord.shift_date !== data.businessDate
            ? "Set the correct departure time for the previous shift."
            : "Set the correct departure time for this open shift.",
        icon: Clock3,
        requiresStep2: true,
      });
    }

    if (effectiveRecord || reviewItem?.exception.scan_event_id || staffId) {
      list.push({
        id: "adjust_times",
        title: "Adjust clock-in/out time",
        description: "Correct an incorrect scan timestamp with an audit note.",
        icon: Pencil,
        requiresStep2: true,
      });
    }

    if (reviewItem) {
      if (issueCategory !== "phone") {
        list.push({
          id: "sync_scans",
          title: "Sync saved scans & resolve",
          description: "Rebuild attendance from saved QR scan evidence and close this alert.",
          icon: Sparkles,
          requiresStep2: true,
        });
      }
      list.push({
        id: "acknowledge",
        title: "Acknowledge (no change)",
        description: "Mark as reviewed for now while keeping open records intact.",
        icon: Check,
        requiresStep2: false,
      });
    }

    return list;
  }, [
    data.businessDate,
    effectiveRecord,
    hasOpenUnclosed,
    issueCategory,
    reviewItem,
    staffId,
    target.kind,
  ]);

  const initialWindow = staffRow ? getStaffShiftWindow(staffRow) : null;
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedOption, setSelectedOption] = useState<CorrectionOptionId>(
    () => options[0]?.id ?? "adjust_times"
  );
  const [clockInOverride, setClockInOverride] = useState<string | null>(null);
  const [clockOutOverride, setClockOutOverride] = useState<string | null>(null);
  const [scheduleStart, setScheduleStart] = useState(() => {
    const startPart = initialWindow?.startAt
      ? toLocalDateTimeInput(initialWindow.startAt, data.timezone).split("T")[1]
      : null;
    return startPart || "09:00";
  });
  const [scheduleEnd, setScheduleEnd] = useState(() => {
    const endPart = initialWindow?.endAt
      ? toLocalDateTimeInput(initialWindow.endAt, data.timezone).split("T")[1]
      : null;
    return endPart || "18:00";
  });
  const [reason, setReason] = useState("");
  const [generatedPhoneUrl, setGeneratedPhoneUrl] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const defaultClockInValue = toLocalDateTimeInput(
    effectiveRecord?.checked_in_at ?? staffRow?.staff.clockInAt ?? null,
    data.timezone
  );
  const defaultClockOutValue = toLocalDateTimeInput(
    effectiveRecord?.checked_out_at ??
      staffRow?.staff.clockOutAt ??
      new Date(data.serverNowMs).toISOString(),
    data.timezone
  );
  const clockInValue = clockInOverride ?? defaultClockInValue;
  const clockOutValue = clockOutOverride ?? defaultClockOutValue;

  const staffName =
    (target.kind === "staff"
      ? target.row.staff.staffName
      : target.kind === "review"
        ? (target.item.exception.staff_name ?? target.row?.staff.staffName)
        : target.record.staff_name) ?? "Staff member";

  const staffRoleRaw =
    target.kind === "staff"
      ? target.row.staff.staffType
      : target.kind === "record"
        ? target.record.staff_type
        : (target.row?.staff.staffType ??
          data.staffOptions.find((s) => s.id === staffId)?.staff_type);
  const staffRole = formatAttendanceRole(staffRoleRaw);

  const issueHeadline = reviewItem ? getReviewIssueHeadline(reviewItem, data.timezone) : null;
  const bannerTone = reviewItem
    ? reviewItem.priority === "critical" || issueBucket === "unclosed"
      ? "danger"
      : "warning"
    : staffRow?.needsHelp
      ? "danger"
      : "ok";

  const scheduleDisplay =
    initialWindow?.startAt && initialWindow?.endAt
      ? `${formatShortClock(initialWindow.startAt, data.timezone)} – ${formatShortClock(initialWindow.endAt, data.timezone)}`
      : effectiveRecord?.scheduled_start_at && effectiveRecord?.scheduled_end_at
        ? `${formatShortClock(effectiveRecord.scheduled_start_at, data.timezone)} – ${formatShortClock(effectiveRecord.scheduled_end_at, data.timezone)}`
        : "Not scheduled";

  const latestScanEvent =
    staffRow?.latestScan ??
    (reviewItem?.exception.scan_event_id
      ? (data.scanEvents.find((e) => e.id === reviewItem.exception.scan_event_id) ?? null)
      : null);
  const latestScanPresentation = latestScanEvent ? presentAttendanceScanEvent(latestScanEvent) : null;

  function runImmediateAcknowledge() {
    if (!reviewItem) return;
    startTransition(async () => {
      const form = new FormData();
      form.set("exceptionId", reviewItem.exception.id);
      const res = await reviewAttendanceExceptionAction(form);
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success("Marked as reviewed (kept open until resolved).");
      onSaved();
      onClose();
    });
  }

  function handleContinue() {
    const opt = options.find((o) => o.id === selectedOption);
    if (!opt) return;
    if (selectedOption === "acknowledge") {
      runImmediateAcknowledge();
      return;
    }
    if (selectedOption === "record_missing_clock_out" && !reason) {
      setReason("Recorded missing clock-out via Front Desk review");
    } else if (selectedOption === "adjust_times" && !reason) {
      setReason("Adjusted attendance timestamp via Front Desk review");
    } else if (selectedOption === "sync_scans" && !reason) {
      setReason("Synced saved QR scan records via Front Desk review");
    } else if (selectedOption === "approve_schedule" && !reason) {
      setReason("One-day schedule added during Attendance review");
    } else if (selectedOption === "allow_branch_today" && !reason) {
      setReason("Approved scanned branch for today");
    }
    setStep(2);
  }

  function submitStep2() {
    const cleanReason = reason.trim();
    if (
      ["record_missing_clock_out", "adjust_times", "approve_schedule", "allow_branch_today"].includes(
        selectedOption
      ) &&
      cleanReason.length < 3
    ) {
      toast.error("Please enter a short reason (at least 3 characters).");
      return;
    }

    startTransition(async () => {
      if (selectedOption === "record_missing_clock_out") {
        if (!isValidLocalDateTime(clockOutValue)) {
          toast.error("Choose a valid clock-out date and time.");
          return;
        }
        const outIso = localInputToIso(clockOutValue, data.timezone);
        if (effectiveRecord) {
          if (new Date(outIso).getTime() <= new Date(effectiveRecord.checked_in_at).getTime()) {
            toast.error("Clock-out must be after clock-in.");
            return;
          }
          const result = await applyAttendanceCorrectionAction({
            branchId: data.branchId,
            actionType: "set_manual_clock_out",
            exceptionId: reviewItem?.exception.id ?? staffRow?.openException?.id ?? undefined,
            checkinId: effectiveRecord.id,
            staffId,
            attendanceDate: effectiveRecord.shift_date,
            manualClockInAt: effectiveRecord.checked_in_at,
            manualClockOutAt: outIso,
            reason: cleanReason,
          });
          if (!result.ok) {
            toast.error(result.message);
            return;
          }
          toast.success(result.message);
          onSaved();
          onClose();
          return;
        }
        if (reviewItem) {
          const res = await quickFixAttendanceExceptionAction({
            exceptionId: reviewItem.exception.id,
            staffId,
            checkinId: reviewItem.exception.checkin_id ?? null,
            scanTimeIso: outIso,
            mode: "confirm_clock_out",
          });
          if (!res.ok) {
            toast.error(res.message);
            return;
          }
          toast.success(res.message);
          onSaved();
          onClose();
          return;
        }
        toast.error("No open shift record found to record clock-out.");
        return;
      }

      if (selectedOption === "adjust_times") {
        if (!isValidLocalDateTime(clockInValue)) {
          toast.error("Choose a valid clock-in date and time.");
          return;
        }
        const inIso = localInputToIso(clockInValue, data.timezone);
        const outIso = isValidLocalDateTime(clockOutValue)
          ? localInputToIso(clockOutValue, data.timezone)
          : null;
        if (outIso && new Date(outIso).getTime() <= new Date(inIso).getTime()) {
          toast.error("Clock-out must be after clock-in.");
          return;
        }
        if (!effectiveRecord) {
          if (reviewItem && staffId) {
            const res = await quickFixAttendanceExceptionAction({
              exceptionId: reviewItem.exception.id,
              staffId,
              checkinId: reviewItem.exception.checkin_id ?? null,
              scanTimeIso: inIso,
              mode: "confirm_clock_in",
            });
            if (!res.ok) {
              toast.error(res.message);
              return;
            }
            toast.success(res.message);
            onSaved();
            onClose();
            return;
          }
          toast.error("No existing check-in record found to adjust.");
          return;
        }
        const result = await applyAttendanceCorrectionAction({
          branchId: data.branchId,
          actionType: "correct_attendance_times",
          exceptionId: reviewItem?.exception.id ?? staffRow?.openException?.id ?? undefined,
          checkinId: effectiveRecord.id,
          staffId,
          attendanceDate: effectiveRecord.shift_date,
          manualClockInAt: inIso,
          manualClockOutAt: outIso,
          reason: cleanReason,
        });
        if (!result.ok) {
          toast.error(result.message);
          return;
        }
        toast.success(result.message);
        onSaved();
        onClose();
        return;
      }

      if (selectedOption === "sync_scans" && reviewItem) {
        const res = await quickFixAttendanceExceptionAction({
          exceptionId: reviewItem.exception.id,
          staffId,
          checkinId: effectiveRecord?.id ?? reviewItem.exception.checkin_id ?? null,
          scanTimeIso: reviewItem.exception.last_detected_at ?? reviewItem.exception.detected_at,
          mode: "sync_and_close",
        });
        if (!res.ok) {
          toast.error(res.message);
          return;
        }
        toast.success(res.message);
        onSaved();
        onClose();
        return;
      }

      if (selectedOption === "reset_phone") {
        if (!staffId) {
          toast.error("Staff member could not be identified.");
          return;
        }
        const res = await resetStaffPhoneAndNotifyAction({
          staffId,
          exceptionId: reviewItem?.exception.id ?? null,
        });
        if (!res.ok) {
          toast.error(res.message);
          return;
        }
        toast.success(res.message);
        if (res.activationUrl) {
          setGeneratedPhoneUrl(res.activationUrl);
          onSaved();
        } else {
          onSaved();
          onClose();
        }
        return;
      }

      if (selectedOption === "approve_schedule") {
        if (!staffId) {
          toast.error("Staff member could not be identified.");
          return;
        }
        const scheduleRes = await upsertCrmScheduleOverrideAction({
          branchId: data.branchId,
          staffId,
          overrideDate: data.businessDate,
          isDayOff: false,
          shiftType: "single",
          startTime: scheduleStart,
          endTime: scheduleEnd,
          reason: cleanReason,
        });
        if (!scheduleRes.ok) {
          toast.error(scheduleRes.message);
          return;
        }
        if (reviewItem && !reviewItem.exception.scan_event_id) {
          const form = new FormData();
          form.set("exceptionId", reviewItem.exception.id);
          form.set("resolutionNote", cleanReason);
          await resolveAttendanceExceptionAction(form);
        }
        toast.success("Today's schedule saved.");
        onSaved();
        onClose();
        return;
      }

      if (selectedOption === "allow_branch_today" && reviewItem && staffId) {
        const res = await applyAttendanceCorrectionAction({
          branchId: data.branchId,
          actionType: "allow_branch_today",
          exceptionId: reviewItem.exception.id,
          checkinId: reviewItem.exception.checkin_id,
          staffId,
          attendanceDate: data.businessDate,
          targetBranchId: data.branchId,
          reason: cleanReason,
        });
        if (!res.ok) {
          toast.error(res.message);
          return;
        }
        toast.success(res.message);
        onSaved();
        onClose();
      }
    });
  }

  function handleRadioKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    const idx = options.findIndex((o) => o.id === selectedOption);
    let next = idx;
    if (e.key === "ArrowDown") next = (idx + 1) % options.length;
    if (e.key === "ArrowUp") next = (idx - 1 + options.length) % options.length;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = options.length - 1;
    const nextOpt = options[next];
    if (nextOpt) setSelectedOption(nextOpt.id);
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[92vh] w-[calc(100%-1.5rem)] max-w-[490px] gap-0 overflow-y-auto rounded-2xl border border-[var(--cs-border)] bg-white p-0 shadow-2xl sm:max-w-[490px]">
        <DialogHeader className="border-b border-[var(--cs-border-soft)] px-6 py-4 pr-12 text-left">
          <DialogTitle className="text-[1.1rem] font-bold tracking-tight text-[var(--cs-text)]">
            Correct Attendance
          </DialogTitle>
          <DialogDescription className="text-xs text-[var(--cs-text-muted)]">
            Review and resolve the attendance issue.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 p-5 sm:p-6">
          {/* Staff Identity Header */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <StaffAvatar
                name={staffName}
                className="size-11 bg-[#2D6A45] text-sm font-bold text-white"
              />
              <div className="min-w-0">
                <div className="truncate text-[0.95rem] font-bold text-[var(--cs-text)]">
                  {staffName}
                </div>
                <div className="truncate text-xs text-[var(--cs-text-muted)]">
                  {staffRole} · {data.branchName}
                </div>
              </div>
            </div>
            {onOpenFullIssueDialog && reviewItem ? (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                className="text-[0.7rem] text-[var(--cs-text-muted)] hover:text-[#1F4E33]"
                onClick={() => {
                  onClose();
                  onOpenFullIssueDialog(reviewItem);
                }}
              >
                Full Resolver
              </Button>
            ) : null}
          </div>

          {/* Issue or Status Banner */}
          {reviewItem && issueHeadline ? (
            <div
              className={cn(
                "flex items-start gap-2.5 rounded-xl border p-3.5 text-xs",
                bannerTone === "danger"
                  ? "border-rose-200 bg-rose-50/90 text-rose-950"
                  : "border-amber-200 bg-amber-50/90 text-amber-950"
              )}
            >
              <AlertTriangle
                className={cn(
                  "mt-0.5 size-4 shrink-0",
                  bannerTone === "danger" ? "text-rose-600" : "text-amber-600"
                )}
              />
              <div className="min-w-0">
                <div className="font-bold leading-snug">{issueHeadline.title}</div>
                <p className="mt-0.5 leading-relaxed opacity-90">{issueHeadline.description}</p>
              </div>
            </div>
          ) : staffRow ? (
            <div
              className={cn(
                "flex items-start gap-2.5 rounded-xl border p-3.5 text-xs",
                staffRow.needsHelp
                  ? "border-amber-200 bg-amber-50/90 text-amber-950"
                  : "border-emerald-200 bg-[#EEF8F2] text-[#1A4A2A]"
              )}
            >
              {staffRow.needsHelp ? (
                <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-700" />
              ) : (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#2D6A45]" />
              )}
              <div className="min-w-0">
                <div className="font-bold">
                  {staffRow.issue?.title ??
                    (staffRow.staff.clockInAt && !staffRow.staff.clockOutAt
                      ? `Working since ${formatShortClock(staffRow.staff.clockInAt, data.timezone)}`
                      : staffRow.statusLabel)}
                </div>
                <p className="mt-0.5 opacity-90">
                  {staffRow.issue?.summary ??
                    "Attendance is currently operating within expected shift parameters."}
                </p>
              </div>
            </div>
          ) : null}

          {step === 1 ? (
            <>
              {/* Scan Details Panel */}
              <div className="rounded-xl border border-[var(--cs-border-soft)] bg-[#FAF8F5] p-3.5">
                <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-[var(--cs-text)]">
                  <Clock3 className="size-3.5 text-[var(--cs-text-muted)]" />
                  Scan Details
                </div>
                <dl className="grid gap-2 text-xs">
                  {effectiveRecord && effectiveRecord.shift_date !== data.businessDate ? (
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-[var(--cs-text-muted)]">Previous shift</dt>
                      <dd className="flex items-center gap-2 font-semibold text-[var(--cs-text)]">
                        <span>
                          {formatShortShiftDate(effectiveRecord.shift_date).replace(/, \d{4}$/, "")},{" "}
                          {formatShortClock(effectiveRecord.checked_in_at, data.timezone)} —{" "}
                          {effectiveRecord.checked_out_at
                            ? formatShortClock(effectiveRecord.checked_out_at, data.timezone)
                            : "—"}
                        </span>
                        <span
                          className={cn(
                            "rounded-md px-1.5 py-0.5 text-[0.65rem] font-bold",
                            effectiveRecord.checked_out_at
                              ? "bg-stone-200 text-stone-700"
                              : "border border-rose-200 bg-rose-50 text-rose-700"
                          )}
                        >
                          {effectiveRecord.checked_out_at ? "Closed" : "Open"}
                        </span>
                      </dd>
                    </div>
                  ) : null}

                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-[var(--cs-text-muted)]">Today (current)</dt>
                    <dd className="flex items-center gap-2 font-semibold text-[var(--cs-text)]">
                      <span>
                        {staffRow?.staff.clockInAt
                          ? `${formatShortClock(staffRow.staff.clockInAt, data.timezone)} — ${
                              staffRow.staff.clockOutAt
                                ? formatShortClock(staffRow.staff.clockOutAt, data.timezone)
                                : "—"
                            }`
                          : effectiveRecord && effectiveRecord.shift_date === data.businessDate
                            ? `${formatShortClock(effectiveRecord.checked_in_at, data.timezone)} — ${
                                effectiveRecord.checked_out_at
                                  ? formatShortClock(effectiveRecord.checked_out_at, data.timezone)
                                  : "—"
                              }`
                            : latestScanEvent
                              ? formatAttendanceDateTime(latestScanEvent.created_at, data.timezone)
                              : "No scan yet"}
                      </span>
                      {(staffRow?.working ||
                        (effectiveRecord &&
                          effectiveRecord.shift_date === data.businessDate &&
                          !effectiveRecord.checked_out_at)) ? (
                        <span className="rounded-md bg-[#E3F3E9] px-1.5 py-0.5 text-[0.65rem] font-bold text-[#1F4E33]">
                          In Progress
                        </span>
                      ) : staffRow?.checkedOut ? (
                        <span className="rounded-md bg-blue-50 px-1.5 py-0.5 text-[0.65rem] font-bold text-blue-700">
                          Checked Out
                        </span>
                      ) : null}
                    </dd>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-[var(--cs-text-muted)]">Schedule today</dt>
                    <dd className="font-semibold text-[var(--cs-text)]">{scheduleDisplay}</dd>
                  </div>

                  {latestScanPresentation ? (
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-[var(--cs-text-muted)]">Latest scan</dt>
                      <dd className="truncate font-medium text-[var(--cs-text-secondary)]">
                        {latestScanPresentation.label}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </div>

              {/* Choose a Correction Radio Options */}
              <div>
                <div className="mb-2 text-xs font-bold text-[var(--cs-text)]">
                  Choose a Correction
                </div>
                <div
                  role="radiogroup"
                  aria-label="Choose an attendance correction"
                  onKeyDown={handleRadioKeyDown}
                  className="grid gap-2"
                >
                  {options.map((option) => {
                    const active = selectedOption === option.id;
                    const Icon = option.icon;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setSelectedOption(option.id)}
                        className={cn(
                          "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition outline-none focus-visible:ring-2 focus-visible:ring-[#1F4E33]",
                          active
                            ? "border-[#2D6A45] bg-[#EEF8F2]"
                            : "border-[var(--cs-border)] bg-white hover:border-[#2D6A45]/40 hover:bg-[#FAF8F5]"
                        )}
                      >
                        <span
                          className={cn(
                            "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
                            active
                              ? "border-[#1F4E33] bg-[#1F4E33]"
                              : "border-stone-300 bg-white"
                          )}
                        >
                          {active ? <span className="size-1.5 rounded-full bg-white" /> : null}
                        </span>
                        <Icon
                          className={cn(
                            "mt-0.5 size-4 shrink-0",
                            active ? "text-[#1F4E33]" : "text-[var(--cs-text-muted)]"
                          )}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-[var(--cs-text)]">
                            {option.title}
                          </div>
                          <div className="mt-0.5 text-[0.72rem] leading-snug text-[var(--cs-text-muted)]">
                            {option.description}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Quick Cross-Navigation Links */}
              {(onOpenHistory || onOpenPhone) ? (
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--cs-border-soft)] pt-2 text-xs">
                  <span className="text-[var(--cs-text-muted)]">Need context?</span>
                  <div className="flex items-center gap-3">
                    {onOpenHistory ? (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenHistory();
                        }}
                        className="inline-flex items-center gap-1 font-semibold text-[#1F4E33] hover:underline"
                      >
                        <History className="size-3.5" />
                        Attendance History
                      </button>
                    ) : null}
                    {onOpenPhone ? (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenPhone(staffId);
                        }}
                        className="inline-flex items-center gap-1 font-semibold text-[#1F4E33] hover:underline"
                      >
                        <Smartphone className="size-3.5" />
                        Manage Phone
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {/* Step 1 Footer */}
              <div className="flex items-center gap-3 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  className="h-10 flex-1 rounded-xl border-[var(--cs-border)] font-semibold"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={pending}
                  onClick={handleContinue}
                  className="h-10 flex-1 rounded-xl !bg-[#1F4E33] font-semibold !text-white hover:!bg-[#163B26]"
                  style={{ backgroundColor: "#1F4E33", color: "#FFFFFF" }}
                >
                  {pending ? "Saving…" : selectedOption === "acknowledge" ? "Confirm" : "Continue"}
                  {selectedOption !== "acknowledge" ? <ArrowRight className="ml-1.5 size-4" /> : null}
                </Button>
              </div>
            </>
          ) : (
            /* Step 2: Action Inputs & Explicit Confirmation */
            <div className="grid gap-4">
              {generatedPhoneUrl ? (
                <div className="space-y-3 rounded-xl border border-emerald-200 bg-[#EEF8F2] p-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#1F4E33]">
                    <CheckCircle2 className="size-4" />
                    Phone reset &amp; 1-tap connect link sent to Portal
                  </div>
                  <div className="flex items-center gap-2">
                    <Input readOnly value={generatedPhoneUrl} className="h-8 bg-white text-xs" />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        void navigator.clipboard.writeText(generatedPhoneUrl);
                        toast.success("Connect link copied.");
                      }}
                    >
                      <Copy className="size-3.5" />
                    </Button>
                  </div>
                  <Button
                    type="button"
                    className="w-full rounded-xl bg-[#1F4E33] text-white hover:bg-[#163B26]"
                    onClick={onClose}
                  >
                    Done
                  </Button>
                </div>
              ) : (
                <>
                  {selectedOption === "record_missing_clock_out" ? (
                    <div className="grid gap-3 rounded-xl border border-[var(--cs-border)] bg-[#FAF8F5] p-3.5">
                      <div className="text-xs font-bold text-[var(--cs-text)]">
                        Record Missing Clock-Out
                      </div>
                      {effectiveRecord ? (
                        <div className="text-xs text-[var(--cs-text-muted)]">
                          Recorded clock-in:{" "}
                          <span className="font-semibold text-[var(--cs-text)]">
                            {formatShortShiftDate(effectiveRecord.shift_date)} at{" "}
                            {formatShortClock(effectiveRecord.checked_in_at, data.timezone)}
                          </span>
                        </div>
                      ) : null}
                      <div className="grid gap-1.5">
                        <Label htmlFor="modal-clock-out" className="text-xs font-semibold">
                          Verified Clock-Out Time ({data.timezone})
                        </Label>
                        <Input
                          id="modal-clock-out"
                          type="datetime-local"
                          value={clockOutValue}
                          onChange={(e) => setClockOutOverride(e.target.value)}
                          className="bg-white"
                        />
                      </div>
                    </div>
                  ) : null}

                  {selectedOption === "adjust_times" ? (
                    <div className="grid gap-3 rounded-xl border border-[var(--cs-border)] bg-[#FAF8F5] p-3.5">
                      <div className="text-xs font-bold text-[var(--cs-text)]">
                        Adjust Attendance Timestamps
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="grid gap-1.5">
                          <Label htmlFor="modal-adjust-in" className="text-xs font-semibold">
                            Clock-In
                          </Label>
                          <Input
                            id="modal-adjust-in"
                            type="datetime-local"
                            value={clockInValue}
                            onChange={(e) => setClockInOverride(e.target.value)}
                            className="bg-white text-xs"
                          />
                        </div>
                        <div className="grid gap-1.5">
                          <Label htmlFor="modal-adjust-out" className="text-xs font-semibold">
                            Clock-Out (optional)
                          </Label>
                          <Input
                            id="modal-adjust-out"
                            type="datetime-local"
                            value={clockOutValue}
                            onChange={(e) => setClockOutOverride(e.target.value)}
                            className="bg-white text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {selectedOption === "approve_schedule" ? (
                    <div className="grid gap-3 rounded-xl border border-[var(--cs-border)] bg-[#FAF8F5] p-3.5">
                      <div className="text-xs font-bold text-[var(--cs-text)]">
                        Today&apos;s Shift Schedule ({formatShortShiftDate(data.businessDate)})
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="grid gap-1.5">
                          <Label htmlFor="modal-sched-start" className="text-xs font-semibold">
                            Start time
                          </Label>
                          <Input
                            id="modal-sched-start"
                            type="time"
                            value={scheduleStart}
                            onChange={(e) => setScheduleStart(e.target.value)}
                            className="bg-white"
                          />
                        </div>
                        <div className="grid gap-1.5">
                          <Label htmlFor="modal-sched-end" className="text-xs font-semibold">
                            End time
                          </Label>
                          <Input
                            id="modal-sched-end"
                            type="time"
                            value={scheduleEnd}
                            onChange={(e) => setScheduleEnd(e.target.value)}
                            className="bg-white"
                          />
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {selectedOption === "sync_scans" ? (
                    <div className="rounded-xl border border-emerald-200 bg-[#EEF8F2] p-3.5 text-xs text-[#1A4A2A]">
                      CradleHub will rebuild today&apos;s attendance record from verified QR scans
                      and resolve this open review alert.
                    </div>
                  ) : null}

                  {selectedOption === "reset_phone" ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-950">
                      This clears {staffName}&apos;s old browser binding, generates a 1-tap activation
                      link, and pushes it straight to their Staff Portal.
                    </div>
                  ) : null}

                  {selectedOption === "allow_branch_today" ? (
                    <div className="rounded-xl border border-stone-200 bg-[#FAF8F5] p-3.5 text-xs text-[var(--cs-text-secondary)]">
                      Approve scans from <strong>{data.branchName}</strong> for {staffName} for
                      today ({formatShortShiftDate(data.businessDate)}).
                    </div>
                  ) : null}

                  {!["sync_scans", "reset_phone"].includes(selectedOption) ? (
                    <div className="grid gap-1.5">
                      <Label htmlFor="modal-correction-reason" className="text-xs font-semibold">
                        Audit Reason (required)
                      </Label>
                      <Textarea
                        id="modal-correction-reason"
                        rows={2}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Explain briefly why this correction is being recorded..."
                        className="resize-none bg-white text-xs"
                      />
                    </div>
                  ) : null}

                  <div className="flex items-center gap-3 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={pending}
                      onClick={() => setStep(1)}
                      className="h-10 rounded-xl border-[var(--cs-border)] font-semibold"
                    >
                      <ArrowLeft className="mr-1.5 size-4" />
                      Back
                    </Button>
                    <Button
                      type="button"
                      disabled={pending}
                      onClick={submitStep2}
                      className="h-10 flex-1 rounded-xl !bg-[#1F4E33] font-semibold !text-white hover:!bg-[#163B26]"
                      style={{ backgroundColor: "#1F4E33", color: "#FFFFFF" }}
                    >
                      {pending ? "Applying Correction…" : "Save Correction"}
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
