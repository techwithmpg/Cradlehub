import Link from "next/link";
import { MapPin, Clock, ChevronRight } from "lucide-react";
import { formatTime12h } from "@/lib/utils/time-format";
import { DriverStatusBadge } from "./driver-status-badge";
import type { RealDispatchItem } from "@/lib/queries/dispatch-queries";

export function DriverJobCard({ item }: { item: RealDispatchItem }) {
  const address = item.formattedAddress ?? item.area;

  return (
    <Link href={`/staff-portal/jobs/${item.id}`} style={{ textDecoration: "none", display: "block" }}>
      <div style={{ backgroundColor: "#fff", borderRadius: 14, border: "1px solid var(--cs-border-soft)", padding: "0.875rem 1rem", boxShadow: "var(--cs-shadow-xs)", display: "flex", gap: "0.875rem", alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 12, color: "var(--cs-text-muted)", fontVariantNumeric: "tabular-nums" }}>
              <Clock size={11} />
              {formatTime12h(item.startTime)}
            </span>
            <DriverStatusBadge status={item.dispatchStatus} />
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--cs-text)", lineHeight: 1.25 }}>{item.customerName}</div>
          {address && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 4, fontSize: 12, color: "var(--cs-text-muted)", marginTop: 3 }}>
              <MapPin size={11} style={{ flexShrink: 0, marginTop: 1 }} />
              <span style={{ lineHeight: 1.4 }}>{address}</span>
            </div>
          )}
          <div style={{ fontSize: 12, color: "var(--cs-text-secondary)", marginTop: 4 }}>{item.serviceName}</div>
        </div>
        <ChevronRight size={18} color="var(--cs-text-muted)" style={{ flexShrink: 0, marginTop: 2 }} />
      </div>
    </Link>
  );
}
