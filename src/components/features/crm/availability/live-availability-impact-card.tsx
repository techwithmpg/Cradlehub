// ── Impact row type ────────────────────────────────────────────────────────────

type ImpactRow = {
  icon: string;
  flow: string;
  description: string;
  highlight?: "none" | "warning";
};

const ROWS: ImpactRow[] = [
  {
    icon: "🌐",
    flow: "Online booking",
    description:
      "Does not depend on this board. Online booking uses saved schedules, booking rules, and resource availability. Checking in or out a staff member has no effect on what public customers see.",
    highlight: "none",
  },
  {
    icon: "🏥",
    flow: "Walk-ins / in-house bookings",
    description:
      "Uses this board to know who is physically present and available right now. Staff must be scheduled and checked in to be considered available for same-day in-house assignment.",
    highlight: "warning",
  },
  {
    icon: "🚐",
    flow: "Home-service / dispatch",
    description:
      "Uses this board together with the dispatch workflow, driver readiness, travel time, and home-service rules. Drivers should be checked in before trips are assigned.",
    highlight: "warning",
  },
  {
    icon: "📋",
    flow: "Staff readiness visibility",
    description:
      "Feeds the Staff Readiness section in Today's Daily Operations Center. Check-in status helps CRM know real-time who to count on for the current shift.",
    highlight: "none",
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

export function LiveAvailabilityImpactCard() {
  return (
    <div className="cs-card" style={{ padding: "1.125rem 1.25rem" }}>
      {/* Header */}
      <div style={{ marginBottom: "0.875rem" }}>
        <h3
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--cs-text)",
            margin: 0,
          }}
        >
          What this affects
        </h3>
        <p
          style={{
            fontSize: 11,
            color: "var(--cs-text-muted)",
            margin: "0.25rem 0 0",
          }}
        >
          Check-in status on this board affects in-house and dispatch operations — not online booking.
        </p>
      </div>

      {/* Rows */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
        }}
      >
        {ROWS.map((row) => (
          <div
            key={row.flow}
            style={{
              display: "flex",
              gap: "0.75rem",
              padding: "0.625rem 0.75rem",
              background: "var(--cs-surface-raised)",
              border: "1px solid var(--cs-border-soft)",
              borderRadius: "var(--cs-r-sm)",
              alignItems: "flex-start",
            }}
          >
            {/* Icon */}
            <span
              style={{
                fontSize: 16,
                flexShrink: 0,
                marginTop: 1,
              }}
            >
              {row.icon}
            </span>

            {/* Content */}
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 3,
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--cs-text)",
                  }}
                >
                  {row.flow}
                </span>
                {row.highlight === "warning" && (
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      color: "var(--cs-warning)",
                      background: "var(--cs-warning)18",
                      padding: "1px 5px",
                      borderRadius: 4,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                    }}
                  >
                    Uses check-in
                  </span>
                )}
              </div>
              <p
                style={{
                  fontSize: 11,
                  color: "var(--cs-text-muted)",
                  margin: 0,
                  lineHeight: 1.55,
                }}
              >
                {row.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
