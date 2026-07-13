"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { Loader2, RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { updateCrmStaffWeeklyWindowScheduleAction } from "@/lib/actions/crm-schedule-availability";
import { getStaffAdminName } from "@/lib/staff/display-name";
import { EffectiveSchedulePreview } from "@/components/features/schedule-adjustment/effective-schedule-preview";
import { ScheduleImpactSummary } from "@/components/features/schedule-adjustment/schedule-impact-summary";
import { StaffShiftProfileCard } from "@/components/features/schedule-adjustment/staff-shift-profile-card";
import { WeeklyScheduleEditor } from "@/components/features/schedule-adjustment/weekly-schedule-editor";
import type {
  AdjustScheduleDraft,
  ScheduleValidationIssue,
} from "@/components/features/schedule-adjustment/adjust-schedule-types";
import {
  cloneDraft,
  createDraftFromScheduleItem,
  getAllowedShiftKinds,
  getWeeklyDurationMinutes,
  hasBlockingIssues,
  serializeDraftForSave,
  validateAdjustScheduleDraft,
} from "@/components/features/schedule-adjustment/adjust-schedule-utils";
import type { StaffScheduleItem } from "./staff-schedule-types";

type IndividualScheduleEditorProps = {
  items: StaffScheduleItem[];
  branchId: string;
  branchName: string;
  onDataRefresh?: () => void;
};

