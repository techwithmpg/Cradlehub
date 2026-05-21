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
        padding: "12px 16px",
        background: "var(--cs-sand-tint)",
        border: "1px solid var(--cs-border-soft)",
        borderRadius: "var(--cs-r-md)",
        marginTop: "1rem",
      }}
    >
      <Lightbulb size={16} style={{ color: "var(--cs-sand)", flexShrink: 0 }} />
      <p style={{ fontSize: 12, color: "var(--cs-text-secondary)", margin: 0, lineHeight: 1.5 }}>
        <strong style={{ color: "var(--cs-text)" }}>How it works:</strong>{" "}
        Staff in {groupName ? `the ${groupName} group` : "this group"} follow these universal rules
        unless customized in{" "}
        <strong>Individual Adjustments</strong>. Live Availability still depends on check-in and
        current bookings.
      </p>
    </div>
  );
}
