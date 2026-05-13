"use client";

import { CalendarDays, Timer, CheckCircle2, CreditCard, Home, AlertTriangle } from "lucide-react";

export type ControlKpiData = {
  total: number;
  active: number;
  inProgress: number;
  completed: number;
  unpaid: number;
  homeService: number;
  issues: number;
};

export function ControlKpiStrip({ data }: { data: ControlKpiData }) {
  const cards = [
    { label: "Total", value: data.total, icon: CalendarDays, color: "var(--cs-text)", bg: "var(--cs-surface-warm)" },
    { label: "Active", value: data.active, icon: Timer, color: "var(--cs-sand)", bg: "var(--cs-sand-mist)" },
    { label: "In Progress", value: data.inProgress, icon: Timer, color: "var(--cs-info)", bg: "#EFF6FF" },
    { label: "Completed", value: data.completed, icon: CheckCircle2, color: "var(--cs-success)", bg: "#ECFDF5" },
    { label: "Unpaid", value: data.unpaid, icon: CreditCard, color: data.unpaid > 0 ? "var(--cs-error)" : "var(--cs-text-muted)", bg: data.unpaid > 0 ? "#FEF2F2" : "var(--cs-surface-warm)" },
    { label: "Home Svc", value: data.homeService, icon: Home, color: "#92400E", bg: "#FFF7ED" },
    { label: "Issues", value: data.issues, icon: AlertTriangle, color: data.issues > 0 ? "#EF4444" : "var(--cs-text-muted)", bg: data.issues > 0 ? "#FEE2E2" : "var(--cs-surface-warm)" },
  ];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))",
        gap: "0.625rem",
        marginBottom: "1.5rem",
      }}
    >
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className="cs-card"
            style={{
              padding: "0.75rem 0.875rem",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 7,
                backgroundColor: card.bg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Icon size={14} style={{ color: card.color }} />
            </div>
            <div>
              <div style={{ fontSize: "1rem", fontWeight: 700, color: card.color, lineHeight: 1.2 }}>
                {card.value}
              </div>
              <div
                style={{
                  fontSize: "0.625rem",
                  color: "var(--cs-text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                {card.label}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
