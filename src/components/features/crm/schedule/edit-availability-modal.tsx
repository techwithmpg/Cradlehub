"use client";

import { useMemo, useState, useTransition } from "react";
import type { ComponentType } from "react";
import { CalendarDays, Clock3, Info, ShieldAlert } from "lucide-react";
import {
  AdminDialog,
  AdminOverlayBody,
  AdminOverlayFooter,
  ConfirmUnsavedChangesDialog,
} from "@/components/shared/overlays";
import { cn } from "@/lib/utils";
import { updateCrmStaffWeeklyAvailabilityAction } from "@/lib/actions/crm-schedule-availability";
import { BlockTimeEditorTab } from "./block-time-editor-tab";
import { DayOverridesEditorTab } from "./day-overrides-editor-tab";
import { EditAvailabilityFooter } from "./edit-availability-footer";
import { EditAvailabilityHeader } from "./edit-availability-header";
import { EditAvailabilitySummary } from "./edit-availability-summary";
import {
  WeeklyHoursEditorTable,
  weeklyRowsHaveErrors,
} from "./weekly-hours-editor-table";
import {
  buildWeeklyRows,
  countWeeklyChanges,
} from "./edit-availability-utils";
import type {
  AvailabilityTab,
  EditAvailabilityStaffItem,
  WeeklyAvailabilityRow,
} from "./edit-availability-types";

type EditAvailabilityModalProps = {
  open: boolean;
  item: EditAvailabilityStaffItem | null;
  branchId: string;
  branchName: string;
  onOpenChange: (open: boolean) => void;
  onSaved: (message?: string) => void;
};

const TABS: Array<{
  value: AvailabilityTab;
  label: string;
  icon: ComponentType<{ className?: string }>;
}> = [
  { value: "weekly", label: "Weekly Hours", icon: Clock3 },
  { value: "overrides", label: "Day Overrides", icon: CalendarDays },
  { value: "blocks", label: "Block Time", icon: ShieldAlert },
];

export function EditAvailabilityModal({
  open,
  item,
  branchId,
  branchName,
  onOpenChange,
  onSaved,
}: EditAvailabilityModalProps) {
  if (!item) return null;

  return (
    <EditAvailabilityModalContent
      key={item.staff.id}
      open={open}
      item={item}
      branchId={branchId}
      branchName={branchName}
      onOpenChange={onOpenChange}
      onSaved={onSaved}
    />
  );
}

type EditAvailabilityModalContentProps = Omit<
  EditAvailabilityModalProps,
  "item"
> & {
  item: EditAvailabilityStaffItem;
};