type Feedback = { tone: "success" | "error"; message: string } | null;

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

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function roleLabel(staffType: string | null | undefined): string {
  if (!staffType) return "Staff";
  if (staffType === "csr") return "CRM / Front Desk";
  return staffType
    .split("_")
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
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

function getLastUpdatedLabel(item: StaffScheduleItem): string | null {
  const timestamps = item.schedules
    .map((schedule) => schedule.created_at)
    .filter((value): value is string => Boolean(value))
    .sort();
  return formatDateLabel(timestamps.at(-1));
}

function getStatusLabel(params: {
  item: StaffScheduleItem;
  issues: ScheduleValidationIssue[];
}): string {
  if (params.issues.some((issue) => issue.level === "error")) return "Schedule Needs Review";
  if (params.item.schedules.length === 0) return "No Schedule Configured";
  return "Custom Schedule";
}

function getWorkingDays(draft: AdjustScheduleDraft): number {
  return draft.days.filter((day) => day.mode === "working" && day.windows.length > 0).length;
}

function Header({
  item,
  items,
  selectedStaffId,
  branchName,
  dirty,
  saving,
  onSelectStaff,
  onReset,
  onSave,
}: {
  item: StaffScheduleItem;
  items: StaffScheduleItem[];
  selectedStaffId: string;
  branchName: string;
  dirty: boolean;
  saving: boolean;
  onSelectStaff: (staffId: string) => void;
  onReset: () => void;
  onSave: () => void;
}) {
  const staffName = getStaffAdminName(item.staff);

  return (
    <section className="rounded-lg border border-[#e3dccf] bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-[#07552f] text-sm font-black text-white">
            {initials(staffName)}
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold text-[#181713]">{staffName}</h2>
            <p className="mt-1 text-xs font-semibold text-[#615c52]">
              {roleLabel(item.staff.staff_type)} · {branchName}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <label className="flex items-center gap-2 text-xs font-semibold text-[#4f4a42]">
            Staff
            <select
              value={selectedStaffId}
              onChange={(event) => onSelectStaff(event.target.value)}
              className="h-9 min-w-56 rounded-md border border-[#d9d1c2] bg-white px-2 text-xs font-semibold text-[#181713]"
            >
              {items.map((candidate) => (
                <option key={candidate.staff.id} value={candidate.staff.id}>
                  {getStaffAdminName(candidate.staff)}
                  {!candidate.staff.is_active ? " [inactive]" : ""}
                </option>
              ))}
            </select>
          </label>
          <Button
            type="button"
            variant="outline"
            className="border-[#d9d1c2] bg-white"
            disabled={!dirty || saving}
            onClick={onReset}
          >
            <RotateCcw className="size-4" />
            Reset
          </Button>
          <Button
            type="button"
            className="bg-[#07552f] text-white hover:bg-[#064525]"
            disabled={!dirty || saving}
            onClick={onSave}
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Save
          </Button>
        </div>
      </div>
    </section>
  );
}

function EditorForm({
  item,
  items,
  selectedStaffId,
  branchId,
  branchName,
  onSelectStaff,
  onDataRefresh,
}: {
  item: StaffScheduleItem;
  items: StaffScheduleItem[];
  selectedStaffId: string;
  branchId: string;
  branchName: string;
  onSelectStaff: (staffId: string) => void;
  onDataRefresh?: () => void;
}) {
  const [draft, setDraft] = useState<AdjustScheduleDraft>(() =>
    createDraftFromScheduleItem({ item, branchId })
  );
  const [baselineDraft, setBaselineDraft] = useState<AdjustScheduleDraft>(() =>
    cloneDraft(createDraftFromScheduleItem({ item, branchId }))
  );
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [isSaving, startSaving] = useTransition();

  const allowedShiftKinds = useMemo(() => getAllowedShiftKinds(item.staff), [item.staff]);
  const issues = useMemo(
    () => validateAdjustScheduleDraft({ draft, allowedShiftKinds }),
    [allowedShiftKinds, draft]
  );
  const dirty = stringifyDraft(draft) !== stringifyDraft(baselineDraft);
  const hasErrors = hasBlockingIssues(issues);
  const weeklyMinutes = getWeeklyDurationMinutes(draft);
  const workingDays = getWorkingDays(draft);
  const statusLabel = getStatusLabel({ item, issues });
  const validationLabel = hasErrors ? "Needs Review" : "Valid";
  const lastUpdatedLabel = getLastUpdatedLabel(item);

  const resetDraft = useCallback(() => {
    setDraft(cloneDraft(baselineDraft));
    setFeedback(null);
  }, [baselineDraft]);

  const reviewIssues = useCallback(() => {
    const firstIssue = issues.find((issue) => issue.level === "error") ?? issues[0];
    if (firstIssue) {
      setFeedback({ tone: firstIssue.level === "error" ? "error" : "success", message: firstIssue.message });
    } else {
      setFeedback({ tone: "success", message: "No validation issues found." });
    }
  }, [issues]);

  const save = useCallback(() => {
    if (!dirty || hasErrors || isSaving) return;
    startSaving(async () => {
      const result = await updateCrmStaffWeeklyWindowScheduleAction(serializeDraftForSave(draft));
      if (!result.ok) {
        setFeedback({ tone: "error", message: result.error });
        return;
      }

      const savedDraft = cloneDraft(draft);
      setBaselineDraft(savedDraft);
      setFeedback({ tone: "success", message: "Schedule updated successfully." });
      onDataRefresh?.();
    });
  }, [dirty, draft, hasErrors, isSaving, onDataRefresh]);

  return (
    <div className="space-y-4">
      <Header
        item={item}
        items={items}
        selectedStaffId={selectedStaffId}
        branchName={branchName}
        dirty={dirty}
        saving={isSaving}
        onSelectStaff={onSelectStaff}
        onReset={resetDraft}
        onSave={save}
      />

      {feedback ? (
        <div
          className={
            feedback.tone === "success"
              ? "rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900"
              : "rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-800"
          }
        >
          {feedback.message}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[240px_minmax(0,1fr)_300px]">
        <aside className="space-y-4 xl:self-start">
          <StaffShiftProfileCard
            item={item}
            allowedShiftKinds={allowedShiftKinds}
            weeklyMinutes={weeklyMinutes}
            workingDays={workingDays}
            issues={issues}
          />
        </aside>
        <main className="min-w-0">
          <WeeklyScheduleEditor
            draft={draft}
            allowedShiftKinds={allowedShiftKinds}
            issues={issues}
            onDraftChange={(nextDraft) => {
              setFeedback(null);
              setDraft(nextDraft);
            }}
            onResetDraft={resetDraft}
            onReviewIssues={reviewIssues}
          />
        </main>
        <aside className="space-y-4 xl:self-start">
          <section className="rounded-lg border border-[#e3dccf] bg-white p-4 shadow-sm">
            <p className="text-xs font-bold text-[#181713]">Schedule Status</p>
            <dl className="mt-3 space-y-3 text-xs">
              <div className="flex justify-between gap-3">
                <dt className="text-[#615c52]">State</dt>
                <dd className="text-right font-semibold text-[#181713]">{statusLabel}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[#615c52]">Validation</dt>
                <dd className="text-right font-semibold text-[#181713]">{validationLabel}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[#615c52]">Last updated</dt>
                <dd className="text-right font-semibold text-[#181713]">{lastUpdatedLabel ?? "Not saved yet"}</dd>
              </div>
            </dl>
          </section>
          <EffectiveSchedulePreview draft={draft} effectiveLabel="Current weekly pattern" />
          <ScheduleImpactSummary dirty={dirty} issues={issues} />
        </aside>
      </div>
    </div>
  );
}

export function IndividualScheduleEditor({
  items,
  branchId,
  branchName,
  onDataRefresh,
}: IndividualScheduleEditorProps) {
  const activeItems = useMemo(
    () => items.filter((item) => item.staff.is_active),
    [items]
  );
  const selectableItems = activeItems.length > 0 ? activeItems : items;
  const [selectedStaffId, setSelectedStaffId] = useState(() => selectableItems[0]?.staff.id ?? "");
  const selectedItem =
    selectableItems.find((item) => item.staff.id === selectedStaffId) ?? selectableItems[0] ?? null;

  if (!selectedItem) {
    return (
      <section className="rounded-lg border border-[#e3dccf] bg-white p-8 text-center text-sm font-semibold text-[#615c52]">
        No staff are available for individual schedule editing.
      </section>
    );
  }

  return (
    <EditorForm
      key={selectedItem.staff.id}
      item={selectedItem}
      items={selectableItems}
      selectedStaffId={selectedItem.staff.id}
      branchId={branchId}
      branchName={branchName}
      onSelectStaff={setSelectedStaffId}
      onDataRefresh={onDataRefresh}
    />
  );
}
