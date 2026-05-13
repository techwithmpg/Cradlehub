import type { DispatchStatus } from "./types";

type BadgeConfig = {
  label: string;
  bg: string;
  color: string;
};

const STATUS_MAP: Record<DispatchStatus, BadgeConfig> = {
  in_route:               { label: "In Route",             bg: "#EFF6FF", color: "#1D4ED8" },
  ready:                  { label: "Ready",                bg: "#F0FDF4", color: "#15803D" },
  en_route_to_therapist:  { label: "En Route to Therapist", bg: "#EFF6FF", color: "#2563EB" },
  awaiting_driver:        { label: "Awaiting Driver",      bg: "#FFFBEB", color: "#B45309" },
  arrived_at_customer:    { label: "Arrived at Customer",  bg: "#F0FDF4", color: "#166534" },
  service_started:        { label: "Service Started",      bg: "#EDE9FE", color: "#5B21B6" },
  delayed:                { label: "Delayed",              bg: "#FEF2F2", color: "#B91C1C" },
  completed:              { label: "Completed",            bg: "#F9FAFB", color: "#374151" },
  cancelled:              { label: "Cancelled",            bg: "#FEF2F2", color: "#991B1B" },
};

export function DispatchStatusBadge({ status }: { status: DispatchStatus }) {
  const cfg = STATUS_MAP[status];
  return (
    <span
      style={{
        display:      "inline-block",
        padding:      "2px 8px",
        borderRadius: 999,
        fontSize:     11.5,
        fontWeight:   600,
        background:   cfg.bg,
        color:        cfg.color,
        whiteSpace:   "nowrap",
      }}
    >
      {cfg.label}
    </span>
  );
}
