"use client";

import { CheckCircle2, Clock, Users, AlertTriangle, ClipboardList } from "lucide-react";

export type ScheduleKpiData = {
  total: number;
  confirmed: number;
  in_progress: number;
  completed: number;
  available_staff: number;
  alerts: number;
};

type ScheduleKpiCardsProps = {
  data: ScheduleKpiData;
};

const KPI_DEF = [
  { key: "total" as const, label: "Total Bookings", icon: ClipboardList, sub: "scheduled today" },
  { key: "confirmed" as const, label: "Confirmed", icon: CheckCircle2, sub: "awaiting service" },
  { key: "in_progress" as const, label: "In Progress", icon: Clock, sub: "currently serving" },
  { key: "completed" as const, label: "Completed", icon: CheckCircle2, sub: "finished today" },
  { key: "available_staff" as const, label: "Available Staff", icon: Users, sub: "on duty now" },
  { key: "alerts" as const, label: "Alerts", icon: AlertTriangle, sub: "need attention", accent: true },
];

export function ScheduleKpiCards({ data }: ScheduleKpiCardsProps) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: "0.75rem" }}>
      {KPI_DEF.map((kpi) => {
        const value = data[kpi.key];
        const Icon = kpi.icon;
        const isAlert = kpi.key === "alerts" && value > 0;
        return (
          <div
            key={kpi.key}
            style={{
              backgroundColor: "var(--cs-surface)",
              border: "1px solid var(--cs-border)",
              borderRadius: 10,
              padding: "0.875rem 1rem",
              minWidth: 0,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: "0.375rem" }}>
              <Icon size={13} style={{ color: isAlert ? "#DC2626" : "var(--cs-text-muted)", flexShrink: 0 }} />
              <span
                style={{
                  fontSize: "0.625rem",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "var(--cs-text-muted)",
                }}
              >
                {kpi.label}
              </span>
            </div>
            <div
              style={{
                fontSize: "1.375rem",
                fontWeight: 700,
                color: isAlert ? "#DC2626" : "var(--cs-text)",
                fontFamily: "var(--font-playfair, serif)",
                lineHeight: 1.1,
              }}
            >
              {value}
            </div>
            <div style={{ fontSize: "0.625rem", color: "var(--cs-text-muted)", marginTop: 2 }}>{kpi.sub}</div>
          </div>
        );
      })}
    </div>
  );
}
