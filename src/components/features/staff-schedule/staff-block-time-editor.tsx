"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  createBlockedTimeAction,
  deleteBlockedTimeAction,
} from "@/app/(dashboard)/manager/staff/actions";
import { ShieldAlert, Trash2, Check } from "lucide-react";

const REASON_LABELS: Record<string, string> = {
  break: "Break",
  leave: "Leave",
  training: "Training",
  other: "Other",
};

const REASON_COLORS: Record<string, { bg: string; color: string }> = {
  break: { bg: "var(--cs-info-bg)", color: "var(--cs-info)" },
  leave: { bg: "var(--cs-warning-bg)", color: "var(--cs-warning)" },
  training: { bg: "var(--cs-success-bg)", color: "var(--cs-success)" },
  other: { bg: "var(--cs-neutral-bg)", color: "var(--cs-neutral)" },
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
  onSave?: () => void;
};

function shortTime(value: string): string {
  return value.slice(0, 5);
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[d.getMonth()] ?? "Jan"} ${d.getDate()}, ${d.getFullYear()}`;
}

export function StaffBlockTimeEditor({ staffId, existingBlockedTimes, onSave }: Props) {
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
      onSave?.();
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
    height: 36,
    borderRadius: "var(--cs-r-sm)",
    border: "1px solid var(--cs-border-soft)",
    padding: "0 0.625rem",
    fontSize: "0.8125rem",
    backgroundColor: "var(--cs-surface)",
    color: "var(--cs-text)",
    outline: "none",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
      {feedback && (
        <div
          style={{
            padding: "8px 12px",
            borderRadius: "var(--cs-r-sm)",
            fontSize: "0.8125rem",
            fontWeight: 500,
            background:
              feedback.includes("Failed") || feedback.includes("Error")
                ? "var(--cs-error-bg)"
                : "var(--cs-success-bg)",
            color:
              feedback.includes("Failed") || feedback.includes("Error")
                ? "var(--cs-error-text)"
                : "var(--cs-success-text)",
            border:
              feedback.includes("Failed") || feedback.includes("Error")
                ? "1px solid var(--cs-error-bg)"
                : "1px solid var(--cs-success-bg)",
          }}
        >
          {feedback}
        </div>
      )}

      {/* Add block card */}
      <div
        style={{
          background: "var(--cs-surface)",
          border: "1px solid var(--cs-border-soft)",
          borderRadius: "var(--cs-r-lg)",
          padding: "14px 16px",
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--cs-text)", marginBottom: 10 }}>
          Add Blocked Time
        </div>
        <p style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)", margin: "0 0 10px" }}>
          Block a time period within a working day.
        </p>

        <div style={{ display: "flex", gap: "0.625rem", flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 500, color: "var(--cs-text-muted)", marginBottom: 4 }}>
              Date
            </div>
            <input
              type="date"
              value={blockDate}
              onChange={(e) => setBlockDate(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 500, color: "var(--cs-text-muted)", marginBottom: 4 }}>
              From
            </div>
            <input
              type="time"
              value={blockStart}
              onChange={(e) => setBlockStart(e.target.value)}
              style={{ ...inputStyle, width: 90 }}
            />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 500, color: "var(--cs-text-muted)", marginBottom: 4 }}>
              To
            </div>
            <input
              type="time"
              value={blockEnd}
              onChange={(e) => setBlockEnd(e.target.value)}
              style={{ ...inputStyle, width: 90 }}
            />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 500, color: "var(--cs-text-muted)", marginBottom: 4 }}>
              Reason
            </div>
            <select
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value as BlockReason)}
              style={{
                ...inputStyle,
                paddingRight: "1.5rem",
                appearance: "none",
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239C8878' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 8px center",
              }}
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
            style={{
              backgroundColor: "var(--cs-sand)",
              color: "#fff",
              border: "none",
              borderRadius: "var(--cs-r-sm)",
              height: 36,
              padding: "0 14px",
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            <Check size={14} style={{ marginRight: 4 }} />
            Add
          </Button>
        </div>
      </div>

      {/* Blocked times list */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--cs-text)", marginBottom: 8 }}>
          Blocked Entries
          <span
            style={{
              marginLeft: 6,
              fontSize: 11,
              fontWeight: 500,
              color: "var(--cs-text-muted)",
              background: "var(--cs-surface)",
              padding: "1px 7px",
              borderRadius: "var(--cs-r-pill)",
            }}
          >
            {blockedTimes.length}
          </span>
        </div>

        {blockedTimes.length === 0 ? (
          <div
            style={{
              padding: "20px 16px",
              textAlign: "center",
              fontSize: "0.8125rem",
              color: "var(--cs-text-muted)",
              background: "var(--cs-surface)",
              border: "1px solid var(--cs-border-soft)",
              borderRadius: "var(--cs-r-lg)",
            }}
          >
            <ShieldAlert size={18} style={{ color: "var(--cs-text-subtle)", margin: "0 auto 6px" }} />
            No blocked time entries.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {blockedTimes.map((block) => {
              const reasonStyle = REASON_COLORS[block.reason] ?? REASON_COLORS.other!;
              return (
                <div
                  key={block.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "0.75rem",
                    padding: "10px 14px",
                    background: "var(--cs-surface)",
                    border: "1px solid var(--cs-border-soft)",
                    borderRadius: "var(--cs-r-md)",
                    transition: "box-shadow 120ms ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: "50%",
                        background: reasonStyle.bg,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: reasonStyle.color,
                        fontSize: 12,
                        fontWeight: 600,
                        flexShrink: 0,
                      }}
                    >
                      {block.block_date.slice(8)}
                    </div>
                    <div>
                      <div style={{ fontSize: "0.8125rem", fontWeight: 500, color: "var(--cs-text)" }}>
                        {formatDateLabel(block.block_date)}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--cs-text-muted)", marginTop: 2 }}>
                        {shortTime(block.start_time)} – {shortTime(block.end_time)}
                        <span
                          style={{
                            marginLeft: 6,
                            fontSize: 10,
                            fontWeight: 600,
                            padding: "1px 6px",
                            background: reasonStyle.bg,
                            color: reasonStyle.color,
                            borderRadius: "var(--cs-r-pill)",
                          }}
                        >
                          {REASON_LABELS[block.reason] ?? block.reason}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeBlockedTime(block.id)}
                    disabled={isPending}
                    className="cs-btn cs-btn-ghost cs-btn-sm"
                    style={{
                      color: "var(--cs-error)",
                      padding: "4px 8px",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <Trash2 size={13} />
                    <span style={{ fontSize: 11 }}>Remove</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
