import { CalendarX2 } from "lucide-react";

export function StaffAppointmentsEmptyState() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2.5rem 1rem",
        textAlign: "center",
        backgroundColor: "var(--cs-surface)",
        border: "1px solid var(--cs-border-soft)",
        borderRadius: "var(--cs-r-lg)",
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: "var(--cs-r-md)",
          backgroundColor: "var(--cs-sand-mist)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "0.875rem",
          color: "var(--cs-sand)",
        }}
      >
        <CalendarX2 size={22} />
      </div>
      <div style={{ fontSize: 15, fontWeight: 600, color: "var(--cs-text)", marginBottom: "0.25rem" }}>
        No appointments today
      </div>
      <div
        style={{
          fontSize: 13,
          color: "var(--cs-text-muted)",
          maxWidth: 280,
          lineHeight: 1.5,
        }}
      >
        You have no scheduled appointments for today.
        <br />
        Check back later — new bookings will appear here automatically.
      </div>
    </div>
  );
}
