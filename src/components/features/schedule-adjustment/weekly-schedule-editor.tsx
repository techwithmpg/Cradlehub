"use client";

import type React from "react";
import { MoreHorizontal, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { MAX_STAFF_SCHEDULE_WINDOWS_PER_DAY } from "@/lib/schedule/staff-schedule-write";
import { cn } from "@/lib/utils";
import type {
  AdjustScheduleDraft,
  ScheduleDayMode,
  ScheduleShiftKind,
  ScheduleValidationIssue,
  ScheduleWindowDraft,
  WeeklyScheduleDayDraft,
} from "./adjust-schedule-types";
import {
  ADJUST_SCHEDULE_DAYS,
  createNewWindow,
  getDayLabel,
  getShiftLabel,
  normalizeWindowOrders,
} from "./adjust-schedule-utils";
import { WeeklyBulkEditPopover, type WeeklyBulkEditInput } from "./weekly-bulk-edit-popover";

type WeeklyScheduleEditorProps = {
  draft: AdjustScheduleDraft;
  allowedShiftKinds: ScheduleShiftKind[];
  issues: ScheduleValidationIssue[];
  onDraftChange: React.Dispatch<React.SetStateAction<AdjustScheduleDraft>>;
  onResetDraft: () => void;
  onReviewIssues: () => void;
};

const SHIFT_COLOR: Record<ScheduleShiftKind, string> = {
  opening: "text-[#0f6b43]",
  regular: "text-[#1d5fd0]",
  closing: "text-[#9247b6]",
};

function timeInputClass(error = false): string {
  return cn(
    "h-8 min-w-24 rounded-md border bg-white px-2 text-xs text-[#181713] outline-none focus:border-[#0f6b43] focus:ring-2 focus:ring-[#0f6b43]/15",
    error ? "border-red-300" : "border-[#d9d1c2]"
  );
}

function dayModeLabel(day: WeeklyScheduleDayDraft): string {
  if (day.mode === "day_off") return "Day Off";
  if (day.mode === "unconfigured") return "Not Configured";
  return "Working";
}

function nextWindowOrder(day: WeeklyScheduleDayDraft): number {
  return day.windows.reduce((max, window) => Math.max(max, window.order), 0) + 1;
}

function shiftKindCount(day: WeeklyScheduleDayDraft, kind: ScheduleShiftKind): number {
  return day.windows.filter((window) => window.shiftKind === kind).length;
}

export function WeeklyScheduleEditor({
  draft,
  allowedShiftKinds,
  issues,
  onDraftChange,
  onResetDraft,
  onReviewIssues,
}: WeeklyScheduleEditorProps) {
  const roleSupportsOpeningClosing = allowedShiftKinds.length > 1;
  const canAddAnyWindow = draft.days.some(
    (day) => day.windows.length < MAX_STAFF_SCHEDULE_WINDOWS_PER_DAY
  );

  function updateDay(dayOfWeek: number, updater: (day: WeeklyScheduleDayDraft) => WeeklyScheduleDayDraft) {
    onDraftChange((current) => ({
      ...current,
      days: current.days.map((day) =>
        day.dayOfWeek === dayOfWeek ? normalizeWindowOrders(updater(day)) : day
      ),
    }));
  }

  function setDayMode(dayOfWeek: number, mode: ScheduleDayMode) {
    updateDay(dayOfWeek, (day) => ({
      ...day,
      mode,
      windows: mode === "working" ? day.windows : [],
    }));
  }

  function addWindow(dayOfWeek: number, shiftKind: ScheduleShiftKind = "regular") {
    updateDay(dayOfWeek, (day) => ({
      ...day,
      mode: "working",
      windows:
        day.windows.length >= MAX_STAFF_SCHEDULE_WINDOWS_PER_DAY
          ? day.windows
          : [...day.windows, createNewWindow(dayOfWeek, nextWindowOrder(day), shiftKind)],
    }));
  }

  function removeWindow(dayOfWeek: number, windowId: string) {
    updateDay(dayOfWeek, (day) => {
      const windows = day.windows.filter((window) => window.id !== windowId);
      return { ...day, mode: windows.length > 0 ? "working" : "unconfigured", windows };
    });
  }

  function updateWindow(
    dayOfWeek: number,
    windowId: string,
    updater: (window: ScheduleWindowDraft) => ScheduleWindowDraft
  ) {
    updateDay(dayOfWeek, (day) => ({
      ...day,
      mode: "working",
      windows: day.windows.map((window) => (window.id === windowId ? updater(window) : window)),
    }));
  }

  function toggleShift(dayOfWeek: number, shiftKind: ScheduleShiftKind, checked: boolean) {
    if (checked) {
      addWindow(dayOfWeek, shiftKind);
      return;
    }

    updateDay(dayOfWeek, (day) => {
      const target = day.windows.find((window) => window.shiftKind === shiftKind);
      if (!target) return day;
      const windows = day.windows.filter((window) => window.id !== target.id);
      return { ...day, mode: windows.length > 0 ? "working" : "unconfigured", windows };
    });
  }

  function clearAllWorkingDays() {
    onDraftChange((current) => ({
      ...current,
      days: current.days.map((day) => ({ ...day, mode: "unconfigured", windows: [] })),
    }));
  }

  function applyBulkEdit(input: WeeklyBulkEditInput) {
    onDraftChange((current) => ({
      ...current,
      days: current.days.map((day) => {
        if (!input.dayOfWeeks.includes(day.dayOfWeek)) return day;
        if (input.mode !== "working") {
          return { ...day, mode: input.mode, windows: [] };
        }

        const newWindow: ScheduleWindowDraft = {
          ...createNewWindow(day.dayOfWeek, nextWindowOrder(day), input.shiftKind),
          startTime: input.startTime,
          endTime: input.endTime,
          endsNextDay: input.endsNextDay,
        };
        const windows =
          input.placement === "append" && day.mode === "working"
            ? [...day.windows, newWindow]
            : [newWindow];

        return normalizeWindowOrders({ ...day, mode: "working", windows });
      }),
    }));
  }

  return (
    <section className="overflow-hidden rounded-lg border border-[#e3dccf] bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#e5ded2] px-4 py-4">
        <div>
          <h3 className="text-base font-bold text-[#181713]">Weekly Schedule</h3>
          <p className="mt-1 text-xs text-[#615c52]">
            Set the regular weekly working pattern. Changes apply to future dates only.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <WeeklyBulkEditPopover allowedShiftKinds={allowedShiftKinds} onApply={applyBulkEdit} />
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button type="button" variant="outline" size="icon-sm" className="border-[#d9d1c2] bg-white" aria-label="Weekly schedule actions">
                  <MoreHorizontal className="size-4" />
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="min-w-48">
              <DropdownMenuItem onSelect={onResetDraft}>
                <RotateCcw className="size-4" />
                Reset unsaved changes
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={clearAllWorkingDays}>
                <Trash2 className="size-4" />
                Clear all working days
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onReviewIssues}>
                <MoreHorizontal className="size-4" />
                Review validation issues
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <DesktopScheduleMatrix
        draft={draft}
        issues={issues}
        allowedShiftKinds={allowedShiftKinds}
        roleSupportsOpeningClosing={roleSupportsOpeningClosing}
        onAddWindow={addWindow}
        onRemoveWindow={removeWindow}
        onSetDayMode={setDayMode}
        onToggleShift={toggleShift}
        onUpdateWindow={updateWindow}
      />
      <MobileScheduleCards
        draft={draft}
        allowedShiftKinds={allowedShiftKinds}
        onAddWindow={addWindow}
        onRemoveWindow={removeWindow}
        onSetDayMode={setDayMode}
        onUpdateWindow={updateWindow}
      />

      <div className="border-t border-[#eee8dc] bg-[#fbfaf7] px-4 py-3">
        <Button
          type="button"
          variant="outline"
          className="border-[#d9d1c2] bg-white"
          disabled={!canAddAnyWindow}
          onClick={() => {
            const target =
              draft.days.find(
                (day) =>
                  day.mode === "working" &&
                  day.windows.length < MAX_STAFF_SCHEDULE_WINDOWS_PER_DAY
              ) ??
              draft.days.find(
                (day) =>
                  day.dayOfWeek === 1 &&
                  day.windows.length < MAX_STAFF_SCHEDULE_WINDOWS_PER_DAY
              ) ??
              draft.days.find((day) => day.windows.length < MAX_STAFF_SCHEDULE_WINDOWS_PER_DAY);
            if (target) addWindow(target.dayOfWeek, "regular");
          }}
        >
          <Plus className="size-3.5" />
          Add Split Shift
        </Button>
        <span className="ml-3 text-xs text-[#615c52]">
          Add multiple time windows to the same day with the row plus button.
        </span>
      </div>
    </section>
  );
}

