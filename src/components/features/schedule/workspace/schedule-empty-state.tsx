"use client";

import { Info } from "lucide-react";

export function ScheduleEmptyState({
  title,
  description,
  icon,
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.75rem",
        padding: "2.5rem 1.5rem",
        textAlign: "center",
        borderRadius: "var(--cs-r-xl)",
        background: "var(--cs-surface-warm)",
        border: "1px dashed var(--cs-border-soft)",
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--cs-surface)",
          color: "var(--cs-text-muted)",
        }}
      >
        {icon ?? <Info size={18} />}
      </div>
      <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--cs-text-secondary)" }}>
        {title}
      </div>
      {description && (
        <div style={{ fontSize: "0.8125rem", color: "var(--cs-text-muted)", maxWidth: 360, lineHeight: 1.5 }}>
          {description}
        </div>
      )}
    </div>
  );
}
