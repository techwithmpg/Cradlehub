/**
 * ScheduleSetupExplainer
 *
 * Three cards explaining what each schedule layer does and how it affects
 * booking. Server component — no client state.
 *
 * Architecture rule communicated here:
 *   Online booking = saved schedules + blocked time (NOT daily check-in)
 *   In-house CRM  = schedule + daily check-in + live status
 *   Home-service  = schedule + dispatch/location
 */

import Link from "next/link";

type ExplainerCard = {
  icon: string;
  title: string;
  badge: string;
  badgeColor: string;
  badgeBg: string;
  description: string;
  tabHint?: string; // which workspace tab to use
  linkLabel?: string;
  linkHref?: string;
};

const CARDS: ExplainerCard[] = [
  {
    icon: "📅",
    title: "Weekly Schedule",
    badge: "Affects online booking",
    badgeColor: "var(--cs-info,#2980b9)",
    badgeBg: "rgba(41,128,185,0.08)",
    description:
      "Normal weekly working hours for each staff member or group. Online booking uses this to calculate future availability for customers. Set these first before configuring anything else.",
    tabHint: "Edit in the General Rules or Individual Adjustments tab below.",
  },
  {
    icon: "🚫",
    title: "Overrides & Blocked Time",
    badge: "Blocks specific slots",
    badgeColor: "var(--cs-warning,#e67e22)",
    badgeBg: "rgba(230,126,34,0.08)",
    description:
      "One-day changes, absences, breaks, and unavailable periods. These override the weekly schedule for specific dates and block those time slots in both online and CRM bookings.",
    tabHint: "Manage in the Overrides tab below.",
  },
  {
    icon: "✅",
    title: "Live Check-In",
    badge: "In-house only",
    badgeColor: "var(--cs-success,#27ae60)",
    badgeBg: "rgba(39,174,96,0.08)",
    description:
      "Daily staff check-in records who is physically present and ready for CRM in-house operations. It does not control online booking — customers always book against saved schedules.",
    linkLabel: "Open Live Availability →",
    linkHref: "/crm/availability",
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
      <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", flexWrap: "wrap" }}>
        <span style={{ fontSize: 20 }}>{card.icon}</span>
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

      <div style={{ fontSize: "0.8125rem", color: "var(--cs-text-muted)", lineHeight: 1.6 }}>
        {card.description}
      </div>

      {card.tabHint && (
        <div style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)", fontStyle: "italic" }}>
          {card.tabHint}
        </div>
      )}

      {card.linkHref && card.linkLabel && (
        <div>
          <Link
            href={card.linkHref}
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
            {card.linkLabel}
          </Link>
        </div>
      )}
    </div>
  );
}

export function ScheduleSetupExplainer() {
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
        <strong style={{ color: "var(--cs-info,#2980b9)" }}>Online booking follows saved schedules and blocked time — not daily staff check-in.</strong>
        {" CRM live availability also depends on check-in, but that is separate from this setup workspace."}
      </div>

      {/* 3 cards */}
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
