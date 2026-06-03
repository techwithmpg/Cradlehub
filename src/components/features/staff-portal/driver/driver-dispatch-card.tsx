import Link from "next/link";
import { MapPin, Clock, ChevronRight } from "lucide-react";
import { formatTime12h } from "@/lib/utils/time-format";
import { DriverStatusBadge } from "./driver-status-badge";
import type { RealDispatchItem } from "@/lib/queries/dispatch-queries";

export function DriverDispatchCard({ item }: { item: RealDispatchItem }) {
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
            <DriverStatusBadge status={item.dispatchStatus} />
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
