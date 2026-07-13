"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { CalendarDays, History, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ShiftDefinitionCard } from "./shift-definition-card";
import { WeeklyRuleMatrix } from "./weekly-rule-matrix";
import {
  countWeeklyShifts,
  extractStaffTimesForGroup,
  createEmptyPattern,
  getActiveShiftLabelsForDay,
  getGroupKeyForStaffType,
  getGroupScheduleConfig,
  getNextDayOff,
  getShiftDisplay,
  getShiftLabel,
  getVisibleShiftKinds,
  patternToSaveDays,
  schedulesToPatternForGroup,
  toggleSchedulePatternField,
  type DayPattern,
  type ShiftKind,
  type ShiftTimes,
} from "./schedule-rule-builder-utils";
import { saveStaffWeeklyScheduleAction } from "@/app/(dashboard)/crm/staff-availability/actions";
import { getStaffAdminName } from "@/lib/staff/display-name";
import {
  formatBranchYmd,
  getBranchBusinessDate,
  getDayOfWeekFromYmd,
} from "@/lib/engine/slot-time";
import type { StaffScheduleItem } from "./staff-schedule-types";

type IndividualScheduleEditorProps = {
  items: StaffScheduleItem[];
  branchId: string;
  branchName: string;
  onDataRefresh?: () => void;
};

type StaffScheduleHeaderProps = {
  selectedItem: StaffScheduleItem;
  items: StaffScheduleItem[];
  selectedStaffId: string;
  branchName: string;
  profileLabel: string;
  roleLabel: string;
  isPending: boolean;
  dirty: boolean;
  onSelectStaff: (staffId: string) => void;
  onSave: () => void;
};

