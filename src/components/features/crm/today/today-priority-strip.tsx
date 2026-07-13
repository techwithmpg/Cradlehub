import Link from "next/link";
import type { CrmTodayBookingSummary, CrmTodayPayment, CrmAvailabilitySummary, DispatchStats } from "@/lib/queries/crm-today";

type Props = {
  bookingSummary: CrmTodayBookingSummary;
  staffReadiness: CrmAvailabilitySummary;
  dispatchStats: DispatchStats;
  payment: CrmTodayPayment | null;
  urgentCount: number;
};

type PriorityCard = {
  label: string;
  value: number;
  href: string;
  /** CSS colour token for the value label. Red-tones signal action needed. */
  valueColor: string;
  /** Faint background tint when value > 0 */
  activeTint?: string;
};

export function TodayPriorityStrip({
  bookingSummary,
  staffReadiness,
  dispatchStats,
  payment,
  urgentCount,
}: Props) {
  const cards: PriorityCard[] = [
    {
      label: "In Progress",
      value: bookingSummary.in_progress,
      href: "/crm/live-operations",
      valueColor: "var(--cs-sand)",
    },
    {
      label: "Unassigned",
      value: bookingSummary.unassigned,
      href: "/crm/bookings",
      valueColor:
        bookingSummary.unassigned > 0 ? "var(--cs-warning)" : "var(--cs-text-muted)",
      activeTint:
        bookingSummary.unassigned > 0 ? "var(--cs-warning-mist)" : undefined,
    },
    {
      label: "Not Checked In",
      value: staffReadiness.notCheckedIn,
      href: "/crm/schedule",
      valueColor:
        staffReadiness.notCheckedIn > 0 ? "var(--cs-info)" : "var(--cs-text-muted)",
    },
    {
      label: "Awaiting Dispatch",
      value: dispatchStats.awaitingDispatch,
      href: "/crm/dispatch",
      valueColor:
        dispatchStats.awaitingDispatch > 0 ? "var(--cs-warning)" : "var(--cs-text-muted)",
      activeTint:
        dispatchStats.awaitingDispatch > 0 ? "var(--cs-warning-mist)" : undefined,
    },
    {
      label: "Unpaid",
      value: payment?.unpaid_count ?? 0,
      href: "/crm/reconciliation",
      valueColor:
        (payment?.unpaid_count ?? 0) > 0 ? "var(--cs-error)" : "var(--cs-text-muted)",
      activeTint:
        (payment?.unpaid_count ?? 0) > 0 ? "var(--cs-error-mist)" : undefined,
    },
    {
      label: "Urgent Actions",
      value: urgentCount,
      href: "/crm/notifications",
      valueColor: urgentCount > 0 ? "var(--cs-error)" : "var(--cs-text-muted)",
      activeTint: urgentCount > 0 ? "var(--cs-error-mist)" : undefined,
    },
  ];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(6, 1fr)",
        gap: "0.625rem",
      }}
    >
      {cards.map((card) => (
        <Link
          key={card.label}
          href={card.href}
          style={{ textDecoration: "none" }}
        >
          <div
            className="cs-card"
            style={{
              padding: "0.875rem 1rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.375rem",
              background: card.activeTint ?? "var(--cs-surface)",
              transition: "opacity 0.15s",
              cursor: "pointer",
            }}
          >
            <div
              style={{
                fontSize: "1.5rem",
                fontWeight: 700,
                lineHeight: 1,
                color: card.valueColor,
                fontFamily: "var(--font-display)",
              }}
            >
              {card.value}
            </div>
            <div
              style={{
                fontSize: "0.6875rem",
                fontWeight: 600,
                color: "var(--cs-text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                lineHeight: 1.3,
              }}
            >
              {card.label}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
