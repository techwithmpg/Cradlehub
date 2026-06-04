import { Bell, Route, Truck } from "lucide-react";

type DriverTripsHeaderProps = {
  todayLabel: string;
  totalToday: number;
  activeCount: number;
};

export function DriverTripsHeader({ todayLabel, totalToday, activeCount }: DriverTripsHeaderProps) {
  const summary =
    totalToday === 0
      ? "No jobs scheduled today"
      : `${totalToday} job${totalToday === 1 ? "" : "s"} today`;

  return (
    <header
      style={{
        backgroundColor: "#fff",
        borderBottom: "1px solid var(--cs-border-soft)",
        position: "sticky",
        top: 0,
        zIndex: 30,
      }}
    >
      <div
        style={{
          alignItems: "center",
          display: "flex",
          gap: "0.75rem",
          padding: "0.875rem 1rem 0.75rem",
        }}
      >
        <div
          style={{
            alignItems: "center",
            backgroundColor: "var(--cs-surface-warm)",
            border: "1px solid var(--cs-border-soft)",
            borderRadius: 14,
            display: "flex",
            height: 42,
            justifyContent: "center",
            width: 42,
          }}
        >
          <Truck size={20} color="var(--cs-staff-accent)" strokeWidth={1.9} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ color: "var(--cs-text)", fontSize: 20, fontWeight: 800, lineHeight: 1.1, margin: 0 }}>
            Trips
          </h1>
          <div style={{ color: "var(--cs-text-muted)", fontSize: 12.5, marginTop: 3 }}>
            {todayLabel} · {summary}
          </div>
        </div>
        <div
          aria-label={activeCount > 0 ? `${activeCount} active trip` : "No active trip"}
          style={{
            alignItems: "center",
            backgroundColor: activeCount > 0 ? "var(--cs-success-bg)" : "var(--cs-surface-warm)",
            border: `1px solid ${activeCount > 0 ? "rgba(90,138,106,0.2)" : "var(--cs-border-soft)"}`,
            borderRadius: 999,
            color: activeCount > 0 ? "var(--cs-success)" : "var(--cs-text-muted)",
            display: "flex",
            fontSize: 11,
            fontWeight: 700,
            gap: 5,
            padding: "0.375rem 0.625rem",
            whiteSpace: "nowrap",
          }}
        >
          <Route size={13} />
          {activeCount > 0 ? "Active" : "Clear"}
        </div>
        <div
          style={{
            alignItems: "center",
            border: "1px solid var(--cs-border-soft)",
            borderRadius: 999,
            color: "var(--cs-text-muted)",
            display: "flex",
            height: 34,
            justifyContent: "center",
            width: 34,
          }}
        >
          <Bell size={16} strokeWidth={1.75} />
        </div>
      </div>
    </header>
  );
}
