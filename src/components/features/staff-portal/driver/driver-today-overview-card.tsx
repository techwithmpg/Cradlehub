import Link from "next/link";
import { Route } from "lucide-react";
import type { RealDispatchItem, DispatchStats } from "@/lib/queries/dispatch-queries";

type DriverTodayOverviewCardProps = {
  items: RealDispatchItem[];
  stats: DispatchStats;
};

function getRouteStatus(items: RealDispatchItem[]): string {
  if (items.length === 0) return "No route assigned";
  if (items.some((i) => i.dispatchStatus === "in_route")) return "On Route";
  if (items.some((i) => i.dispatchStatus === "arrived_at_customer")) return "Arrived at Stop";
  if (items.some((i) => i.dispatchStatus === "service_started")) return "Service in Progress";
  if (items.every((i) => ["completed", "cancelled"].includes(i.dispatchStatus))) return "Route Completed";
  return "Waiting for Dispatch";
}

export function DriverTodayOverviewCard({ items, stats }: DriverTodayOverviewCardProps) {
  const routeStatus = getRouteStatus(items);
  const hasJobs = items.length > 0;
  const activeCount = stats.totalToday;

  return (
    <div style={{ backgroundColor: "#fff", borderRadius: 16, border: "1px solid var(--cs-border-soft)", padding: "1rem 1.125rem", boxShadow: "var(--cs-shadow-xs)", display: "flex", flexDirection: "column", gap: "0.625rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "0.125rem" }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: "var(--cs-surface-warm)", border: "1px solid var(--cs-border-soft)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Route size={15} color="var(--cs-staff-accent)" />
        </div>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--cs-text-muted)" }}>
          {"Today's Overview"}
        </div>
      </div>

      <div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--cs-text)", lineHeight: 1.25 }}>{routeStatus}</div>
        <div style={{ fontSize: 13, color: "var(--cs-text-muted)", marginTop: 3 }}>
          {hasJobs
            ? `You have ${activeCount} assigned job${activeCount !== 1 ? "s" : ""} today.`
            : "New dispatch assignments will appear here automatically."}
        </div>
      </div>

      {hasJobs && (
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          {[
            { label: "Total", value: stats.totalToday, color: "var(--cs-text)" },
            { label: "Active", value: stats.activeTrips, color: "var(--cs-staff-accent)" },
            { label: "Done", value: stats.completedToday, color: "var(--cs-success)" },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ textAlign: "center", minWidth: 44 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color, fontVariantNumeric: "tabular-nums" }}>{value}</div>
              <div style={{ fontSize: 10, color: "var(--cs-text-muted)", marginTop: 1 }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      <Link
        href="/staff-portal/map"
        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "0.625rem", borderRadius: 12, backgroundColor: "var(--cs-staff-accent)", color: "#fff", textDecoration: "none", fontSize: 13, fontWeight: 700 }}
      >
        {hasJobs ? "View Route" : "Open Map"}
      </Link>
    </div>
  );
}
