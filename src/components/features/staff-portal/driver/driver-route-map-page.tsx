import Link from "next/link";
import { MapPin, Clock, ChevronLeft } from "lucide-react";
import { formatTime12h } from "@/lib/utils/time-format";
import { DriverRouteBottomCard } from "./driver-route-bottom-card";
import type { RealDispatchItem } from "@/lib/queries/dispatch-queries";

function getNextStop(items: RealDispatchItem[]): RealDispatchItem | null {
  const active = items.filter((i) => !["completed", "cancelled"].includes(i.dispatchStatus));
  const inProgress = active.find((i) => ["in_route", "arrived_at_customer", "service_started"].includes(i.dispatchStatus));
  return inProgress ?? active.sort((a, b) => a.startTime.localeCompare(b.startTime))[0] ?? null;
}

const STATUS_COLOR: Record<string, string> = {
  in_route: "var(--cs-staff-accent)",
  arrived_at_customer: "#2563EB",
  service_started: "#7C3AED",
  completed: "var(--cs-success)",
  cancelled: "#9CA3AF",
  ready: "var(--cs-sand)",
  awaiting_driver: "#9CA3AF",
};

function StopRow({ item, index }: { item: RealDispatchItem; index: number }) {
  const isDone = ["completed", "cancelled"].includes(item.dispatchStatus);
  const address = item.formattedAddress ?? item.area;
  const dotColor = STATUS_COLOR[item.dispatchStatus] ?? "var(--cs-sand)";

  return (
    <Link href={`/staff-portal/jobs/${item.id}`} style={{ textDecoration: "none", display: "flex", gap: "0.875rem", alignItems: "flex-start", padding: "0.75rem 0", borderBottom: "1px solid var(--cs-border-soft)" }}>
      {/* Stop number */}
      <div style={{ width: 28, height: 28, borderRadius: "50%", backgroundColor: isDone ? "var(--cs-surface-warm)" : dotColor, color: isDone ? "var(--cs-text-muted)" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
        {index + 1}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: isDone ? "var(--cs-text-muted)" : "var(--cs-text)", lineHeight: 1.25 }}>
          {item.customerName}
        </div>
        {address && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 4, fontSize: 12, color: "var(--cs-text-muted)", marginTop: 2 }}>
            <MapPin size={11} style={{ flexShrink: 0, marginTop: 1 }} />
            <span style={{ lineHeight: 1.4 }}>{address}</span>
          </div>
        )}
        <div style={{ fontSize: 12, color: "var(--cs-text-muted)", marginTop: 3 }}>{item.serviceName}</div>
      </div>

      {/* Time */}
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 12, color: "var(--cs-text-muted)" }}>
          <Clock size={11} />
          {formatTime12h(item.startTime)}
        </div>
      </div>
    </Link>
  );
}

export function DriverRouteMapPage({ items }: { items: RealDispatchItem[] }) {
  const nextStop = getNextStop(items);
  const hasRoute = items.length > 0;

  return (
    <div style={{ minHeight: "100dvh", backgroundColor: "var(--cs-bg)" }}>
      {/* Header */}
      <div style={{ backgroundColor: "#fff", borderBottom: "1px solid var(--cs-border-soft)", padding: "0.875rem 1rem", position: "sticky", top: 0, zIndex: 30, display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <Link href="/staff-portal" style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid var(--cs-border-soft)", backgroundColor: "var(--cs-surface-warm)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--cs-text-muted)", textDecoration: "none" }}>
          <ChevronLeft size={18} />
        </Link>
        <h1 style={{ margin: 0, fontSize: 19, fontWeight: 700, color: "var(--cs-text)" }}>Route Map</h1>
      </div>

      <div style={{ padding: "0.875rem 1rem", display: "flex", flexDirection: "column", gap: "0.75rem", maxWidth: 480, marginLeft: "auto", marginRight: "auto" }}>
        {/* Map placeholder */}
        <div style={{ backgroundColor: "#E8F5E9", borderRadius: 16, border: "1px solid rgba(90,138,106,0.2)", height: 200, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.5rem", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(45deg, rgba(90,138,106,0.04), rgba(90,138,106,0.04) 10px, transparent 10px, transparent 20px)" }} />
          <MapPin size={32} color="var(--cs-staff-accent)" style={{ opacity: 0.7 }} />
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--cs-staff-accent)", textAlign: "center" }}>
            {hasRoute ? `${items.length} stop${items.length !== 1 ? "s" : ""} on your route` : "No route assigned"}
          </div>
          <div style={{ fontSize: 11, color: "var(--cs-text-muted)", textAlign: "center" }}>
            {hasRoute ? "Tap Start Navigation to open maps" : ""}
          </div>
        </div>

        {nextStop ? <DriverRouteBottomCard nextStop={nextStop} /> : null}

        {/* Route stops list */}
        {hasRoute && (
          <div style={{ backgroundColor: "#fff", borderRadius: 16, border: "1px solid var(--cs-border-soft)", padding: "0.75rem 1rem", boxShadow: "var(--cs-shadow-xs)" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--cs-text-muted)", marginBottom: "0.25rem" }}>Route Stops</div>
            {items.map((item, i) => <StopRow key={item.id} item={item} index={i} />)}
          </div>
        )}

        {!hasRoute && (
          <div style={{ backgroundColor: "#fff", borderRadius: 16, border: "1px solid var(--cs-border-soft)", padding: "2rem 1.5rem", textAlign: "center", boxShadow: "var(--cs-shadow-xs)" }}>
            <div style={{ fontSize: 13, color: "var(--cs-text-muted)" }}>No route available. Your route will appear once jobs are assigned.</div>
          </div>
        )}
      </div>
    </div>
  );
}
