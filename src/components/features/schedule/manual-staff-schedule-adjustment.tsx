"use client";

import { useState, useTransition } from "react";
import { Ban, CalendarX2, Clock, Eraser, PauseCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PremiumInlineSpinner } from "@/components/shared/motion/premium-inline-spinner";
import {
  adjustStaffScheduleAction,
  type StaffScheduleAdjustmentInput,
} from "@/lib/actions/staff-schedule-adjustments";
import type {
  DailyScheduleBlock,
  DailyScheduleOverride,
  DailyScheduleStaffRow,
} from "@/lib/queries/schedule";

type AdjustmentType = StaffScheduleAdjustmentInput["adjustmentType"];

type ManualStaffScheduleAdjustmentProps = {
  branchId: string;
  date: string;
  staff: DailyScheduleStaffRow;
  onAdjusted?: (feedback: { title: string; description?: string; variant?: "success" | "error" }) => void;
};

const ADJUSTMENT_OPTIONS: Array<{
  value: AdjustmentType;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
}> = [
  { value: "working_hours", label: "Custom hours", icon: Clock },
  { value: "day_off", label: "Off today", icon: CalendarX2 },
  { value: "blocked_time", label: "Block time", icon: Ban },
  { value: "remove_override", label: "Clear override", icon: Eraser },
  { value: "remove_block", label: "Remove block", icon: PauseCircle },
];

function shortTime(value: string): string {
  return value.slice(0, 5);
}

function blockLabel(block: DailyScheduleBlock): string {
  const reason = block.reason ? ` · ${block.reason}` : "";
  return `${shortTime(block.start_time)}-${shortTime(block.end_time)}${reason}`;
}

function overrideSummary(override: DailyScheduleOverride | null): string {
  if (!override) return "No date override for this staff/date.";
  if (override.is_day_off) return "Current override: off for the day.";
  if (override.start_time && override.end_time) {
    return `Current override: ${shortTime(override.start_time)}-${shortTime(override.end_time)}.`;
  }
  return "Current override found.";
}

