import type { BranchBookingRules } from "@/lib/validations/booking-rules";
import { Clock, CalendarDays, Car, Sunrise, Sunset } from "lucide-react";

export function RuleImpactPreview({ rules }: { rules: BranchBookingRules }) {
  const items = [
    {
      icon: Sunrise,
      label: "In-spa hours",
      value: `${rules.inSpaStartTime} – ${rules.inSpaEndTime}`,
    },
    {
      icon: Sunset,
      label: "Home service hours",
      value: rules.homeServiceEnabled
        ? `${rules.homeServiceStartTime} – ${rules.homeServiceEndTime}`
        : "Disabled",
      muted: !rules.homeServiceEnabled,
    },
    {
      icon: CalendarDays,
      label: "Booking window",
      value: `${rules.maxAdvanceBookingDays} days in advance`,
    },
    {
      icon: Clock,
      label: "Travel buffer",
      value: `${rules.travelBufferMins} minutes`,
    },
    {
      icon: Car,
      label: "Driver capacity",
      value: `${rules.homeServiceDriverCapacity} concurrent trips`,
    },
  ];

  return (
    <div
      className="cs-card"
      style={{
        padding: "1.25rem",
        position: "sticky",
        top: "1rem",
      }}
    >
      <div
        style={{
          fontSize: "0.8125rem",
          fontWeight: 600,
          color: "var(--cs-text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: "1rem",
        }}
      >
        Rule Impact Preview
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
        {items.map((item) => (
          <div key={item.label} style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                backgroundColor: "var(--cs-surface-warm)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <item.icon size={13} style={{ color: "var(--cs-text-muted)" }} />
            </div>
            <div>
              <div style={{ fontSize: "0.6875rem", color: "var(--cs-text-muted)" }}>
                {item.label}
              </div>
              <div
                style={{
                  fontSize: "0.8125rem",
                  fontWeight: 500,
                  color: item.muted ? "var(--cs-text-muted)" : "var(--cs-text)",
                }}
              >
                {item.value}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: "1rem",
          paddingTop: "1rem",
          borderTop: "1px solid var(--cs-border)",
          fontSize: "0.75rem",
          color: "var(--cs-text-muted)",
          lineHeight: 1.5,
        }}
      >
        These rules affect public booking slots, in-house bookings, and walk-in availability.
      </div>
    </div>
  );
}
