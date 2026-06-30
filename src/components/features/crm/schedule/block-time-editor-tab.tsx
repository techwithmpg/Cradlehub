"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Check, Plus, ShieldAlert, Trash2 } from "lucide-react";
import {
  createBlockedTimeAction,
  deleteBlockedTimeAction,
} from "@/app/(dashboard)/manager/staff/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatTime12h } from "@/lib/utils/time-format";
import { cn } from "@/lib/utils";
import type { BlockedTime } from "./edit-availability-types";

type BlockTimeEditorTabProps = {
  staffId: string;
  blockedTimes: BlockedTime[];
  initialDate?: string;
  initiallyShowForm?: boolean;
  onDirtyChange: (isDirty: boolean) => void;
  onChanged: (message: string) => void;
};

type BlockReason = "break" | "leave" | "training" | "other";

const REASON_LABELS: Record<BlockReason, string> = {
  break: "Break",
  leave: "Leave",
  training: "Training",
  other: "Other",
};

function normalizeReason(value: string): BlockReason {
  if (value === "break" || value === "leave" || value === "training") {
    return value;
  }
  return "other";
}

function formatDateLabel(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00`);
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function getReasonClass(reason: string): string {
  switch (normalizeReason(reason)) {
    case "break":
      return "bg-[var(--cs-info-bg)] text-[var(--cs-info)]";
    case "leave":
      return "bg-[var(--cs-warning-bg)] text-[var(--cs-warning)]";
    case "training":
      return "bg-[var(--cs-success-bg)] text-[var(--cs-success)]";
    default:
      return "bg-[var(--cs-neutral-bg)] text-[var(--cs-neutral)]";
  }
}

export function BlockTimeEditorTab({
  staffId,
  blockedTimes,
  initialDate,
  initiallyShowForm = false,
  onDirtyChange,
  onChanged,
}: BlockTimeEditorTabProps) {
  const [items, setItems] = useState<BlockedTime[]>(blockedTimes);
  const initialBlockDate = initialDate ?? "";
  const [showForm, setShowForm] = useState(initiallyShowForm);
  const [blockDate, setBlockDate] = useState(initialBlockDate);
  const [startTime, setStartTime] = useState("12:00");
  const [endTime, setEndTime] = useState("13:00");
  const [reason, setReason] = useState<BlockReason>("break");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const formIsDirty = useMemo(
    () =>
      blockDate !== initialBlockDate ||
      startTime !== "12:00" ||
      endTime !== "13:00" ||
      reason !== "break",
    [blockDate, endTime, initialBlockDate, reason, startTime]
  );

  useEffect(() => {
    onDirtyChange(formIsDirty);
  }, [formIsDirty, onDirtyChange]);

  function resetForm() {
    setShowForm(false);
    setBlockDate(initialBlockDate);
    setStartTime("12:00");
    setEndTime("13:00");
    setReason("break");
  }

  function saveBlock() {
    if (!blockDate) {
      setFeedback("Choose a date before adding block time.");
      return;
    }
    if (startTime >= endTime) {
      setFeedback("Start time must be before end time.");
      return;
    }

    startTransition(async () => {
      setFeedback(null);
      const result = await createBlockedTimeAction({
        staffId,
        blockDate,
        startTime,
        endTime,
        reason,
      });

      if (!result.success) {
        setFeedback(result.error ?? "Failed to add block time.");
        return;
      }

      const nextItem: BlockedTime = {
        id: `pending-${staffId}-${blockDate}-${startTime}`,
        block_date: blockDate,
        start_time: startTime,
        end_time: endTime,
        reason,
      };
      setItems((current) =>
        [...current, nextItem].sort(
          (a, b) =>
            a.block_date.localeCompare(b.block_date) ||
            a.start_time.localeCompare(b.start_time)
        )
      );
      resetForm();
      onChanged("Block time saved.");
    });
  }

  function removeBlock(blockId: string) {
    startTransition(async () => {
      setFeedback(null);
      const result = await deleteBlockedTimeAction(blockId);

      if (!result.success) {
        setFeedback(result.error ?? "Failed to remove block time.");
        return;
      }

      setItems((current) => current.filter((item) => item.id !== blockId));
      onChanged("Block time removed.");
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--cs-text)]">
            Block Time
          </h3>
          <p className="text-xs text-[var(--cs-text-muted)]">
            Add unavailable periods for appointments, leave, or personal time.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          className="rounded-lg bg-[var(--cs-sand)] text-white hover:bg-[var(--cs-sand-dark)]"
          onClick={() => setShowForm((value) => !value)}
        >
          <Plus className="size-3.5" />
          Add Block Time
        </Button>
      </div>

      {feedback ? (
        <div className="rounded-lg border border-[var(--cs-error)]/20 bg-[var(--cs-error-bg)] px-3 py-2 text-xs font-medium text-[var(--cs-error-text)]">
          {feedback}
        </div>
      ) : null}

      {showForm ? (
        <div className="rounded-xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] p-4">
          <div className="grid gap-3 md:grid-cols-[1fr_0.8fr_0.8fr_0.9fr_auto] md:items-end">
            <label className="space-y-1">
              <span className="text-xs font-medium text-[var(--cs-text-muted)]">
                Date
              </span>
              <Input
                type="date"
                value={blockDate}
                onChange={(event) => setBlockDate(event.target.value)}
                className="bg-white text-sm"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-[var(--cs-text-muted)]">
                Start
              </span>
              <Input
                type="time"
                value={startTime}
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
                onChange={(event) => setEndTime(event.target.value)}
                className="bg-white text-sm"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-[var(--cs-text-muted)]">
                Reason
              </span>
              <select
                value={reason}
                onChange={(event) =>
                  setReason(normalizeReason(event.target.value))
                }
                className="h-8 w-full rounded-lg border border-input bg-white px-2.5 text-sm text-[var(--cs-text)] outline-none transition focus:border-[var(--cs-sand)] focus:ring-2 focus:ring-[var(--cs-sand)]/20"
              >
                <option value="break">Break</option>
                <option value="leave">Leave</option>
                <option value="training">Training</option>
                <option value="other">Other</option>
              </select>
            </label>
            <Button
              type="button"
              size="sm"
              className="rounded-lg bg-[var(--cs-sand)] text-white hover:bg-[var(--cs-sand-dark)]"
              onClick={saveBlock}
              disabled={isPending}
            >
              <Check className="size-3.5" />
              Save
            </Button>
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface)]">
        <div className="grid grid-cols-[1fr_1fr_1fr_0.6fr] gap-3 border-b border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)] px-4 py-2 text-[0.6875rem] font-bold uppercase tracking-[0.04em] text-[var(--cs-text-muted)]">
          <div>Date</div>
          <div>Time Range</div>
          <div>Reason</div>
          <div className="text-right">Actions</div>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
            <ShieldAlert className="size-5 text-[var(--cs-text-subtle)]" />
            <p className="text-sm font-medium text-[var(--cs-text)]">
              No blocked time added.
            </p>
            <p className="text-xs text-[var(--cs-text-muted)]">
              Use block time to prevent bookings during unavailable periods.
            </p>
          </div>
        ) : (
          items.map((block) => (
            <div
              key={block.id}
              className="grid grid-cols-[1fr_1fr_1fr_0.6fr] items-center gap-3 border-b border-[var(--cs-border-soft)] px-4 py-3 last:border-b-0"
            >
              <div className="text-sm font-medium text-[var(--cs-text)]">
                {formatDateLabel(block.block_date)}
              </div>
              <div className="text-xs text-[var(--cs-text-muted)]">
                {formatTime12h(block.start_time)} – {formatTime12h(block.end_time)}
              </div>
              <div>
                <span
                  className={cn(
                    "rounded-full px-2 py-1 text-[0.6875rem] font-semibold",
                    getReasonClass(block.reason)
                  )}
                >
                  {REASON_LABELS[normalizeReason(block.reason)]}
                </span>
              </div>
              <div className="text-right">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="text-[var(--cs-error)] hover:bg-[var(--cs-error-bg)] hover:text-[var(--cs-error)]"
                  onClick={() => removeBlock(block.id)}
                  disabled={isPending}
                  aria-label="Remove block time"
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
