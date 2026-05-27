"use client";

import { Lightbulb } from "lucide-react";

type Props = {
  groupName?: string;
};

export function ScheduleSetupHelperBar({ groupName }: Props) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 14px",
        background: "var(--cs-sand-tint)",
        border: "1px solid var(--cs-border-soft)",
        borderRadius: "var(--cs-r-md)",
      }}
    >
      <Lightbulb size={14} style={{ color: "var(--cs-sand)", flexShrink: 0 }} />
      <p style={{ fontSize: 12, color: "var(--cs-text-secondary)", margin: 0, lineHeight: 1.5 }}>
        <strong style={{ color: "var(--cs-text)" }}>How it works:</strong>{" "}
        Staff in {groupName ? `the ${groupName} group` : "this group"} follow these universal rules
        unless customized in{" "}
        <strong>Individual Adjustments</strong>.
        For MVP, booking readiness follows saved schedules, blocked time, service assignments, and existing bookings.
        Daily check-in/check-out is paused.
      </p>
    </div>
  );
}
