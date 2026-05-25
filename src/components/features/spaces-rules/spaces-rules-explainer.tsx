/**
 * SpacesRulesExplainer
 *
 * Three cards explaining how each booking flow uses rooms, resources,
 * and booking rules. Server component — no client state, no queries.
 *
 * In-Spa Rules     — rooms, slot intervals, branch capacity
 * In-House/Walk-In — same spaces + live room readiness + check-in
 * Home-Service     — home-service windows, travel buffers, dispatch
 */

import Link from "next/link";

type ExplainerCard = {
  icon: string;
  title: string;
  badge: string;
  badgeColor: string;
  badgeBg: string;
  description: string;
  links?: { label: string; href: string }[];
};

const CARDS: ExplainerCard[] = [
  {
    icon: "🏠",
    title: "In-Spa Rules",
    badge: "Affects online & in-house booking",
    badgeColor: "var(--cs-info,#2980b9)",
    badgeBg: "rgba(41,128,185,0.08)",
    description:
      "Controls how in-spa appointments use rooms and resources — booking windows, slot intervals, branch capacity, and resource assignment. Online booking checks these rules to determine whether a time slot is available.",
  },
  {
    icon: "🚶",
    title: "In-House / Walk-In",
    badge: "Uses live readiness too",
    badgeColor: "var(--cs-sand,#b08850)",
    badgeBg: "rgba(176,136,80,0.08)",
    description:
      "Walk-ins and CRM-managed bookings use the same spaces and rules, but CRM also considers live room readiness, current bookings, and daily staff check-in before confirming availability.",
    links: [
      { label: "Daily Operations Center →", href: "/crm/today" },
      { label: "Live Availability →", href: "/crm/availability" },
    ],
  },
  {
    icon: "🚗",
    title: "Home-Service Rules",
    badge: "Dispatch & location",
    badgeColor: "var(--cs-success,#27ae60)",
    badgeBg: "rgba(39,174,96,0.08)",
    description:
      "Home-service bookings use separate time windows, travel buffers, customer address/location data, driver readiness, and the dispatch workflow. These settings are configured in Booking Rules.",
    links: [
      { label: "Dispatch →", href: "/crm/dispatch" },
      { label: "Schedule Setup →", href: "/crm/staff-availability" },
    ],
  },
];

function ExplainerCard({ card }: { card: ExplainerCard }) {
  return (
    <div
      className="cs-card"
      style={{
        padding: "1.125rem 1.25rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.625rem",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.625rem",
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontSize: 20, flexShrink: 0 }}>{card.icon}</span>
        <span
          style={{
            fontSize: "0.9375rem",
            fontWeight: 600,
            color: "var(--cs-text)",
            fontFamily: "var(--font-display)",
            flex: 1,
          }}
        >
          {card.title}
        </span>
        <span
          style={{
            fontSize: "0.6875rem",
            fontWeight: 700,
            color: card.badgeColor,
            background: card.badgeBg,
            padding: "2px 8px",
            borderRadius: 20,
            letterSpacing: "0.03em",
            whiteSpace: "nowrap",
          }}
        >
          {card.badge}
        </span>
      </div>

      <div
        style={{
          fontSize: "0.8125rem",
          color: "var(--cs-text-muted)",
          lineHeight: 1.6,
          flex: 1,
        }}
      >
        {card.description}
      </div>

      {card.links && card.links.length > 0 && (
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {card.links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              style={{
                fontSize: "0.75rem",
                fontWeight: 600,
                color: "var(--cs-brand)",
                textDecoration: "none",
                padding: "3px 10px",
                borderRadius: 20,
                border: "1px solid var(--cs-border-soft)",
                background: "var(--cs-surface-warm)",
                display: "inline-block",
              }}
            >
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function SpacesRulesExplainer() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {/* Architecture note */}
      <div
        style={{
          padding: "10px 14px",
          borderRadius: "var(--cs-r-sm,8px)",
          background: "rgba(41,128,185,0.05)",
          border: "1px solid rgba(41,128,185,0.2)",
          fontSize: "0.8125rem",
          color: "var(--cs-text-secondary)",
          lineHeight: 1.5,
        }}
      >
        <strong style={{ color: "var(--cs-info,#2980b9)" }}>
          Online booking follows saved schedules, services, booking rules, and resource availability where supported — not daily staff check-in.
        </strong>
        {" CRM live operations also depend on daily room readiness and staff check-in."}
      </div>

      {/* 3 rule-type cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: "0.875rem",
        }}
      >
        {CARDS.map((card) => (
          <ExplainerCard key={card.title} card={card} />
        ))}
      </div>
    </div>
  );
}
