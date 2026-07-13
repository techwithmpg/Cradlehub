"use client";

/**
 * CrmBookingFlowRules
 *
 * Three cards explaining how each CradleHub booking flow uses system data
 * differently. Informational / navigation only — no new queries, no mutations.
 *
 * Architecture rule carried from DECISIONS.md:
 *   Online     → strictly schedule-based, never depends on daily staff check-in
 *   In-House   → can use live check-in, room readiness, current operations
 *   Home-Service → dispatch / location / driver-readiness workflow
 */

import Link from "next/link";
import {
  type AdministrativeBookingMode,
  OpenAdministrativeBookingButton,
} from "@/components/features/bookings/administrative-booking-modal-provider";

type FlowLink = { label: string; href?: string; bookingMode?: AdministrativeBookingMode };

type BookingFlowCard = {
  title: string;
  badge: string;
  badgeColor: string;
  badgeBg: string;
  description: string;
  links: FlowLink[];
};

const FLOW_CARDS: BookingFlowCard[] = [
  {
    title: "Online Booking",
    badge: "Schedule-based",
    badgeColor: "var(--cs-info, #2980b9)",
    badgeBg: "rgba(41,128,185,0.08)",
    description:
      "Public online booking uses saved schedules, services, staff-service capability, blocked time, current bookings, and branch booking rules. It does not depend on daily staff check-in.",
    links: [
      { label: "Services",        href: "/crm/services" },
      { label: "Schedule Setup",  href: "/crm/schedule?tab=setup" },
      { label: "Spaces & Rules",  href: "/crm/spaces-rules" },
    ],
  },
  {
    title: "In-House / Walk-In",
    badge: "Live operations",
    badgeColor: "var(--cs-sand)",
    badgeBg: "var(--cs-sand-mist)",
    description:
      "CRM bookings can use daily staff check-in, the Daily Timeline, room readiness, current bookings, and operational status before confirming service.",
    links: [
      { label: "Daily Timeline", href: "/crm/schedule" },
      { label: "New Walk-in",       bookingMode: "walkin" },
      { label: "Today",             href: "/crm/today" },
    ],
  },
  {
    title: "Home Service",
    badge: "Dispatch workflow",
    badgeColor: "var(--cs-success)",
    badgeBg: "var(--cs-success-bg)",
    description:
      "Home-service bookings use address/location, travel buffer, therapist availability, driver/dispatch readiness, and home-service rules.",
    links: [
      { label: "New Home Service", bookingMode: "home_service" },
      { label: "Dispatch",         href: "/crm/dispatch" },
      { label: "Spaces & Rules",   href: "/crm/spaces-rules" },
    ],
  },
];

function FlowCard({ card }: { card: BookingFlowCard }) {
  return (
    <div
      className="cs-card"
      style={{
        padding: "1.125rem 1.25rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
      }}
    >
      {/* Title + badge row */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", flexWrap: "wrap" }}>
        <span
          style={{
            fontSize: "0.9375rem",
            fontWeight: 600,
            color: "var(--cs-text)",
            fontFamily: "var(--font-display)",
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

      {/* Description */}
      <div style={{ fontSize: "0.8125rem", color: "var(--cs-text-muted)", lineHeight: 1.6 }}>
        {card.description}
      </div>

      {/* Links */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
        {card.links.map((link) => {
          const style = {
            fontSize: "0.75rem",
            fontWeight: 600,
            color: "var(--cs-brand)",
            textDecoration: "none",
            padding: "3px 10px",
            borderRadius: 20,
            border: "1px solid var(--cs-border-soft)",
            background: "var(--cs-surface-warm)",
            whiteSpace: "nowrap",
          } satisfies React.CSSProperties;

          if (link.bookingMode) {
            return (
              <OpenAdministrativeBookingButton
                key={link.label}
                mode={link.bookingMode}
                showIcon={false}
                style={style}
              >
                {link.label} {"->"}
              </OpenAdministrativeBookingButton>
            );
          }

          return (
            <Link
              key={(link.href ?? "") + link.label}
              href={link.href ?? "#"}
              style={style}
            >
              {link.label} →
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function CrmBookingFlowRules() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <div style={{ fontSize: "0.8125rem", color: "var(--cs-text-muted)" }}>
        CradleHub uses the same system data differently depending on how the booking is created.
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: "0.875rem",
        }}
      >
        {FLOW_CARDS.map((card) => (
          <FlowCard key={card.title} card={card} />
        ))}
      </div>
    </div>
  );
}
