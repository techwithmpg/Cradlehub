import Link from "next/link";
import { CalendarDays, ChevronRight, Clock, MapPin, Navigation, Sparkles } from "lucide-react";
import { formatTime12h } from "@/lib/utils/time-format";
import { DriverTripStatusBadge } from "./driver-trip-status-badge";
import type { RealDispatchItem } from "@/lib/queries/dispatch-queries";

type DriverTripCardProps = {
  item: RealDispatchItem;
  detailsHref: string;
  compactDate?: boolean;
};

function formatTripDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
  });
}

export function DriverTripCard({ item, detailsHref, compactDate = false }: DriverTripCardProps) {
  const address = item.formattedAddress ?? item.area;

  return (
    <Link href={detailsHref} style={{ color: "inherit", display: "block", textDecoration: "none" }}>
      <article
        style={{
          backgroundColor: "#fff",
          border: "1px solid var(--cs-border-soft)",
          borderRadius: 18,
          boxShadow: "var(--cs-shadow-xs)",
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
          padding: "0.875rem 0.95rem",
        }}
      >
        <div style={{ alignItems: "center", display: "flex", justifyContent: "space-between", gap: "0.75rem" }}>
          <div style={{ alignItems: "center", color: "var(--cs-text)", display: "flex", gap: 7, minWidth: 0 }}>
            {compactDate ? <CalendarDays size={14} color="var(--cs-text-muted)" /> : <Clock size={14} color="var(--cs-text-muted)" />}
            <span style={{ fontSize: 14, fontVariantNumeric: "tabular-nums", fontWeight: 800 }}>
              {compactDate ? `${formatTripDate(item.bookingDate)} · ${formatTime12h(item.startTime)}` : formatTime12h(item.startTime)}
            </span>
          </div>
          <div style={{ alignItems: "center", display: "flex", gap: 6, flexShrink: 0 }}>
            <DriverTripStatusBadge status={item.dispatchStatus} />
            <ChevronRight size={16} color="var(--cs-text-muted)" />
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <div style={{ color: "var(--cs-text)", fontSize: 15, fontWeight: 800, lineHeight: 1.2 }}>
            {item.customerName}
          </div>
          {address ? (
            <div style={{ alignItems: "flex-start", color: "var(--cs-text-muted)", display: "flex", gap: 5, fontSize: 12.5 }}>
              <MapPin size={13} style={{ flexShrink: 0, marginTop: 1 }} />
              <span style={{ lineHeight: 1.4 }}>{address}</span>
            </div>
          ) : null}
        </div>

        <div
          style={{
            alignItems: "center",
            borderTop: "1px solid var(--cs-border-soft)",
            display: "flex",
            gap: "0.75rem",
            justifyContent: "space-between",
            paddingTop: "0.65rem",
          }}
        >
          <span style={{ alignItems: "center", color: "var(--cs-text-secondary)", display: "flex", gap: 5, fontSize: 12.5, fontWeight: 700, minWidth: 0 }}>
            <Sparkles size={13} color="var(--cs-staff-accent)" />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.serviceName}</span>
          </span>
          {item.etaMinutes !== null ? (
            <span style={{ alignItems: "center", color: "var(--cs-text-muted)", display: "flex", flexShrink: 0, gap: 4, fontSize: 11.5, fontWeight: 700 }}>
              <Navigation size={12} />
              {item.etaMinutes} min
            </span>
          ) : null}
        </div>
      </article>
    </Link>
  );
}