type MatrixHandlers = {
  onAddWindow: (dayOfWeek: number, shiftKind?: ScheduleShiftKind) => void;
  onRemoveWindow: (dayOfWeek: number, windowId: string) => void;
  onSetDayMode: (dayOfWeek: number, mode: ScheduleDayMode) => void;
  onToggleShift: (dayOfWeek: number, shiftKind: ScheduleShiftKind, checked: boolean) => void;
  onUpdateWindow: (
    dayOfWeek: number,
    windowId: string,
    updater: (window: ScheduleWindowDraft) => ScheduleWindowDraft
  ) => void;
};

function DesktopScheduleMatrix({
  draft,
  issues,
  allowedShiftKinds,
  roleSupportsOpeningClosing,
  onAddWindow,
  onRemoveWindow,
  onSetDayMode,
  onToggleShift,
  onUpdateWindow,
}: {
  draft: AdjustScheduleDraft;
  issues: ScheduleValidationIssue[];
  allowedShiftKinds: ScheduleShiftKind[];
  roleSupportsOpeningClosing: boolean;
} & MatrixHandlers) {
  const gridClass = roleSupportsOpeningClosing
    ? "grid-cols-[72px_repeat(3,minmax(178px,1fr))_84px_52px]"
    : "grid-cols-[72px_86px_minmax(240px,1fr)_84px_52px]";

  return (
    <div className="hidden overflow-x-auto md:block">
      <div className={cn("grid min-w-[760px] border-b border-[#eee8dc] bg-[#fbfaf7] text-xs font-semibold text-[#181713]", gridClass)}>
        <div className="border-r border-[#eee8dc] px-4 py-3">Day</div>
        {roleSupportsOpeningClosing ? (
          <>
            <HeaderCell kind="opening" />
            <HeaderCell kind="regular" />
            <HeaderCell kind="closing" />
          </>
        ) : (
          <>
            <div className="border-r border-[#eee8dc] px-3 py-3 text-center">Working</div>
            <HeaderCell kind="regular" />
          </>
        )}
        <div className="border-r border-[#eee8dc] px-3 py-3 text-center">Day Off</div>
        <div className="px-3 py-3 text-center">Action</div>
      </div>
      {ADJUST_SCHEDULE_DAYS.map((dayMeta) => {
        const day = draft.days.find((candidate) => candidate.dayOfWeek === dayMeta.dayOfWeek);
        if (!day) return null;
        const dayIssues = issues.filter((issue) => issue.dayOfWeek === day.dayOfWeek);
        const canAddWindow = day.windows.length < MAX_STAFF_SCHEDULE_WINDOWS_PER_DAY;
        return (
          <div
            key={day.dayOfWeek}
            className={cn("grid min-w-[760px] border-b border-[#eee8dc] last:border-b-0", gridClass)}
          >
            <div className="border-r border-[#eee8dc] px-4 py-3">
              <p className="text-xs font-semibold text-[#181713]">{dayMeta.short}</p>
              <p className={cn("mt-1 text-[0.65rem]", dayIssues.length > 0 ? "text-red-700" : "text-[#8a8378]")}>
                {dayIssues.length > 0 ? "Needs Review" : dayModeLabel(day)}
              </p>
            </div>
            {roleSupportsOpeningClosing ? (
              <>
                <ShiftKindCell day={day} kind="opening" onToggleShift={onToggleShift} onUpdateWindow={onUpdateWindow} onRemoveWindow={onRemoveWindow} />
                <ShiftKindCell day={day} kind="regular" onToggleShift={onToggleShift} onUpdateWindow={onUpdateWindow} onRemoveWindow={onRemoveWindow} />
                <ShiftKindCell day={day} kind="closing" onToggleShift={onToggleShift} onUpdateWindow={onUpdateWindow} onRemoveWindow={onRemoveWindow} />
              </>
            ) : (
              <>
                <div className="flex items-center justify-center border-r border-[#eee8dc] px-3 py-3">
                  <Switch
                    checked={day.mode === "working"}
                    onCheckedChange={(checked) => {
                      if (checked && day.windows.length === 0) onAddWindow(day.dayOfWeek, "regular");
                      else onSetDayMode(day.dayOfWeek, checked ? "working" : "unconfigured");
                    }}
                    aria-label={`${getDayLabel(day.dayOfWeek)} working`}
                  />
                </div>
                <RegularOnlyCell
                  day={day}
                  allowedShiftKinds={allowedShiftKinds}
                  onUpdateWindow={onUpdateWindow}
                  onRemoveWindow={onRemoveWindow}
                />
              </>
            )}
            <div className="flex items-center justify-center border-r border-[#eee8dc] px-3 py-3">
              <Switch
                checked={day.mode === "day_off"}
                onCheckedChange={(checked) => onSetDayMode(day.dayOfWeek, checked ? "day_off" : "unconfigured")}
                aria-label={`Mark ${getDayLabel(day.dayOfWeek)} as day off`}
              />
            </div>
            <div className="flex items-center justify-center px-2 py-3">
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="border-[#d9d1c2] bg-white"
                disabled={!canAddWindow}
                onClick={() => onAddWindow(day.dayOfWeek, "regular")}
                aria-label={`Add another ${getDayLabel(day.dayOfWeek)} work window`}
              >
                <Plus className="size-4" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function HeaderCell({ kind }: { kind: ScheduleShiftKind }) {
  return (
    <div className="border-r border-[#eee8dc] px-3 py-3 text-center">
      <p>{getShiftLabel(kind)}</p>
    </div>
  );
}

function ShiftKindCell({
  day,
  kind,
  onToggleShift,
  onUpdateWindow,
  onRemoveWindow,
}: Pick<MatrixHandlers, "onToggleShift" | "onUpdateWindow" | "onRemoveWindow"> & {
  day: WeeklyScheduleDayDraft;
  kind: ScheduleShiftKind;
}) {
  const windows = day.windows.filter((window) => window.shiftKind === kind);
  const disabled = day.mode === "day_off";
  const canAddKind =
    day.windows.length < MAX_STAFF_SCHEDULE_WINDOWS_PER_DAY &&
    (windows.length === 0 || kind === "regular");

  return (
    <div className="min-h-14 border-r border-[#eee8dc] px-3 py-2">
      {windows.length === 0 ? (
        <div className="flex h-full items-center justify-center gap-2">
          <Switch
            checked={false}
            disabled={disabled || !canAddKind}
            onCheckedChange={(checked) => onToggleShift(day.dayOfWeek, kind, checked)}
            aria-label={`${getShiftLabel(kind)} on ${getDayLabel(day.dayOfWeek)}`}
          />
          <span className="text-xs text-[#8a8378]">-</span>
        </div>
      ) : (
        <div className="space-y-2">
          {windows.map((window) => (
            <WindowFields
              key={window.id}
              day={day}
              window={window}
              compact
              onRemoveWindow={onRemoveWindow}
              onUpdateWindow={onUpdateWindow}
              leading={
                <Switch
                  checked
                  onCheckedChange={(checked) => {
                    if (!checked) onRemoveWindow(day.dayOfWeek, window.id);
                  }}
                  aria-label={`${getShiftLabel(kind)} on ${getDayLabel(day.dayOfWeek)}`}
                />
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RegularOnlyCell({
  day,
  allowedShiftKinds,
  onUpdateWindow,
  onRemoveWindow,
}: Pick<MatrixHandlers, "onUpdateWindow" | "onRemoveWindow"> & {
  day: WeeklyScheduleDayDraft;
  allowedShiftKinds: ScheduleShiftKind[];
}) {
  return (
    <div className="min-h-14 border-r border-[#eee8dc] px-3 py-2">
      {day.mode !== "working" || day.windows.length === 0 ? (
        <div className="flex h-full items-center justify-center text-xs text-[#8a8378]">-</div>
      ) : (
        <div className="space-y-2">
          {day.windows.map((window) => (
            <WindowFields
              key={window.id}
              day={day}
              window={window}
              allowedShiftKinds={allowedShiftKinds}
              onRemoveWindow={onRemoveWindow}
              onUpdateWindow={onUpdateWindow}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function WindowFields({
  day,
  window,
  allowedShiftKinds,
  leading,
  compact = false,
  onUpdateWindow,
  onRemoveWindow,
}: {
  day: WeeklyScheduleDayDraft;
  window: ScheduleWindowDraft;
  allowedShiftKinds?: ScheduleShiftKind[];
  leading?: React.ReactNode;
  compact?: boolean;
} & Pick<MatrixHandlers, "onUpdateWindow" | "onRemoveWindow">) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", compact ? "justify-center" : "justify-start")}>
      {leading}
      {allowedShiftKinds && allowedShiftKinds.length > 1 ? (
        <select
          value={window.shiftKind}
          onChange={(event) =>
            onUpdateWindow(day.dayOfWeek, window.id, (current) => ({
              ...current,
              shiftKind: event.target.value as ScheduleShiftKind,
            }))
          }
          className="h-8 rounded-md border border-[#d9d1c2] bg-white px-2 text-xs"
          aria-label={`Shift type for ${getDayLabel(day.dayOfWeek)} window ${window.order}`}
        >
          {allowedShiftKinds.map((kind) => (
            <option
              key={kind}
              value={kind}
              disabled={kind !== "regular" && kind !== window.shiftKind && shiftKindCount(day, kind) > 0}
            >
              {getShiftLabel(kind)}
            </option>
          ))}
        </select>
      ) : null}
      <input
        type="time"
        value={window.startTime}
        onChange={(event) =>
          onUpdateWindow(day.dayOfWeek, window.id, (current) => ({ ...current, startTime: event.target.value }))
        }
        className={timeInputClass()}
        aria-label={`Start time for ${getDayLabel(day.dayOfWeek)} window ${window.order}`}
      />
      <span className="text-xs text-[#8a8378]">-</span>
      <input
        type="time"
        value={window.endTime}
        onChange={(event) =>
          onUpdateWindow(day.dayOfWeek, window.id, (current) => ({ ...current, endTime: event.target.value }))
        }
        className={timeInputClass()}
        aria-label={`End time for ${getDayLabel(day.dayOfWeek)} window ${window.order}`}
      />
      <label className="flex items-center gap-1 text-[0.68rem] text-[#615c52]">
        <input
          type="checkbox"
          checked={window.endsNextDay}
          onChange={(event) =>
            onUpdateWindow(day.dayOfWeek, window.id, (current) => ({
              ...current,
              endsNextDay: event.target.checked,
            }))
          }
          className="size-3.5 rounded border-[#d9d1c2]"
        />
        Next day
      </label>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className="text-[#8a352c] hover:bg-red-50 hover:text-red-700"
        onClick={() => onRemoveWindow(day.dayOfWeek, window.id)}
        aria-label={`Remove ${getDayLabel(day.dayOfWeek)} window ${window.order}`}
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  );
}

function MobileScheduleCards({
  draft,
  allowedShiftKinds,
  onAddWindow,
  onRemoveWindow,
  onSetDayMode,
  onUpdateWindow,
}: {
  draft: AdjustScheduleDraft;
  allowedShiftKinds: ScheduleShiftKind[];
} & Pick<MatrixHandlers, "onAddWindow" | "onRemoveWindow" | "onSetDayMode" | "onUpdateWindow">) {
  return (
    <div className="space-y-3 p-3 md:hidden">
      {ADJUST_SCHEDULE_DAYS.map((dayMeta) => {
        const day = draft.days.find((candidate) => candidate.dayOfWeek === dayMeta.dayOfWeek);
        if (!day) return null;
        const canAddWindow = day.windows.length < MAX_STAFF_SCHEDULE_WINDOWS_PER_DAY;
        return (
          <section key={day.dayOfWeek} className="rounded-lg border border-[#eee8dc] bg-[#fbfaf7] p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-[#181713]">{dayMeta.label}</p>
                <p className="text-xs text-[#615c52]">{dayModeLabel(day)}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="bg-white"
                disabled={!canAddWindow}
                onClick={() => onAddWindow(day.dayOfWeek, "regular")}
                aria-label={`Add another ${dayMeta.label} work window`}
              >
                <Plus className="size-4" />
              </Button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  if (day.mode === "working") onSetDayMode(day.dayOfWeek, "unconfigured");
                  else if (day.windows.length === 0) onAddWindow(day.dayOfWeek, "regular");
                  else onSetDayMode(day.dayOfWeek, "working");
                }}
                className={cn(
                  "h-10 rounded-md border text-xs font-semibold",
                  day.mode === "working" ? "border-[#0f6b43] bg-[#eef7f1] text-[#0f6b43]" : "border-[#d9d1c2] bg-white text-[#615c52]"
                )}
              >
                Working
              </button>
              <button
                type="button"
                onClick={() => onSetDayMode(day.dayOfWeek, day.mode === "day_off" ? "unconfigured" : "day_off")}
                className={cn(
                  "h-10 rounded-md border text-xs font-semibold",
                  day.mode === "day_off" ? "border-[#0f6b43] bg-[#eef7f1] text-[#0f6b43]" : "border-[#d9d1c2] bg-white text-[#615c52]"
                )}
              >
                Day Off
              </button>
            </div>
            {day.mode === "working" && day.windows.length > 0 ? (
              <div className="mt-3 space-y-3">
                {day.windows.map((window) => (
                  <div key={window.id} className="rounded-md border border-[#eee8dc] bg-white p-3">
                    <p className={cn("mb-2 text-xs font-bold", SHIFT_COLOR[window.shiftKind])}>
                      Window {window.order}
                    </p>
                    <WindowFields
                      day={day}
                      window={window}
                      allowedShiftKinds={allowedShiftKinds}
                      onRemoveWindow={onRemoveWindow}
                      onUpdateWindow={onUpdateWindow}
                    />
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
