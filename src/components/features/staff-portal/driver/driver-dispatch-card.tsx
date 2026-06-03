import Link from "next/link";
import { MapPin, Clock, ChevronRight } from "lucide-react";
import { formatTime12h } from "@/lib/utils/time-format";
import type { RealDispatchItem } from "@/lib/queries/dispatch-queries";
import type { DispatchStatus } from "@/features/dispatch/types";

const STATUS_LABEL: Record<DispatchStatus, string> = {
  awaiting_driver: "Unassigned",
  ready: "Assigned",
  in_route: "On the Way",
  arrived_at_customer: "Arrived",
  service_started: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

const STATUS_STYLE: Record<DispatchStatus, { bg: string; color: string }> = {
  awaiting_driver: { bg: "var(--cs-surface-warm)", color: "var(--cs-text-muted)" },
  ready: { bg: "rgba(251,191,36,0.12)", color: "#92700A" },
  in_route: { bg: "var(--cs-success-bg)", color: "var(--cs-success)" },
  arrived_at_customer: { bg: "rgba(59,130,246,0.1)", color: "#2563EB" },
  service_started: { bg: "rgba(139,92,246,0.1)", color: "#7C3AED" },
  completed: { bg: "var(--cs-success-bg)", color: "var(--cs-success)" },
  cancelled: { bg: "rgba(239,68,68,0.08)", color: "#DC2626" },
};

export function DriverDispatchCard({ item }: { item: RealDispatchItem }) {
  const { bg, color } = STATUS_STYLE[item.dispatchStatus];
  const label = STATUS_LABEL[item.dispatchStatus];
  const address = item.formattedAddress ?? item.area;

  return (
    <Link href={`/staff-portal/jobs/${item.id}`} style={{ textDecoration: "none", display: "block" }}>
      <div style={{ backgroundColor: "#fff", borderRadius: 14, border: "1px solid var(--cs-border-soft)", padding: "0.875rem 1rem", boxShadow: "var(--cs-shadow-xs)", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {/* Time + badge */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--cs-text)", fontVariantNumeric: "tabular-nums" }}>
            {formatTime12h(item.startTime)}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 100, backgroundColor: bg, color }}>
              {label}
            </span>
            <ChevronRight size={16} color="var(--cs-text-muted)" />
          </div>
        </div>

        {/* Customer */}
        <div style={{ fontSize: 15, fontWeight: 600, color: "var(--cs-text)" }}>{item.customerName}</div>

        {/* Address */}
        {address && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 5, fontSize: 12, color: "var(--cs-text-muted)" }}>
            <MapPin size={12} style={{ flexShrink: 0, marginTop: 1 }} />
            <span style={{ lineHeight: 1.4 }}>{address}</span>
          </div>
        )}

        {/* Service + ETA */}
        <div style={{ paddingTop: "0.25rem", borderTop: "1px solid var(--cs-border-soft)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 12, color: "var(--cs-text-secondary)", fontWeight: 500 }}>{item.serviceName}</span>
          {item.etaMinutes !== null && (
            <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, color: "var(--cs-text-muted)" }}>
              <Clock size={11} />
              Est. {item.etaMinutes} min
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
