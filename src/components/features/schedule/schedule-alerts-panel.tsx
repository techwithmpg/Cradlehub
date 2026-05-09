"use client";

import { AlertTriangle, Car, DoorOpen, UserX } from "lucide-react";

export type ScheduleAlert = {
  id: string;
  type: "travel_buffer" | "room_conflict" | "missing_assignment";
  title: string;
  description: string;
};

type ScheduleAlertsPanelProps = {
  alerts: ScheduleAlert[];
};

const ALERT_META: Record<ScheduleAlert["type"], { icon: typeof AlertTriangle; color: string; bg: string }> = {
  travel_buffer: { icon: Car, color: "#D97706", bg: "#FFF7ED" },
  room_conflict: { icon: DoorOpen, color: "#DC2626", bg: "#FEF2F2" },
  missing_assignment: { icon: UserX, color: "#7C3AED", bg: "#F5F3FF" },
};

export function ScheduleAlertsPanel({ alerts }: ScheduleAlertsPanelProps) {
  if (alerts.length === 0) return null;

  const visible = alerts.slice(0, 3);

  return (
    <div
      style={{
        backgroundColor: "var(--cs-surface)",
        border: "1px solid var(--cs-border)",
        borderRadius: 10,
        padding: "0.875rem 1rem",
      }}
    >
      <div
        style={{
          fontSize: "0.6875rem",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: "var(--cs-text-muted)",
          marginBottom: "0.625rem",
        }}
      >
        Schedule Alerts
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "0.75rem" }}>
        {visible.map((alert) => {
          const meta = ALERT_META[alert.type];
          const Icon = meta.icon;
          return (
            <div
              key={alert.id}
              style={{
                backgroundColor: meta.bg,
                border: `1px solid ${meta.color}22`,
                borderRadius: 8,
                padding: "0.625rem 0.75rem",
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
                minWidth: 0,
              }}
            >
              <Icon size={14} style={{ color: meta.color, flexShrink: 0, marginTop: 2 }} />
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    color: meta.color,
                    lineHeight: 1.3,
                  }}
                >
                  {alert.title}
                </div>
                <div
                  style={{
                    fontSize: "0.6875rem",
                    color: "var(--cs-text-muted)",
                    marginTop: 2,
                    lineHeight: 1.3,
                  }}
                >
                  {alert.description}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
