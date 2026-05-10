import { CalendarDays, Timer, Users, DoorOpen, AlertTriangle } from "lucide-react";
import type { TodayKpiData } from "./manager-today-utils";

export function ManagerTodayKpiCards({ data }: { data: TodayKpiData }) {
  const cards = [
    {
      label: "Today's Bookings",
      value: data.totalBookings,
      icon: CalendarDays,
      color: "var(--cs-text)",
      bg: "var(--cs-surface-warm)",
    },
    {
      label: "In Progress",
      value: data.inProgress,
      icon: Timer,
      color: "var(--cs-sand)",
      bg: "var(--cs-sand-mist)",
    },
    {
      label: "Staff Available",
      value: data.staffAvailable,
      icon: Users,
      color: "#4A7C59",
      bg: "var(--cs-success-bg)",
    },
    {
      label: "Missing Rooms",
      value: data.missingRooms,
      icon: DoorOpen,
      color: data.missingRooms > 0 ? "#D97706" : "var(--cs-text-muted)",
      bg: data.missingRooms > 0 ? "#FEF3C7" : "var(--cs-surface-warm)",
    },
    {
      label: "Conflicts",
      value: data.conflicts,
      icon: AlertTriangle,
      color: data.conflicts > 0 ? "#EF4444" : "var(--cs-text-muted)",
      bg: data.conflicts > 0 ? "#FEE2E2" : "var(--cs-surface-warm)",
    },
  ];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
        gap: "0.75rem",
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
              padding: "0.875rem 1rem",
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                backgroundColor: card.bg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Icon size={16} style={{ color: card.color }} />
            </div>
            <div>
              <div
                style={{
                  fontSize: "1.125rem",
                  fontWeight: 700,
                  color: card.color,
                  lineHeight: 1.2,
                }}
              >
                {card.value}
              </div>
              <div
                style={{
                  fontSize: "0.6875rem",
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
