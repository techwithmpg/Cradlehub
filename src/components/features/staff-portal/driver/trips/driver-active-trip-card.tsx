import Link from "next/link";
import { Clock, MapPin, Navigation, Route } from "lucide-react";
import { formatTime12h } from "@/lib/utils/time-format";
import { DriverTripStatusBadge } from "./driver-trip-status-badge";
import type { RealDispatchItem } from "@/lib/queries/dispatch-queries";

type DriverActiveTripCardProps = {
  item: RealDispatchItem;
  detailsHref: string;
};

function getMapHref(item: RealDispatchItem): string | null {
  if (item.lat !== null && item.lng !== null) {
    return `https://www.google.com/maps/search/?api=1&query=${item.lat},${item.lng}`;
  }

  const query = item.formattedAddress ?? item.area;
  return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : null;
}

export function DriverActiveTripCard({ item, detailsHref }: DriverActiveTripCardProps) {
  const address = item.formattedAddress ?? item.area;
  const mapHref = getMapHref(item);

  return (
    <section
      style={{
        background: "linear-gradient(135deg, #0F5138 0%, #13674A 100%)",
        borderRadius: 22,
        boxShadow: "0 18px 38px rgba(15, 81, 56, 0.22)",
        color: "#fff",
        display: "flex",
        flexDirection: "column",
        gap: "0.85rem",
        overflow: "hidden",
        padding: "1rem",
      }}
    >
      <div style={{ alignItems: "center", display: "flex", justifyContent: "space-between", gap: "0.75rem" }}>
        <div style={{ alignItems: "center", display: "flex", gap: 8 }}>
          <div
            style={{
              alignItems: "center",
              backgroundColor: "rgba(255,255,255,0.14)",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: 14,
              display: "flex",
              height: 38,
              justifyContent: "center",
              width: 38,
            }}
          >
            <Route size={19} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", opacity: 0.72, textTransform: "uppercase" }}>
              Active Trip
            </div>
            <div style={{ fontSize: 14, fontWeight: 800, marginTop: 2 }}>{formatTime12h(item.startTime)}</div>
          </div>
        </div>
        <DriverTripStatusBadge status={item.dispatchStatus} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ fontSize: 20, fontWeight: 850, lineHeight: 1.15 }}>{item.customerName}</div>
        {address ? (
          <div style={{ alignItems: "flex-start", display: "flex", gap: 6, fontSize: 13, lineHeight: 1.45, opacity: 0.86 }}>
            <MapPin size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{address}</span>
          </div>
        ) : null}
      </div>

      <div
        style={{
          alignItems: "center",
          backgroundColor: "rgba(255,255,255,0.12)",
          border: "1px solid rgba(255,255,255,0.14)",
          borderRadius: 16,
          display: "flex",
          justifyContent: "space-between",
          padding: "0.75rem",
        }}
      >
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.68 }}>Service</div>
          <div style={{ fontSize: 14, fontWeight: 800, marginTop: 2 }}>{item.serviceName}</div>
        </div>
        {item.etaMinutes !== null ? (
          <div style={{ alignItems: "center", display: "flex", gap: 5, fontSize: 12, fontWeight: 800 }}>
            <Clock size={13} />
            {item.etaMinutes} min
          </div>
        ) : null}
      </div>

      <div style={{ display: "grid", gap: 8, gridTemplateColumns: mapHref ? "1fr 1fr" : "1fr" }}>
        <Link
          href={detailsHref}
          style={{
            alignItems: "center",
            backgroundColor: "#fff",
            borderRadius: 14,
            color: "#0F5138",
            display: "flex",
            fontSize: 13,
            fontWeight: 850,
            justifyContent: "center",
            minHeight: 42,
            textDecoration: "none",
          }}
        >
          Open Trip
        </Link>
        {mapHref ? (
          <a
            href={mapHref}
            rel="noreferrer"
            target="_blank"
            style={{
              alignItems: "center",
              backgroundColor: "rgba(255,255,255,0.13)",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: 14,
              color: "#fff",
              display: "flex",
              fontSize: 13,
              fontWeight: 850,
              gap: 6,
              justifyContent: "center",
              minHeight: 42,
              textDecoration: "none",
            }}
          >
            <Navigation size={15} />
            Navigate
          </a>
        ) : null}
      </div>
    </section>
  );
}
