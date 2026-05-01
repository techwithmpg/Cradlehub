"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  createBlockedTimeAction,
  deleteBlockedTimeAction,
} from "@/app/(dashboard)/manager/staff/actions";

const REASON_LABELS: Record<string, string> = {
  break: "Break",
  leave: "Leave",
  training: "Training",
  other: "Other",
};

type BlockedTime = {
  id: string;
  block_date: string;
  start_time: string;
  end_time: string;
  reason: string;
};

type BlockReason = "break" | "leave" | "training" | "other";

type Props = {
  staffId: string;
  existingBlockedTimes: BlockedTime[];
};

function shortTime(value: string): string {
  return value.slice(0, 5);
}

export function StaffBlockTimeEditor({ staffId, existingBlockedTimes }: Props) {
  const [blockedTimes, setBlockedTimes] = useState<BlockedTime[]>(existingBlockedTimes);
  const [blockDate, setBlockDate] = useState("");
  const [blockStart, setBlockStart] = useState("12:00");
  const [blockEnd, setBlockEnd] = useState("13:00");
  const [blockReason, setBlockReason] = useState<BlockReason>("break");
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

  function showFeedback(message: string) {
    setFeedback(message);
    window.setTimeout(() => setFeedback(null), 3000);
  }

  function saveBlock() {
    startTransition(async () => {
      const result = await createBlockedTimeAction({
        staffId,
        blockDate,
        startTime: blockStart,
        endTime: blockEnd,
        reason: blockReason,
      });

      if (!result.success) {
        showFeedback(result.error ?? "Failed to add blocked time");
        return;
      }

      const newBlock: BlockedTime = {
        id: `tmp-${Date.now()}`,
        block_date: blockDate,
        start_time: blockStart,
        end_time: blockEnd,
        reason: blockReason,
      };
      setBlockedTimes((prev) =>
        [...prev, newBlock].sort(
          (a, b) => a.block_date.localeCompare(b.block_date) || a.start_time.localeCompare(b.start_time)
        )
      );
      setBlockDate("");
      showFeedback("Blocked time saved");
    });
  }

  function removeBlockedTime(blockedTimeId: string) {
    startTransition(async () => {
      const result = await deleteBlockedTimeAction(blockedTimeId);
      if (!result.success) {
        showFeedback(result.error ?? "Failed to remove blocked time");
        return;
      }
      setBlockedTimes((prev) => prev.filter((item) => item.id !== blockedTimeId));
      showFeedback("Blocked time removed");
    });
  }

  const inputStyle: React.CSSProperties = {
    height: 32,
    borderRadius: 5,
    border: "1px solid var(--cs-border)",
    padding: "0 0.5rem",
    fontSize: "0.8125rem",
    backgroundColor: "var(--cs-surface)",
    color: "var(--cs-text)",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {feedback && (
        <div
          style={{
            marginBottom: "0.25rem",
            padding: "5px 10px",
            backgroundColor:
              feedback.includes("Failed") || feedback.includes("Error") ? "#FEF2F2" : "#F0FDF4",
            border: `1px solid ${
              feedback.includes("Failed") || feedback.includes("Error") ? "#FECACA" : "#BBF7D0"
            }`,
            borderRadius: 5,
            fontSize: "0.8125rem",
            color: feedback.includes("Failed") || feedback.includes("Error") ? "#991B1B" : "#15803D",
          }}
        >
          {feedback}
        </div>
      )}

      <p style={{ fontSize: "0.8125rem", color: "var(--cs-text-muted)", margin: 0 }}>
        Block a time period within a working day (break, training, leave).
      </p>

      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-end" }}>
        <div>
          <div style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)", marginBottom: 3 }}>Date</div>
          <input
            type="date"
            value={blockDate}
            onChange={(e) => setBlockDate(e.target.value)}
            style={inputStyle}
          />
        </div>
        <div>
          <div style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)", marginBottom: 3 }}>From</div>
          <input
            type="time"
            value={blockStart}
            onChange={(e) => setBlockStart(e.target.value)}
            style={inputStyle}
          />
        </div>
        <div>
          <div style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)", marginBottom: 3 }}>To</div>
          <input
            type="time"
            value={blockEnd}
            onChange={(e) => setBlockEnd(e.target.value)}
            style={inputStyle}
          />
        </div>
        <div>
          <div style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)", marginBottom: 3 }}>Reason</div>
          <select
            value={blockReason}
            onChange={(e) => setBlockReason(e.target.value as BlockReason)}
            style={{ ...inputStyle, paddingRight: "1.5rem" }}
          >
            <option value="break">Break</option>
            <option value="leave">Leave</option>
            <option value="training">Training</option>
            <option value="other">Other</option>
          </select>
        </div>
        <Button
          type="button"
          onClick={saveBlock}
          disabled={!blockDate || isPending}
          size="sm"
          style={{ backgroundColor: "var(--cs-sand)", color: "#fff", border: "none" }}
        >
          Add Block
        </Button>
      </div>

      <div style={{ marginTop: "0.5rem" }}>
        {blockedTimes.length === 0 ? (
          <div style={{ fontSize: "0.8125rem", color: "var(--cs-text-muted)" }}>No blocked time entries.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
            {blockedTimes.map((block) => (
              <div
                key={block.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "0.75rem",
                  padding: "0.5rem 0.625rem",
                  border: "1px solid var(--cs-border)",
                  borderRadius: 6,
                }}
              >
                <div style={{ fontSize: "0.8125rem", color: "var(--cs-text)" }}>
                  {block.block_date} · {shortTime(block.start_time)} - {shortTime(block.end_time)} ·{" "}
                  {REASON_LABELS[block.reason] ?? block.reason}
                </div>
                <button
                  type="button"
                  onClick={() => removeBlockedTime(block.id)}
                  disabled={isPending}
                  style={{
                    border: "none",
                    backgroundColor: "transparent",
                    color: "#DC2626",
                    fontSize: "0.75rem",
                    cursor: "pointer",
                  }}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