export function ManualStaffScheduleAdjustment({
  branchId,
  date,
  staff,
  onAdjusted,
}: ManualStaffScheduleAdjustmentProps) {
  const [adjustmentType, setAdjustmentType] = useState<AdjustmentType>("working_hours");
  const [selectedDate, setSelectedDate] = useState(date);
  const [startTime, setStartTime] = useState(staff.work_start?.slice(0, 5) ?? "10:00");
  const [endTime, setEndTime] = useState(staff.work_end?.slice(0, 5) ?? "19:00");
  const [reason, setReason] = useState("");
  const [blockId, setBlockId] = useState(staff.blocks[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const requiresTime = adjustmentType === "working_hours" || adjustmentType === "blocked_time";
  const isRemoveBlock = adjustmentType === "remove_block";
  const isRemoveOverride = adjustmentType === "remove_override";
  const selectedBlockExists = !isRemoveBlock || staff.blocks.some((block) => block.id === blockId);

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const input: StaffScheduleAdjustmentInput = {
        staffId: staff.staff_id,
        branchId,
        date: selectedDate,
        adjustmentType,
        ...(requiresTime && { startTime, endTime }),
        ...(isRemoveBlock && { blockId }),
        ...(reason.trim() && { reason: reason.trim() }),
      };

      const result = await adjustStaffScheduleAction(input);
      if (!result.success) {
        const message = result.error ?? "Schedule adjustment failed.";
        setError(message);
        onAdjusted?.({ title: "Adjustment failed", description: message, variant: "error" });
        return;
      }

      setReason("");
      onAdjusted?.({
        title: result.title ?? "Schedule adjusted",
        description: result.description,
        variant: "success",
      });
    });
  }

  const inputStyle: React.CSSProperties = {
    height: 32,
    borderRadius: 6,
    border: "1px solid var(--cs-border)",
    backgroundColor: "var(--cs-surface)",
    color: "var(--cs-text)",
    fontSize: "0.8125rem",
    padding: "0 0.5rem",
    minWidth: 0,
  };

  return (
    <section
      style={{
        backgroundColor: "var(--cs-surface)",
        border: "1px solid var(--cs-border)",
        borderRadius: 10,
        padding: "0.875rem 1rem",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.75rem",
          marginBottom: "0.75rem",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              fontSize: "0.6875rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "var(--cs-text-muted)",
            }}
          >
            Manual Adjustment
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)", marginTop: 3 }}>
            {overrideSummary(staff.current_override)}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {ADJUSTMENT_OPTIONS.map((option) => {
            const active = adjustmentType === option.value;
            const Icon = option.icon;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setAdjustmentType(option.value)}
                aria-pressed={active}
                style={{
                  height: 30,
                  borderRadius: 6,
                  border: `1px solid ${active ? "var(--cs-sand)" : "var(--cs-border)"}`,
                  backgroundColor: active ? "var(--cs-sand-mist)" : "transparent",
                  color: active ? "var(--cs-sand)" : "var(--cs-text-muted)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "0 0.625rem",
                  fontSize: "0.75rem",
                  fontWeight: active ? 700 : 500,
                  cursor: "pointer",
                }}
              >
                <Icon size={13} />
                {option.label}
              </button>
            );
          })}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: requiresTime ? "1fr 0.8fr 0.8fr" : "1fr",
            gap: "0.5rem",
          }}
        >
          <label style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
            <span style={{ fontSize: "0.6875rem", color: "var(--cs-text-muted)", fontWeight: 600 }}>
              Date
            </span>
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              style={inputStyle}
            />
          </label>

          {requiresTime && (
            <>
              <label style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                <span style={{ fontSize: "0.6875rem", color: "var(--cs-text-muted)", fontWeight: 600 }}>
                  From
                </span>
                <input
                  type="time"
                  value={startTime}
                  onChange={(event) => setStartTime(event.target.value)}
                  style={inputStyle}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                <span style={{ fontSize: "0.6875rem", color: "var(--cs-text-muted)", fontWeight: 600 }}>
                  To
                </span>
                <input
                  type="time"
                  value={endTime}
                  onChange={(event) => setEndTime(event.target.value)}
                  style={inputStyle}
                />
              </label>
            </>
          )}
        </div>

        {isRemoveBlock && (
          <label style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ fontSize: "0.6875rem", color: "var(--cs-text-muted)", fontWeight: 600 }}>
              Block to remove
            </span>
            <select
              value={blockId}
              onChange={(event) => setBlockId(event.target.value)}
              disabled={staff.blocks.length === 0}
              style={inputStyle}
            >
              {staff.blocks.length === 0 ? (
                <option value="">No blocks on this date</option>
              ) : (
                staff.blocks.map((block) => (
                  <option key={block.id} value={block.id}>
                    {blockLabel(block)}
                  </option>
                ))
              )}
            </select>
          </label>
        )}

        {!isRemoveBlock && !isRemoveOverride && (
          <label style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ fontSize: "0.6875rem", color: "var(--cs-text-muted)", fontWeight: 600 }}>
              Reason
            </span>
            <input
              type="text"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={adjustmentType === "blocked_time" ? "Break, training, leave..." : "Optional note"}
              style={inputStyle}
            />
          </label>
        )}

        {error && (
          <div
            role="alert"
            style={{
              padding: "0.5rem 0.625rem",
              borderRadius: 6,
              backgroundColor: "#FEF2F2",
              border: "1px solid #FECACA",
              color: "#991B1B",
              fontSize: "0.75rem",
            }}
          >
            {error}
          </div>
        )}

        <Button
          type="button"
          size="sm"
          onClick={handleSubmit}
          disabled={!selectedDate || isPending || !selectedBlockExists}
          style={{
            width: "fit-content",
            backgroundColor: "var(--cs-sand)",
            color: "#fff",
            border: "none",
          }}
        >
          {isPending && <PremiumInlineSpinner />}
          {isPending ? "Saving" : "Save adjustment"}
        </Button>
      </div>
    </section>
  );
}
