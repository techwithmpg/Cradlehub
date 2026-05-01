"use client";

import { Sparkles } from "lucide-react";

export function ReportsEmptyState() {
  return (
    <div
      style={{
        backgroundColor: "var(--cs-surface-warm)",
        border: "1px solid var(--cs-border-soft)",
        borderRadius: "var(--cs-r-lg)",
        padding: "3rem 2rem",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1rem",
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          backgroundColor: "var(--cs-sand-mist)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--cs-sand)",
        }}
      >
        <Sparkles size={28} />
      </div>
      <div style={{ maxWidth: 360 }}>
        <h3
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "1.25rem",
            fontWeight: 600,
            color: "var(--cs-text)",
            marginBottom: "0.5rem",
          }}
        >
          No report data yet
        </h3>
        <p
          style={{
            fontSize: "0.875rem",
            color: "var(--cs-text-muted)",
            lineHeight: 1.5,
          }}
        >
          Once bookings are completed and payments are recorded, your business analytics will appear here.
        </p>
      </div>
    </div>
  );
}
