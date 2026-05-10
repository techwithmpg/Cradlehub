"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import type { TodayAlert } from "./manager-today-utils";

export function ManagerAlertsPanel({ alerts }: { alerts: TodayAlert[] }) {
  return (
    <div className="cs-card" style={{ padding: "1.25rem" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: "1rem",
        }}
      >
        <AlertTriangle size={16} style={{ color: "var(--cs-error)" }} />
        <div
          style={{
            fontSize: "0.8125rem",
            fontWeight: 600,
            color: "var(--cs-text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          Alerts
        </div>
      </div>

      {alerts.length === 0 ? (
        <div
          style={{
            padding: "1.5rem 0.5rem",
            textAlign: "center",
            color: "var(--cs-text-muted)",
            fontSize: "0.875rem",
          }}
        >
          <div style={{ fontSize: 24, marginBottom: 8 }}>✅</div>
          No alerts right now.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
          {alerts.map((alert) => {
            const bgColor =
              alert.severity === "critical"
                ? "#FEE2E2"
                : alert.severity === "warning"
                ? "#FEF3C7"
                : "#EEF0F8";
            const textColor =
              alert.severity === "critical"
                ? "#991B1B"
                : alert.severity === "warning"
                ? "#92400E"
                : "#1A2A5A";
            const badgeBg =
              alert.severity === "critical"
                ? "#FECACA"
                : alert.severity === "warning"
                ? "#FDE68A"
                : "#DBE2F5";

            return (
              <Link
                key={alert.id}
                href={alert.href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "0.5rem",
                  padding: "0.625rem 0.75rem",
                  borderRadius: "var(--cs-r-sm)",
                  backgroundColor: bgColor,
                  textDecoration: "none",
                  color: textColor,
                  fontSize: "0.8125rem",
                }}
              >
                <span style={{ fontWeight: 500 }}>{alert.label}</span>
                <span
                  style={{
                    fontSize: "0.6875rem",
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: 3,
                    backgroundColor: badgeBg,
                    color: textColor,
                    flexShrink: 0,
                  }}
                >
                  {alert.count}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