function roleLabel(staffType: string | null | undefined): string {
  if (!staffType) return "Staff";
  if (staffType === "csr") return "Front Desk Associate";
  return staffType
    .split("_")
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function todayLabel(date: string): string {
  return formatBranchYmd(date, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function StaffScheduleHeader({
  selectedItem,
  items,
  selectedStaffId,
  branchName,
  profileLabel,
  roleLabel: staffRoleLabel,
  isPending,
  dirty,
  onSelectStaff,
  onSave,
}: StaffScheduleHeaderProps) {
  const staffName = getStaffAdminName(selectedItem.staff);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <label className="flex items-center gap-3 text-sm font-semibold text-stone-700">
          Select Staff
          <select
            value={selectedStaffId}
            onChange={(event) => onSelectStaff(event.target.value)}
            className="h-11 min-w-72 rounded-xl border border-stone-200 bg-white px-3 text-sm font-bold text-stone-900 shadow-sm"
          >
            {items.map((item) => (
              <option key={item.staff.id} value={item.staff.id}>
                {getStaffAdminName(item.staff)}
                {!item.staff.is_active ? " [inactive]" : ""}
              </option>
            ))}
          </select>
        </label>
      </div>

      <section className="rounded-2xl border border-stone-200 bg-white/85 p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="grid size-16 place-items-center rounded-full bg-emerald-900 text-xl font-black text-white ring-4 ring-emerald-50">
              {initials(staffName)}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-black text-stone-950">{staffName}</h2>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-900">
                  {profileLabel}
                </span>
              </div>
              <p className="mt-1 text-sm font-semibold text-stone-600">
                {staffRoleLabel} · {branchName}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={isPending || !dirty}
              className="bg-emerald-900 text-white hover:bg-emerald-800"
              onClick={onSave}
            >
              {isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              {isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

function TimeEditor({
  visibleKinds,
  times,
  onChange,
}: {
  visibleKinds: ShiftKind[];
  times: ShiftTimes;
  onChange: (kind: ShiftKind, field: keyof ShiftTimes[ShiftKind], value: string) => void;
}) {
  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5">
      <h3 className="text-sm font-bold text-amber-950">Custom Staff Times</h3>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {visibleKinds.map((kind) => (
          <label key={kind} className="grid gap-2 rounded-xl bg-white/80 p-4">
            <span className="text-xs font-bold uppercase tracking-wide text-stone-500">
              {getShiftLabel(kind)}
            </span>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <input
                type="time"
                value={times[kind].start}
                onChange={(event) => onChange(kind, "start", event.target.value)}
                className="h-9 rounded-lg border border-stone-200 bg-white px-3 text-sm font-semibold text-stone-900"
              />
              <span className="text-stone-400">-</span>
              <input
                type="time"
                value={times[kind].end}
                onChange={(event) => onChange(kind, "end", event.target.value)}
                className="h-9 rounded-lg border border-stone-200 bg-white px-3 text-sm font-semibold text-stone-900"
              />
            </div>
          </label>
        ))}
      </div>
    </section>
  );
}

export function StaffTodayCard({
  pattern,
  visibleKinds,
  branchName,
  role,
}: {
  pattern: Record<number, DayPattern>;
  visibleKinds: ShiftKind[];
  branchName: string;
  role: string;
}) {
  const today = getBranchBusinessDate();
  const todayDow = getDayOfWeekFromYmd(today);
  const activeLabels = getActiveShiftLabelsForDay(pattern, todayDow, visibleKinds);
  const scheduled = !activeLabels.includes("Day Off") && !activeLabels.includes("Not scheduled");

  return (
    <section className="rounded-2xl border border-stone-200 bg-white/85 p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <div className="grid size-9 place-items-center rounded-full bg-emerald-50 text-emerald-900">
          <CalendarIcon />
        </div>
        <h3 className="text-sm font-bold text-stone-950">This Staff Today</h3>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-stone-500">{todayLabel(today)}</span>
        <span
          className={
            scheduled
              ? "rounded-full bg-emerald-50 px-2 py-0.5 font-bold text-emerald-900"
              : "rounded-full bg-stone-100 px-2 py-0.5 font-bold text-stone-600"
          }
        >
          {scheduled ? "Scheduled" : "Off / Unscheduled"}
        </span>
      </div>
      <div className="mt-4 rounded-xl bg-blue-50 p-3 text-sm font-bold text-blue-950">
        {activeLabels.join(", ")}
      </div>
      <dl className="mt-4 space-y-3 text-sm">
        <InfoRow label="Branch" value={branchName} />
        <InfoRow label="Role" value={role} />
      </dl>
      <Button type="button" variant="outline" disabled className="mt-5 w-full">
        View Full Schedule
      </Button>
    </section>
  );
}

function CalendarIcon() {
  return <CalendarDays className="size-4" />;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-stone-500">{label}</dt>
      <dd className="text-right font-bold text-emerald-900">{value}</dd>
    </div>
  );
}

export function StaffScheduleInfoCard({
  usingCustomSchedule,
  nextDayOff,
  totalWeeklyShifts,
}: {
  usingCustomSchedule: boolean;
  nextDayOff: string;
  totalWeeklyShifts: number;
}) {
  return (
    <section className="rounded-2xl border border-stone-200 bg-white/85 p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <div className="grid size-9 place-items-center rounded-full bg-amber-50 text-amber-900">
          <History className="size-4" />
        </div>
        <h3 className="text-sm font-bold text-stone-950">Schedule Info</h3>
      </div>
      <dl className="space-y-3 text-sm">
        <InfoRow label="Weekly Pattern Saved" value={usingCustomSchedule ? "Yes" : "No"} />
        <InfoRow label="Next Day Off" value={nextDayOff} />
        <InfoRow label="Total Weekly Shifts" value={`${totalWeeklyShifts} shift${totalWeeklyShifts === 1 ? "" : "s"}`} />
      </dl>
      <Button type="button" variant="outline" disabled className="mt-5 w-full">
        View Changes History
      </Button>
    </section>
  );
}

function StaffScheduleEditorForm({
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
  const groupKey = getGroupKeyForStaffType(item.staff.staff_type);
  const groupConfig = getGroupScheduleConfig(groupKey);
  const visibleKinds = useMemo(() => getVisibleShiftKinds(groupKey), [groupKey]);
  const emptyPattern = useMemo(() => createEmptyPattern(), []);
  const profileTimes = useMemo(() => structuredClone(groupConfig.defaults), [groupConfig.defaults]);
  const hasIndividualSchedule = item.schedules.length > 0;
  const [pattern, setPattern] = useState(() =>
    hasIndividualSchedule ? schedulesToPatternForGroup(item.schedules, groupKey) : emptyPattern
  );
  const [customTimes, setCustomTimes] = useState(() =>
    extractStaffTimesForGroup(item.schedules, groupKey, profileTimes)
  );
  const [editingTimes, setEditingTimes] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const activeTimes = customTimes;
  const usingCustomSchedule = hasIndividualSchedule || countWeeklyShifts(pattern, visibleKinds) > 0;
  const staffRoleLabel = roleLabel(item.staff.staff_type);

  const handleToggle = useCallback(
    (dow: number, field: keyof DayPattern) => {
      setPattern((previous) =>
        toggleSchedulePatternField(previous, dow, field, visibleKinds)
      );
      setDirty(true);
    },
    [visibleKinds]
  );

  const handleTimeChange = useCallback(
    (kind: ShiftKind, field: keyof ShiftTimes[ShiftKind], value: string) => {
      setCustomTimes((previous) => ({
        ...previous,
        [kind]: {
          ...previous[kind],
          [field]: value,
        },
      }));
      setDirty(true);
    },
    []
  );

  const save = useCallback(() => {
    startTransition(async () => {
      const result = await saveStaffWeeklyScheduleAction({
        staffId: item.staff.id,
        branchId,
        days: patternToSaveDays(pattern),
        times: activeTimes,
      });

      if (result.ok) {
        setDirty(false);
        setEditingTimes(false);
        setFeedback({ tone: "success", message: "Schedule updated successfully." });
        onDataRefresh?.();
      } else {
        setFeedback({ tone: "error", message: result.error });
      }

      window.setTimeout(() => setFeedback(null), 3500);
    });
  }, [activeTimes, branchId, item.staff.id, onDataRefresh, pattern]);

  return (
    <div className="space-y-5">
      <StaffScheduleHeader
        selectedItem={item}
        items={items}
        selectedStaffId={selectedStaffId}
        branchName={branchName}
        profileLabel={groupConfig.singularLabel}
        roleLabel={staffRoleLabel}
        isPending={isPending}
        dirty={dirty}
        onSelectStaff={onSelectStaff}
        onSave={save}
      />

      {feedback ? (
        <div
          className={
            feedback.tone === "success"
              ? "rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-900"
              : "rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-800"
          }
        >
          {feedback.message}
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_280px] 2xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <div className="grid gap-4 xl:grid-cols-2">
            {visibleKinds.map((kind) => (
              <ShiftDefinitionCard
                key={kind}
                kind={kind}
                groupId={groupKey}
                times={activeTimes}
                onEditTime={() => {
                  setEditingTimes(true);
                  setDirty(true);
                }}
              />
            ))}
          </div>

          {editingTimes ? (
            <TimeEditor visibleKinds={visibleKinds} times={customTimes} onChange={handleTimeChange} />
          ) : null}

          <WeeklyRuleMatrix
            title="Weekly Schedule"
            description="Configure this staff member's weekly pattern. Unsaved days remain unavailable."
            pattern={pattern}
            visibleKinds={visibleKinds}
            basePattern={emptyPattern}
            onToggle={handleToggle}
          />

          {usingCustomSchedule ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              <span>
                <span className="font-bold">Note:</span> This saved weekly pattern is the source of truth for this staff member.
              </span>
            </div>
          ) : null}

          <section className="rounded-2xl border border-stone-200 bg-white/85 p-5 shadow-sm">
            <h3 className="text-base font-bold text-stone-950">Schedule Summary (This Staff)</h3>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {visibleKinds.map((kind) => {
                const display = getShiftDisplay(kind, activeTimes);
                return (
                  <div key={kind} className="border-r border-stone-100 pr-4 last:border-r-0">
                    <div className="text-sm font-bold text-stone-950">{getShiftLabel(kind)}</div>
                    <p className="mt-1 text-sm text-stone-500">{display.label}{display.isOvernight ? " (+1 day)" : ""}</p>
                  </div>
                );
              })}
              <div>
                <div className="text-sm font-bold text-stone-950">Day Off</div>
                <p className="mt-1 text-sm text-stone-500">{getNextDayOff(pattern)}</p>
              </div>
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <StaffTodayCard
            pattern={pattern}
            visibleKinds={visibleKinds}
            branchName={branchName}
            role={staffRoleLabel}
          />
          <StaffScheduleInfoCard
            usingCustomSchedule={usingCustomSchedule}
            nextDayOff={getNextDayOff(pattern)}
            totalWeeklyShifts={countWeeklyShifts(pattern, visibleKinds)}
          />
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
      <section className="rounded-2xl border border-stone-200 bg-white/85 p-10 text-center text-sm font-semibold text-stone-500">
        No staff are available for individual schedule editing.
      </section>
    );
  }

  return (
    <StaffScheduleEditorForm
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
