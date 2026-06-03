import Link from "next/link";
import { MapPin, Clock, ChevronRight } from "lucide-react";
import { formatTime12h } from "@/lib/utils/time-format";
import type { RealDispatchItem } from "@/lib/queries/dispatch-queries";

function getCountdown(startTime: string): string {
  const now = new Date();
  const [h = 0, m = 0] = startTime.split(":").map(Number);
  const diffMin = h * 60 + m - (now.getHours() * 60 + now.getMinutes());
  if (diffMin <= 0) return "Now";
  if (diffMin < 60) return `In ${diffMin}m`;
  return `In ${Math.floor(diffMin / 60)}h ${diffMin % 60}m`;
}

function getNextStop(items: RealDispatchItem[]): RealDispatchItem | null {
  const active = items.filter((i) => !["completed", "cancelled"].includes(i.dispatchStatus));
  // Prefer the one currently in_route or arrived
  const inProgress = active.find((i) => ["in_route", "arrived_at_customer", "service_started"].includes(i.dispatchStatus));
  if (inProgress) return inProgress;
  // Fall back to earliest upcoming
  return active.sort((a, b) => a.startTime.localeCompare(b.startTime))[0] ?? null;
}

export function DriverNextStopCard({ items }: { items: RealDispatchItem[] }) {
  const next = getNextStop(items);

  if (!next) {
    return (
      <div style={{ backgroundColor: "#fff", borderRadius: 16, border: "1px solid var(--cs-border-soft)", padding: "1rem 1.125rem", boxShadow: "var(--cs-shadow-xs)" }}>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--cs-text-muted)", marginBottom: "0.5rem" }}>Next Stop</div>
        <div style={{ fontSize: 13, color: "var(--cs-text-muted)" }}>No upcoming stops.</div>
      </div>
    );
  }

  const address = next.formattedAddress ?? next.area;
  const countdown = getCountdown(next.startTime);

  return (
    <Link
      href={`/staff-portal/jobs/${next.id}`}
      style={{ textDecoration: "none", display: "block" }}
    >
      <div style={{ backgroundColor: "#fff", borderRadius: 16, border: "1px solid var(--cs-border-soft)", borderLeft: "3px solid var(--cs-staff-accent)", padding: "1rem 1.125rem", boxShadow: "var(--cs-shadow-xs)", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--cs-staff-accent)" }}>Next Stop</div>
          <div style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 100, backgroundColor: "var(--cs-success-bg)", color: "var(--cs-success)", border: "1px solid rgba(90,138,106,0.2)" }}>
            {countdown}
          </div>
        </div>

        {/* Customer */}
        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--cs-text)", lineHeight: 1.25 }}>
          {next.customerName}
        </div>

        {/* Address */}
        {address && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 5, fontSize: 13, color: "var(--cs-text-muted)" }}>
            <MapPin size={13} style={{ flexShrink: 0, marginTop: 1 }} />
            <span style={{ lineHeight: 1.4 }}>{address}</span>
          </div>
        )}

        {/* Service + time */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "0.125rem" }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--cs-text)" }}>{next.serviceName}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--cs-text-muted)", marginTop: 2 }}>
              <Clock size={11} />
              {formatTime12h(next.startTime)}
            </div>
          </div>
          <ChevronRight size={18} color="var(--cs-text-muted)" />
        </div>
      </div>
    </Link>
  );
}
