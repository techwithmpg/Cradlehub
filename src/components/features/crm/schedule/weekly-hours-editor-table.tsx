"use client";

import { RefreshCcw, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { formatTime12h } from "@/lib/utils/time-format";
import { cn } from "@/lib/utils";
import { WEEK_DAYS } from "./edit-availability-utils";
import type { WeeklyAvailabilityRow } from "./edit-availability-types";

const TIME_OPTIONS = Array.from({ length: 36 }, (_, index) => {
  const totalMinutes = 6 * 60 + index * 30;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
});

function rowIsInvalid(row: WeeklyAvailabilityRow): boolean {
  return row.isActive && row.startTime >= row.endTime;
}

function TimeSelect({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="h-8 w-full rounded-md border border-[var(--cs-border-soft)] bg-white px-2 text-xs font-medium text-[var(--cs-text)] outline-none transition focus:border-[var(--cs-sand)] focus:ring-2 focus:ring-[var(--cs-sand)]/20 disabled:cursor-not-allowed disabled:bg-[var(--cs-surface-warm)] disabled:text-[var(--cs-text-muted)]"
      >
        {TIME_OPTIONS.map((time) => (
          <option key={time} value={time}>
            {formatTime12h(time)}
          </option>
        ))}
      </select>
    </label>
  );
}

export function WeeklyHoursEditorTable({
  rows,
  baselineRows,
  onRowsChange,
}: {
  rows: WeeklyAvailabilityRow[];
  baselineRows: WeeklyAvailabilityRow[];
  onRowsChange: (rows: WeeklyAvailabilityRow[]) => void;
}) {
  const firstActive = rows.find((row) => row.isActive);
  const hasInvalidRows = rows.some(rowIsInvalid);

  function updateRow(
    dayOfWeek: number,
    updates: Partial<WeeklyAvailabilityRow>
  ) {
    onRowsChange(
      rows.map((row) =>
        row.dayOfWeek === dayOfWeek ? { ...row, ...updates } : row
      )
    );
  }

  function resetRow(dayOfWeek: number) {
    const original = baselineRows.find((row) => row.dayOfWeek === dayOfWeek);
    if (!original) return;
    updateRow(dayOfWeek, original);
  }

  function applyFirstActivePattern() {
    if (!firstActive) return;
    onRowsChange(
      rows.map((row) =>
        row.isActive
          ? {
              ...row,
              startTime: firstActive.startTime,
              endTime: firstActive.endTime,
            }
          : row
      )
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-[var(--cs-text)]">
            Weekly Hours
          </h3>
          <p className="text-xs text-[var(--cs-text-muted)]">
            Set the recurring weekly pattern used by booking availability.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 rounded-lg text-xs"
          onClick={applyFirstActivePattern}
          disabled={!firstActive}
        >
          <Wand2 className="size-3.5" />
          Apply to all
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface)]">
        <div className="grid grid-cols-[1.1fr_0.8fr_1fr_1fr_0.7fr] gap-3 border-b border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)] px-4 py-2 text-[0.6875rem] font-bold uppercase tracking-[0.04em] text-[var(--cs-text-muted)]">
          <div>Day</div>
          <div>Working?</div>
          <div>Start Time</div>
          <div>End Time</div>
          <div className="text-right">Action</div>
        </div>

        {rows.map((row) => {
          const invalid = rowIsInvalid(row);
          const changed =
            baselineRows[row.dayOfWeek]?.isActive !== row.isActive ||
            baselineRows[row.dayOfWeek]?.startTime !== row.startTime ||
            baselineRows[row.dayOfWeek]?.endTime !== row.endTime;

          return (
            <div
              key={row.dayOfWeek}
              className={cn(
                "grid grid-cols-[1.1fr_0.8fr_1fr_1fr_0.7fr] items-center gap-3 border-b border-[var(--cs-border-soft)] px-4 py-2 last:border-b-0",
                changed && "bg-[var(--cs-sand-tint)]/40"
              )}
            >
              <div>
                <p className="text-sm font-medium text-[var(--cs-text)]">
                  {WEEK_DAYS[row.dayOfWeek]}
                </p>
                {invalid ? (
                  <p className="mt-1 text-[0.6875rem] font-medium text-[var(--cs-error)]">
                    Start must be before end.
                  </p>
                ) : null}
              </div>
              <Switch
                checked={row.isActive}
                aria-label={`${WEEK_DAYS[row.dayOfWeek]} working`}
                onCheckedChange={(checked) =>
                  updateRow(row.dayOfWeek, { isActive: checked })
                }
              />
              {row.isActive ? (
                <TimeSelect
                  label={`${WEEK_DAYS[row.dayOfWeek]} start time`}
                  value={row.startTime}
                  onChange={(value) =>
                    updateRow(row.dayOfWeek, { startTime: value })
                  }
                />
              ) : (
                <span className="text-sm text-[var(--cs-text-muted)]">—</span>
              )}
              {row.isActive ? (
                <TimeSelect
                  label={`${WEEK_DAYS[row.dayOfWeek]} end time`}
                  value={row.endTime}
                  onChange={(value) =>
                    updateRow(row.dayOfWeek, { endTime: value })
                  }
                />
              ) : (
                <span className="text-sm text-[var(--cs-text-muted)]">—</span>
              )}
              <div className="text-right">
                {changed ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="text-[var(--cs-text-muted)] hover:text-[var(--cs-sand-dark)]"
                    onClick={() => resetRow(row.dayOfWeek)}
                    aria-label={`Reset ${WEEK_DAYS[row.dayOfWeek]}`}
                  >
                    <RefreshCcw className="size-3.5" />
                  </Button>
                ) : (
                  <span className="text-sm text-[var(--cs-text-muted)]">—</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {hasInvalidRows ? (
        <p className="text-xs font-medium text-[var(--cs-error)]">
          Fix invalid rows before saving changes.
        </p>
      ) : null}
    </div>
  );
}

export function weeklyRowsHaveErrors(rows: WeeklyAvailabilityRow[]): boolean {
  return rows.some(rowIsInvalid);
}
