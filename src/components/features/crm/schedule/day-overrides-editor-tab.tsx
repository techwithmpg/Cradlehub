"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { CalendarDays, Check, Plus, Trash2 } from "lucide-react";
import {
  createScheduleOverrideAction,
  deleteScheduleOverrideAction,
} from "@/app/(dashboard)/manager/staff/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { formatTime12h } from "@/lib/utils/time-format";
import type { ScheduleOverride } from "./edit-availability-types";

type DayOverridesEditorTabProps = {
  staffId: string;
  overrides: ScheduleOverride[];
  onDirtyChange: (isDirty: boolean) => void;
  onChanged: (message: string) => void;
};

function formatDateLabel(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00`);
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function getOverrideType(override: ScheduleOverride): string {
  if (override.is_day_off) return "Unavailable";
  return "Custom Hours";
}

export function DayOverridesEditorTab({
  staffId,
  overrides,
  onDirtyChange,
  onChanged,
}: DayOverridesEditorTabProps) {
  const [items, setItems] = useState<ScheduleOverride[]>(overrides);
  const [showForm, setShowForm] = useState(false);
  const [overrideDate, setOverrideDate] = useState("");
  const [isDayOff, setIsDayOff] = useState(true);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const formIsDirty = useMemo(
    () =>
      showForm ||
      overrideDate !== "" ||
      !isDayOff ||
      startTime !== "09:00" ||
      endTime !== "18:00",
    [endTime, isDayOff, overrideDate, showForm, startTime]
  );

  useEffect(() => {
    onDirtyChange(formIsDirty);
  }, [formIsDirty, onDirtyChange]);

  function resetForm() {
    setShowForm(false);
    setOverrideDate("");
    setIsDayOff(true);
    setStartTime("09:00");
    setEndTime("18:00");
  }

  function saveOverride() {
    if (!overrideDate) {
      setFeedback("Choose a date before adding an override.");
      return;
    }
    if (!isDayOff && startTime >= endTime) {
      setFeedback("Start time must be before end time.");
      return;
    }

    startTransition(async () => {
      setFeedback(null);
      const result = await createScheduleOverrideAction({
        staffId,
        overrideDate,
        isDayOff,
        startTime: isDayOff ? undefined : startTime,
        endTime: isDayOff ? undefined : endTime,
      });

      if (!result.success) {
        setFeedback(result.error ?? "Failed to save day override.");
        return;
      }

      const nextItem: ScheduleOverride = {
        id: `pending-${staffId}-${overrideDate}`,
        override_date: overrideDate,
        is_day_off: isDayOff,
        start_time: isDayOff ? null : startTime,
        end_time: isDayOff ? null : endTime,
        reason: null,
      };
      setItems((current) =>
        [
          ...current.filter((item) => item.override_date !== overrideDate),
          nextItem,
        ].sort((a, b) => a.override_date.localeCompare(b.override_date))
      );
      resetForm();
      onChanged("Day override saved.");
    });
  }

  function removeOverride(overrideId: string) {
    startTransition(async () => {
      setFeedback(null);
      const result = await deleteScheduleOverrideAction(overrideId);

      if (!result.success) {
        setFeedback(result.error ?? "Failed to remove day override.");
        return;
      }

      setItems((current) => current.filter((item) => item.id !== overrideId));
      onChanged("Day override removed.");
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--cs-text)]">
            Day Overrides
          </h3>
          <p className="text-xs text-[var(--cs-text-muted)]">
            Special dates that override the weekly schedule.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          className="rounded-lg bg-[var(--cs-sand)] text-white hover:bg-[var(--cs-sand-dark)]"
          onClick={() => setShowForm((value) => !value)}
        >
          <Plus className="size-3.5" />
          Add Override
        </Button>
      </div>

      {feedback ? (
        <div className="rounded-lg border border-[var(--cs-error)]/20 bg-[var(--cs-error-bg)] px-3 py-2 text-xs font-medium text-[var(--cs-error-text)]">
          {feedback}
        </div>
      ) : null}

      {showForm ? (
        <div className="rounded-xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] p-4">
          <div className="grid gap-3 md:grid-cols-[1fr_0.9fr_0.8fr_0.8fr_auto] md:items-end">
            <label className="space-y-1">
              <span className="text-xs font-medium text-[var(--cs-text-muted)]">
                Date
              </span>
              <Input
                type="date"
                value={overrideDate}
                onChange={(event) => setOverrideDate(event.target.value)}
                className="bg-white text-sm"
              />
            </label>
            <label className="flex h-8 items-center gap-2 rounded-lg border border-[var(--cs-border-soft)] bg-white px-3">
              <Switch checked={isDayOff} onCheckedChange={setIsDayOff} />
              <span className="text-xs font-medium text-[var(--cs-text)]">
                Unavailable
              </span>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-[var(--cs-text-muted)]">
                Start
              </span>
              <Input
                type="time"
                value={startTime}
                disabled={isDayOff}
                onChange={(event) => setStartTime(event.target.value)}
                className="bg-white text-sm"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-[var(--cs-text-muted)]">
                End
              </span>
              <Input
                type="time"
                value={endTime}
                disabled={isDayOff}
                onChange={(event) => setEndTime(event.target.value)}
                className="bg-white text-sm"
              />
            </label>
            <Button
              type="button"
              size="sm"
              className="rounded-lg bg-[var(--cs-sand)] text-white hover:bg-[var(--cs-sand-dark)]"
              onClick={saveOverride}
              disabled={isPending}
            >
              <Check className="size-3.5" />
              Save
            </Button>
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface)]">
        <div className="grid grid-cols-[1fr_0.8fr_1fr_1fr_0.6fr] gap-3 border-b border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)] px-4 py-2 text-[0.6875rem] font-bold uppercase tracking-[0.04em] text-[var(--cs-text-muted)]">
          <div>Date</div>
          <div>Type</div>
          <div>Time</div>
          <div>Reason</div>
          <div className="text-right">Actions</div>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
            <CalendarDays className="size-5 text-[var(--cs-text-subtle)]" />
            <p className="text-sm font-medium text-[var(--cs-text)]">
              No day overrides yet.
            </p>
            <p className="text-xs text-[var(--cs-text-muted)]">
              Add an override for leave, holidays, or special working hours.
            </p>
          </div>
        ) : (
          items.map((override) => (
            <div
              key={override.id}
              className="grid grid-cols-[1fr_0.8fr_1fr_1fr_0.6fr] items-center gap-3 border-b border-[var(--cs-border-soft)] px-4 py-3 last:border-b-0"
            >
              <div className="text-sm font-medium text-[var(--cs-text)]">
                {formatDateLabel(override.override_date)}
              </div>
              <div>
                <span className="rounded-full bg-[var(--cs-sand-tint)] px-2 py-1 text-[0.6875rem] font-semibold text-[var(--cs-sand-dark)]">
                  {getOverrideType(override)}
                </span>
              </div>
              <div className="text-xs text-[var(--cs-text-muted)]">
                {override.is_day_off
                  ? "—"
                  : `${formatTime12h(override.start_time)} – ${formatTime12h(
                      override.end_time
                    )}`}
              </div>
              <div className="text-xs text-[var(--cs-text-muted)]">
                {override.reason ?? "—"}
              </div>
              <div className="text-right">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="text-[var(--cs-error)] hover:bg-[var(--cs-error-bg)] hover:text-[var(--cs-error)]"
                  onClick={() => removeOverride(override.id)}
                  disabled={isPending}
                  aria-label="Remove day override"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
