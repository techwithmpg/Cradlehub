"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { AdminDialog, ConfirmUnsavedChangesDialog } from "@/components/shared/overlays";
import { updateCrmStaffWeeklyWindowScheduleAction } from "@/lib/actions/crm-schedule-availability";
import { cn } from "@/lib/utils";
import { AdjustScheduleHeader } from "./adjust-schedule-header";
import { AdjustScheduleNavigation } from "./adjust-schedule-navigation";
import { AdjustScheduleStaffCard } from "./adjust-schedule-staff-card";
import { ApprovedExceptionsPanel } from "./approved-exceptions-panel";
import { DateRangeAdjustmentEditor } from "./date-range-adjustment-editor";
import { EffectiveSchedulePreview } from "./effective-schedule-preview";
import { ScheduleImpactSummary } from "./schedule-impact-summary";
import { ScheduleStatusCard } from "./schedule-status-card";
import { ScheduleValidationFooter } from "./schedule-validation-footer";
import { StaffShiftProfileCard } from "./staff-shift-profile-card";
import { UnavailableTimeEditor } from "./unavailable-time-editor";
import { WeeklyScheduleEditor } from "./weekly-schedule-editor";
import type {
  AdjustScheduleDraft,
  AdjustScheduleMode,
  AdjustScheduleStaffItem,
  ScheduleValidationIssue,
} from "./adjust-schedule-types";
import {
  cloneDraft,
  createDraftFromScheduleItem,
  getAllowedShiftKinds,
  getWeeklyDurationMinutes,
  hasBlockingIssues,
  serializeDraftForSave,
  validateAdjustScheduleDraft,
} from "./adjust-schedule-utils";

type AdjustScheduleDialogProps = {
  open: boolean;
  item: AdjustScheduleStaffItem | null;
  branchId: string;
  branchName: string;
  initialMode?: AdjustScheduleMode;
  initialDate?: string;
  onOpenChange: (open: boolean) => void;
  onSaved: (message?: string) => void;
};

function stringifyDraft(draft: AdjustScheduleDraft): string {
  return JSON.stringify({
    ...draft,
    days: draft.days.map((day) => ({
      ...day,
      windows: day.windows.map((window) => ({
        shiftKind: window.shiftKind,
        startTime: window.startTime,
        endTime: window.endTime,
        endsNextDay: window.endsNextDay,
        order: window.order,
      })),
    })),
  });
}

function formatDateLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function addDays(dateStr: string, days: number): string {
  const date = new Date(`${dateStr}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function getEffectiveLabel(initialDate: string | undefined): string {
  if (!initialDate) return "Current weekly draft";
  const start = formatDateLabel(initialDate) ?? initialDate;
  const end = formatDateLabel(addDays(initialDate, 6)) ?? addDays(initialDate, 6);
  return `${start} - ${end}`;
}

function getLastUpdatedLabel(item: AdjustScheduleStaffItem): string | null {
  const timestamps = item.schedules
    .map((schedule) => schedule.created_at)
    .filter((value): value is string => Boolean(value))
    .sort();
  return formatDateLabel(timestamps.at(-1));
}

function getWorkingDays(draft: AdjustScheduleDraft): number {
  return draft.days.filter((day) => day.mode === "working" && day.windows.length > 0).length;
}

function getStatusLabel(params: {
  item: AdjustScheduleStaffItem;
  draft: AdjustScheduleDraft;
  issues: ScheduleValidationIssue[];
  initialDate?: string;
}): string {
  if (params.issues.some((issue) => issue.level === "error")) return "Schedule Needs Review";
  if (params.initialDate) {
    const override = params.item.overrides.find((candidate) => candidate.override_date === params.initialDate);
    if (override?.is_day_off) return "Day Off Today";
    if (override) return "Date Override Active";
    const weekday = new Date(`${params.initialDate}T00:00:00`).getDay();
    const day = params.draft.days.find((candidate) => candidate.dayOfWeek === weekday);
    if (day?.mode === "day_off") return "Day Off Today";
    if (day?.mode === "working") return "Active Today";
  }
  if (params.item.schedules.length === 0) return "No Schedule Configured";
  return "Custom Schedule";
}

export function AdjustScheduleDialog({
  item,
  branchId,
  branchName,
  initialMode = "weekly",
  initialDate,
  open,
  onOpenChange,
  onSaved,
}: AdjustScheduleDialogProps) {
  if (!item) return null;

  return (
    <AdjustScheduleDialogContent
      key={`${item.staff.id}:${branchId}:${initialMode}:${initialDate ?? ""}:${open ? "open" : "closed"}`}
      open={open}
      item={item}
      branchId={branchId}
      branchName={branchName}
      initialMode={initialMode}
      initialDate={initialDate}
      onOpenChange={onOpenChange}
      onSaved={onSaved}
    />
  );
}

function AdjustScheduleDialogContent({
  open,
  item,
  branchId,
  branchName,
  initialMode = "weekly",
  initialDate,
  onOpenChange,
  onSaved,
}: Omit<AdjustScheduleDialogProps, "item"> & { item: AdjustScheduleStaffItem }) {
  const [mode, setMode] = useState<AdjustScheduleMode>(initialMode);
  const [draft, setDraft] = useState<AdjustScheduleDraft>(() =>
    createDraftFromScheduleItem({ item, branchId })
  );
  const [baselineDraft, setBaselineDraft] = useState<AdjustScheduleDraft>(() =>
    cloneDraft(createDraftFromScheduleItem({ item, branchId }))
  );
  const [dateDirty, setDateDirty] = useState(false);
  const [blockDirty, setBlockDirty] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [impactAcknowledged, setImpactAcknowledged] = useState(false);
  const [isSaving, startSaving] = useTransition();

  const allowedShiftKinds = useMemo(
    () => (item ? getAllowedShiftKinds(item.staff) : ["regular" as const]),
    [item]
  );
  const issues = useMemo(
    () => validateAdjustScheduleDraft({ draft, allowedShiftKinds }),
    [allowedShiftKinds, draft]
  );
  const weeklyDirty = stringifyDraft(draft) !== stringifyDraft(baselineDraft);
  const dirty = weeklyDirty || dateDirty || blockDirty;
  const hasErrors = hasBlockingIssues(issues);
  const statusLabel = item
    ? getStatusLabel({ item, draft, issues, initialDate })
    : "Schedule Status Unavailable";
  const validationLabel = hasErrors ? "Needs Review" : "Valid";
  const lastUpdatedLabel = item ? getLastUpdatedLabel(item) : null;
  const weeklyMinutes = getWeeklyDurationMinutes(draft);
  const workingDays = getWorkingDays(draft);
  const modeAllowsPrimarySave = mode === "weekly";

  const handleRequestClose = useCallback(() => {
    if (dirty) {
      setConfirmOpen(true);
      return;
    }
    onOpenChange(false);
  }, [dirty, onOpenChange]);

  const resetDraft = useCallback(() => {
    setDraft(cloneDraft(baselineDraft));
    setSaveError(null);
    setImpactAcknowledged(false);
  }, [baselineDraft]);

  const reviewIssues = useCallback(() => {
    const firstIssue = issues.find((issue) => issue.level === "error") ?? issues[0];
    if (firstIssue) toast.error(firstIssue.message);
    else toast.success("No validation issues found.");
  }, [issues]);

  const handleSave = useCallback(() => {
    if (!item || hasErrors || !weeklyDirty || isSaving) return;
    startSaving(async () => {
      setSaveError(null);
      const result = await updateCrmStaffWeeklyWindowScheduleAction(serializeDraftForSave(draft));
      if (!result.ok) {
        setSaveError(result.error);
        toast.error(result.error);
        return;
      }
      setBaselineDraft(cloneDraft(draft));
      setImpactAcknowledged(false);
      onSaved("Schedule updated successfully.");
    });
  }, [draft, hasErrors, isSaving, item, onSaved, weeklyDirty]);

  const handleChildChanged = useCallback(
    (message: string) => {
      onSaved(message);
    },
    [onSaved]
  );

  return (
    <>
      <AdminDialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) handleRequestClose();
          else onOpenChange(true);
        }}
        size="full"
        placement="center"
        showCloseButton={false}
        ariaLabel="Adjust Schedule"
        className="h-[min(940px,calc(100dvh-32px))] w-[min(1500px,calc(100vw-32px))] max-w-none rounded-xl bg-[#fbfaf7] sm:max-w-none max-md:left-0 max-md:top-0 max-md:h-dvh max-md:w-screen max-md:translate-x-0 max-md:translate-y-0 max-md:rounded-none"
      >
        <AdjustScheduleHeader onRequestClose={handleRequestClose} />
        <div className="min-h-0 flex-1 overflow-y-auto bg-[#fbfaf7] px-4 py-4 sm:px-6 lg:px-8">
          <div className="space-y-4">
            <AdjustScheduleStaffCard
              item={item}
              branchName={branchName}
              statusLabel={statusLabel}
              validationLabel={validationLabel}
              hasErrors={hasErrors}
              lastUpdatedLabel={lastUpdatedLabel}
            />
            <div className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)_320px]">
              <aside className="space-y-4 xl:self-start">
                <AdjustScheduleNavigation mode={mode} onModeChange={setMode} />
                <StaffShiftProfileCard
                  item={item}
                  allowedShiftKinds={allowedShiftKinds}
                  weeklyMinutes={weeklyMinutes}
                  workingDays={workingDays}
                  issues={issues}
                />
              </aside>
              <main className="min-w-0">
                {saveError ? (
                  <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-800">
                    {saveError}
                  </div>
                ) : null}
                {mode === "weekly" ? (
                  <WeeklyScheduleEditor
                    draft={draft}
                    allowedShiftKinds={allowedShiftKinds}
                    issues={issues}
                    onDraftChange={(nextDraft) => {
                      setImpactAcknowledged(false);
                      setDraft(nextDraft);
                    }}
                    onResetDraft={resetDraft}
                    onReviewIssues={reviewIssues}
                  />
                ) : mode === "date" ? (
                  <DateRangeAdjustmentEditor
                    item={item}
                    branchId={branchId}
                    onDirtyChange={setDateDirty}
                    onChanged={handleChildChanged}
                  />
                ) : mode === "blocked" ? (
                  <UnavailableTimeEditor
                    item={item}
                    branchId={branchId}
                    initialDate={initialDate}
                    onDirtyChange={setBlockDirty}
                    onChanged={handleChildChanged}
                  />
                ) : (
                  <ApprovedExceptionsPanel />
                )}
              </main>
              <aside className="space-y-4 xl:sticky xl:top-0 xl:self-start">
                <ScheduleStatusCard
                  statusLabel={statusLabel}
                  validationLabel={validationLabel}
                  hasErrors={hasErrors}
                  lastUpdatedLabel={lastUpdatedLabel}
                  dirty={weeklyDirty}
                  onClearUnsavedChanges={resetDraft}
                />
                <EffectiveSchedulePreview draft={draft} effectiveLabel={getEffectiveLabel(initialDate)} />
                <ScheduleImpactSummary dirty={dirty} issues={issues} />
              </aside>
            </div>
            <div
              className={cn(
                "rounded-lg border px-4 py-3 text-xs",
                hasErrors
                  ? "border-red-200 bg-red-50 text-red-800"
                  : "border-[#bcd8c7] bg-[#eef7f1] text-[#31533f]"
              )}
            >
              <span className="font-bold">Tips</span>
              <p className="mt-1">
                Use split windows for multiple time blocks. Day Off is deliberate; Not Configured keeps the weekday out
                of weekly availability until CRM defines it.
              </p>
            </div>
          </div>
        </div>
        <ScheduleValidationFooter
          issues={issues}
          dirty={dirty}
          saving={isSaving}
          modeAllowsPrimarySave={modeAllowsPrimarySave}
          impactAcknowledged={!weeklyDirty || impactAcknowledged}
          onImpactAcknowledgedChange={setImpactAcknowledged}
          onCancel={handleRequestClose}
          onSave={handleSave}
        />
      </AdminDialog>
      <ConfirmUnsavedChangesDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={() => {
          setConfirmOpen(false);
          setDraft(cloneDraft(baselineDraft));
          setDateDirty(false);
          setBlockDirty(false);
          setImpactAcknowledged(false);
          onOpenChange(false);
        }}
        title="Discard schedule changes?"
        description="You have unsaved schedule changes. Closing now will discard the draft edits in this modal."
      />
    </>
  );
}
