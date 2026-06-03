import { Clock, Navigation } from "lucide-react";
import { formatTime12h } from "@/lib/utils/time-format";
import type { RealDispatchItem } from "@/lib/queries/dispatch-queries";

function getNavUrl(item: RealDispatchItem): string {
  if (item.lat !== null && item.lng !== null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${item.lat},${item.lng}&travelmode=driving`;
  }
  if (item.formattedAddress) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.formattedAddress)}`;
  }
  if (item.area) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.area)}`;
  }
  return "https://www.google.com/maps";
}

export function DriverRouteBottomCard({ nextStop }: { nextStop: RealDispatchItem }) {
  const navUrl = getNavUrl(nextStop);
  const address = nextStop.formattedAddress ?? nextStop.area ?? "Address pending";

  return (
    <div
      style={{
        backgroundColor: "#fff",
        border: "1px solid var(--cs-border-soft)",
        borderRadius: 18,
        boxShadow: "var(--cs-shadow-md)",
        padding: "1rem 1.125rem",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.75rem" }}>
        <div>
          <div style={{ color: "var(--cs-text-muted)", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>
            Next Stop
          </div>
          <div style={{ color: "var(--cs-text)", fontSize: 16, fontWeight: 700, marginTop: 6 }}>
            {nextStop.customerName}
          </div>
          <div style={{ color: "var(--cs-text-muted)", fontSize: 13, lineHeight: 1.45, marginTop: 3 }}>
            {address}
          </div>
        </div>
        <span
          style={{
            backgroundColor: "rgba(139,92,246,0.1)",
            borderRadius: 999,
            color: "#7C3AED",
            flexShrink: 0,
            fontSize: 11,
            fontWeight: 700,
            padding: "3px 9px",
          }}
        >
          {formatTime12h(nextStop.startTime)}
        </span>
      </div>

      <div style={{ display: "flex", gap: "0.875rem", marginTop: "0.75rem", color: "var(--cs-text-muted)", fontSize: 12 }}>
        {nextStop.etaMinutes ? <span>{nextStop.etaMinutes} min</span> : null}
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <Clock size={12} />
          {nextStop.serviceName}
        </span>
      </div>

      <a
        href={navUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          alignItems: "center",
          backgroundColor: "var(--cs-staff-accent)",
          borderRadius: 13,
          color: "#fff",
          display: "flex",
          fontSize: 13,
          fontWeight: 700,
          gap: 6,
          justifyContent: "center",
          marginTop: "0.875rem",
          padding: "0.72rem",
          textDecoration: "none",
        }}
      >
        <Navigation size={15} />
        Start Navigation
      </a>
    </div>
  );
}
