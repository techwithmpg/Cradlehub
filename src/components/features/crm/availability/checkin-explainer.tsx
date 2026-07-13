import Link from "next/link";

// ── Card definitions ──────────────────────────────────────────────────────────

type ExplainerCard = {
  badge: string;
  badgeColor: string;
  icon: string;
  title: string;
  body: string;
  bullets: string[];
  links: Array<{ label: string; href: string }>;
};

const CARDS: ExplainerCard[] = [
  {
    badge: "In-House Operations",
    badgeColor: "var(--cs-warning)",
    icon: "🏷️",
    title: "Live Check-In Board",
    body: "CRM staff mark therapists and service providers as present by checking them in. Staff must be both scheduled for the day and checked in to appear as Available Now for in-house booking assignment.",
    bullets: [
      "Check in / check out staff directly from the Live Board",
      "See who is available, busy, not yet arrived, or off today",
      "Flag staff missing a weekly schedule under Needs Attention",
    ],
    links: [],
  },
  {
    badge: "Online Booking",
    badgeColor: "var(--cs-info)",
    icon: "📅",
    title: "Schedule-Based Only",
    body: "Public customers book using saved weekly schedules, booking rules, and resource availability — check-in status has zero effect on online booking. Slots open and close based on the saved schedule alone.",
    bullets: [
      "Not affected by check-in status at all",
      "Manage individual weekly schedules at Schedule Setup",
      "Set booking windows at Spaces & Booking Rules",
    ],
    links: [
      { label: "Schedule Setup", href: "/crm/schedule?tab=setup" },
      { label: "Spaces & Rules", href: "/crm/spaces-rules" },
    ],
  },
  {
    badge: "Home Service",
    badgeColor: "var(--cs-success)",
    icon: "🚐",
    title: "Dispatch & Driver Readiness",
    body: "Home service bookings use the dispatch workflow. The Driver Readiness tab shows which drivers are checked in and ready for same-day trips. The saved schedule sets the service availability window.",
    bullets: [
      "Driver Readiness tab shows check-in state for all drivers",
      "Schedule determines when home service slots are available",
      "Dispatch in Today manages route and trip assignments",
    ],
    links: [
      { label: "Daily Operations", href: "/crm/today" },
    ],
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

export function CheckInExplainer() {
  return (
    <div className="cs-card" style={{ padding: "1.25rem 1.5rem" }}>
      {/* Header */}
      <div style={{ marginBottom: "1rem" }}>
        <h2 style={{ fontSize: 13, fontWeight: 600, color: "var(--cs-text)", margin: 0 }}>
          How live availability works
        </h2>
        <p style={{ fontSize: 12, color: "var(--cs-text-muted)", margin: "0.3rem 0 0" }}>
          Three booking flows — each uses availability and check-in data differently.
        </p>
      </div>

      {/* Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "0.875rem",
        }}
      >
        {CARDS.map((card) => (
          <div
            key={card.badge}
            style={{
              background: "var(--cs-surface-raised)",
              border: "1px solid var(--cs-border-soft)",
              borderRadius: "var(--cs-r-md)",
              padding: "0.875rem 1rem",
            }}
          >
            {/* Badge */}
            <div style={{ marginBottom: "0.5rem" }}>
              <span
                style={{
                  display: "inline-block",
                  fontSize: 10,
                  fontWeight: 600,
                  color: card.badgeColor,
                  background: `${card.badgeColor}18`,
                  padding: "2px 7px",
                  borderRadius: 6,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                {card.badge}
              </span>
            </div>

            {/* Title */}
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "var(--cs-text)",
                marginBottom: "0.375rem",
              }}
            >
              {card.icon} {card.title}
            </div>

            {/* Body */}
            <p
              style={{
                fontSize: 11.5,
                color: "var(--cs-text-muted)",
                margin: "0 0 0.625rem",
                lineHeight: 1.55,
              }}
            >
              {card.body}
            </p>

            {/* Bullets */}
            <ul
              style={{
                fontSize: 11,
                color: "var(--cs-text-subtle)",
                margin: 0,
                padding: "0 0 0 1rem",
                lineHeight: 1.65,
              }}
            >
              {card.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>

            {/* Cross-links */}
            {card.links.length > 0 && (
              <div style={{ marginTop: "0.625rem", display: "flex", gap: 6, flexWrap: "wrap" }}>
                {card.links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    style={{
                      fontSize: 10,
                      color: "var(--cs-text-muted)",
                      border: "1px solid var(--cs-border-soft)",
                      borderRadius: 5,
                      padding: "2px 8px",
                      textDecoration: "none",
                    }}
                  >
                    → {link.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Architecture note */}
      <div
        style={{
          marginTop: "0.875rem",
          padding: "8px 12px",
          background: "var(--cs-surface-raised)",
          border: "1px solid var(--cs-border-soft)",
          borderRadius: "var(--cs-r-sm)",
          fontSize: 11,
          color: "var(--cs-text-muted)",
        }}
      >
        <strong style={{ color: "var(--cs-text)" }}>Architecture note:</strong>{" "}
        Online booking follows saved schedules and branch booking rules — not daily staff check-in.
        This board is for in-house and home-service operational awareness only. Checking in or out a
        staff member has <em>no effect</em> on what public customers see when booking online.
      </div>
    </div>
  );
}
