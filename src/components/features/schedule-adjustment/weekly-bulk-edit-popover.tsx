"use client";

import { useMemo, useState } from "react";
import { Check, Copy, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { ScheduleDayMode, ScheduleShiftKind } from "./adjust-schedule-types";
import { ADJUST_SCHEDULE_DAYS, getShiftLabel } from "./adjust-schedule-utils";

export type WeeklyBulkEditInput = {
  dayOfWeeks: number[];
  mode: ScheduleDayMode;
  shiftKind: ScheduleShiftKind;
  startTime: string;
  endTime: string;
  endsNextDay: boolean;
  placement: "replace" | "append";
};

type WeeklyBulkEditPopoverProps = {
  allowedShiftKinds: ScheduleShiftKind[];
  onApply: (input: WeeklyBulkEditInput) => void;
};

export function WeeklyBulkEditPopover({ allowedShiftKinds, onApply }: WeeklyBulkEditPopoverProps) {
  const [open, setOpen] = useState(false);
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [mode, setMode] = useState<ScheduleDayMode>("working");
  const [shiftKind, setShiftKind] = useState<ScheduleShiftKind>(allowedShiftKinds[0] ?? "regular");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");
  const [endsNextDay, setEndsNextDay] = useState(false);
  const [placement, setPlacement] = useState<"replace" | "append">("replace");

  const preview = useMemo(() => {
    const labels = ADJUST_SCHEDULE_DAYS.filter((day) => selectedDays.includes(day.dayOfWeek)).map((day) => day.short);
    return labels.length > 0 ? labels.join(", ") : "No weekdays selected";
  }, [selectedDays]);

  function toggleDay(dayOfWeek: number) {
    setSelectedDays((current) =>
      current.includes(dayOfWeek)
        ? current.filter((day) => day !== dayOfWeek)
        : [...current, dayOfWeek].sort((a, b) => a - b)
    );
  }

  function apply() {
    if (selectedDays.length === 0) return;
    onApply({
      dayOfWeeks: selectedDays,
      mode,
      shiftKind,
      startTime,
      endTime,
      endsNextDay,
      placement,
    });
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button type="button" variant="outline" size="sm" className="border-[#d9d1c2] bg-white">
            <Layers className="size-3.5" />
            Bulk Edit
          </Button>
        }
      />
      <PopoverContent align="end" className="w-[min(360px,calc(100vw-2rem))] p-4">
        <PopoverHeader>
          <PopoverTitle>Bulk Edit</PopoverTitle>
          <PopoverDescription>Apply draft changes to selected weekdays.</PopoverDescription>
        </PopoverHeader>
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold text-[#3f3a32]">Weekdays</p>
            <div className="mt-2 grid grid-cols-7 gap-1">
              {ADJUST_SCHEDULE_DAYS.map((day) => (
                <button
                  key={day.dayOfWeek}
                  type="button"
                  onClick={() => toggleDay(day.dayOfWeek)}
                  className={
                    selectedDays.includes(day.dayOfWeek)
                      ? "h-8 rounded-md bg-[#0f6b43] text-[0.68rem] font-bold text-white"
                      : "h-8 rounded-md border border-[#e3dccf] bg-white text-[0.68rem] font-semibold text-[#615c52]"
                  }
                >
                  {day.short}
                </button>
              ))}
            </div>
          </div>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-[#3f3a32]">State</span>
            <select
              value={mode}
              onChange={(event) => setMode(event.target.value as ScheduleDayMode)}
              className="h-9 w-full rounded-md border border-[#d9d1c2] bg-white px-2 text-sm"
            >
              <option value="working">Working</option>
              <option value="day_off">Day Off</option>
              <option value="unconfigured">Not Configured</option>
            </select>
          </label>
          {mode === "working" ? (
            <>
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-[#3f3a32]">Shift Type</span>
                <select
                  value={shiftKind}
                  onChange={(event) => setShiftKind(event.target.value as ScheduleShiftKind)}
                  className="h-9 w-full rounded-md border border-[#d9d1c2] bg-white px-2 text-sm"
                >
                  {allowedShiftKinds.map((kind) => (
                    <option key={kind} value={kind}>
                      {getShiftLabel(kind)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-[#3f3a32]">Start</span>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(event) => setStartTime(event.target.value)}
                    className="h-9 w-full rounded-md border border-[#d9d1c2] bg-white px-2 text-sm"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-[#3f3a32]">End</span>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(event) => setEndTime(event.target.value)}
                    className="h-9 w-full rounded-md border border-[#d9d1c2] bg-white px-2 text-sm"
                  />
                </label>
              </div>
              <label className="flex items-center gap-2 text-xs text-[#3f3a32]">
                <input
                  type="checkbox"
                  checked={endsNextDay}
                  onChange={(event) => setEndsNextDay(event.target.checked)}
                  className="size-4 rounded border-[#d9d1c2]"
                />
                Ends next day
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-[#3f3a32]">Placement</span>
                <select
                  value={placement}
                  onChange={(event) => setPlacement(event.target.value as "replace" | "append")}
                  className="h-9 w-full rounded-md border border-[#d9d1c2] bg-white px-2 text-sm"
                >
                  <option value="replace">Replace first window</option>
                  <option value="append">Append split window</option>
                </select>
              </label>
            </>
          ) : null}
          <div className="rounded-md border border-[#eee8dc] bg-[#fbfaf7] px-3 py-2 text-xs text-[#615c52]">
            Affected days: <span className="font-semibold text-[#181713]">{preview}</span>
          </div>
          <Button type="button" className="w-full bg-[#07552f] text-white hover:bg-[#064525]" onClick={apply}>
            <Check className="size-3.5" />
            Apply Draft Change
          </Button>
          <div className="flex items-center gap-2 text-[0.68rem] text-[#615c52]">
            <Copy className="size-3.5" />
            Bulk edit changes the draft only; it does not save immediately.
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