function EditAvailabilityModalContent({
  open,
  item,
  branchId,
  branchName,
  onOpenChange,
  onSaved,
}: EditAvailabilityModalContentProps) {
  const [activeTab, setActiveTab] = useState<AvailabilityTab>("weekly");
  const [baselineRows, setBaselineRows] = useState<WeeklyAvailabilityRow[]>(
    () => buildWeeklyRows(item)
  );
  const [draftRows, setDraftRows] = useState<WeeklyAvailabilityRow[]>(
    () => buildWeeklyRows(item)
  );
  const [overrideFormDirty, setOverrideFormDirty] = useState(false);
  const [blockFormDirty, setBlockFormDirty] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isSaving, startTransition] = useTransition();

  const weeklyChangeCount = useMemo(
    () => countWeeklyChanges(baselineRows, draftRows),
    [baselineRows, draftRows]
  );
  const hasWeeklyErrors = weeklyRowsHaveErrors(draftRows);
  const dirty = weeklyChangeCount > 0 || overrideFormDirty || blockFormDirty;
  const changeCount =
    weeklyChangeCount + (overrideFormDirty ? 1 : 0) + (blockFormDirty ? 1 : 0);

  function requestClose() {
    if (dirty) {
      setConfirmOpen(true);
      return;
    }
    onOpenChange(false);
  }

  function discardAndClose() {
    setConfirmOpen(false);
    onOpenChange(false);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      onOpenChange(true);
      return;
    }
    requestClose();
  }

  function handleTabMutation(message: string) {
    onSaved(message);
  }

  function saveWeeklyChanges() {
    if (hasWeeklyErrors) {
      setFeedback("Fix invalid weekly hours before saving.");
      return;
    }
    if (weeklyChangeCount === 0) {
      setFeedback("Make a weekly hours change before saving.");
      return;
    }

    startTransition(async () => {
      setFeedback(null);
      const result = await updateCrmStaffWeeklyAvailabilityAction({
        branchId,
        staffId: item.staff.id,
        days: draftRows,
      });

      if (!result.ok) {
        setFeedback(result.error);
        return;
      }

      setBaselineRows(draftRows);
      onSaved("Availability updated.");
      onOpenChange(false);
    });
  }

  return (
    <>
      <AdminDialog
        open={open}
        onOpenChange={handleOpenChange}
        size="xl"
        placement="center"
        className="max-w-[calc(100vw-48px)] bg-[var(--cs-surface)]"
      >
        <EditAvailabilityHeader item={item} />

        <div className="shrink-0 space-y-4 border-b border-[var(--cs-border)] bg-[var(--cs-surface)] px-5 py-4">
          <EditAvailabilitySummary item={item} branchName={branchName} />

          <div
            className="flex gap-1 overflow-x-auto rounded-xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)] p-1"
            role="tablist"
            aria-label="Availability editor sections"
          >
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const selected = activeTab === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  className={cn(
                    "flex min-w-max flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--cs-sand)]/30",
                    selected
                      ? "bg-white text-[var(--cs-sand-dark)] shadow-sm"
                      : "text-[var(--cs-text-muted)] hover:bg-white/70 hover:text-[var(--cs-text)]"
                  )}
                  onClick={() => setActiveTab(tab.value)}
                >
                  <Icon className="size-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <AdminOverlayBody className="bg-[var(--cs-surface-warm)]">
          {feedback ? (
            <div className="mb-4 rounded-lg border border-[var(--cs-error)]/20 bg-[var(--cs-error-bg)] px-3 py-2 text-xs font-medium text-[var(--cs-error-text)]">
              {feedback}
            </div>
          ) : null}

          {activeTab === "weekly" ? (
            <div className="space-y-4">
              <WeeklyHoursEditorTable
                rows={draftRows}
                baselineRows={baselineRows}
                onRowsChange={setDraftRows}
              />
              <div className="flex gap-3 rounded-xl border border-[#bdd7c2] bg-[#eef7ee] px-4 py-3 text-xs leading-5 text-[#315f3b]">
                <Info className="mt-0.5 size-4 shrink-0" />
                <p>
                  Weekly hours are used to generate availability across your
                  schedule. Use Day Overrides to adjust specific dates and Block
                  Time to set unavailable periods.
                </p>
              </div>
            </div>
          ) : null}

          {activeTab === "overrides" ? (
            <DayOverridesEditorTab
              staffId={item.staff.id}
              overrides={item.overrides}
              onDirtyChange={setOverrideFormDirty}
              onChanged={handleTabMutation}
            />
          ) : null}

          {activeTab === "blocks" ? (
            <BlockTimeEditorTab
              staffId={item.staff.id}
              blockedTimes={item.blockedTimes}
              onDirtyChange={setBlockFormDirty}
              onChanged={handleTabMutation}
            />
          ) : null}
        </AdminOverlayBody>

        <AdminOverlayFooter className="bg-[var(--cs-surface)]">
          <EditAvailabilityFooter
            dirty={dirty}
            changeCount={changeCount}
            isSaving={isSaving}
            saveDisabled={weeklyChangeCount === 0 || hasWeeklyErrors}
            onCancel={requestClose}
            onSave={saveWeeklyChanges}
          />
        </AdminOverlayFooter>
      </AdminDialog>

      <ConfirmUnsavedChangesDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={discardAndClose}
        title="Discard schedule changes?"
        description="You have unsaved schedule changes. Discard changes or keep editing?"
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
      />
    </>
  );
}
