import { Clock, AlertTriangle, User, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DispatchStatsCards } from "./dispatch-stats-cards";
import type { DispatchAlert } from "./types";

const SEVERITY_CONFIG = {
  danger:  { bg: "#FEF2F2", iconBg: "#FEE2E2", iconColor: "#B91C1C", dot: "#EF4444" },
  warning: { bg: "#FFFBEB", iconBg: "#FEF3C7", iconColor: "#B45309", dot: "#F59E0B" },
  info:    { bg: "#EFF6FF", iconBg: "#DBEAFE", iconColor: "#1D4ED8", dot: "#3B82F6" },
};

function AlertIcon({ severity }: { severity: DispatchAlert["severity"] }) {
  const { iconBg, iconColor } = SEVERITY_CONFIG[severity];
  return (
    <div
      style={{
        width:          36,
        height:         36,
        borderRadius:   "50%",
        background:     iconBg,
        color:          iconColor,
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        flexShrink:     0,
      }}
    >
      <AlertTriangle size={16} />
    </div>
  );
}

interface AlertRowProps {
  alert: DispatchAlert;
  onViewDispatch: (number: string) => void;
}

function AlertRow({ alert, onViewDispatch }: AlertRowProps) {
  const { bg } = SEVERITY_CONFIG[alert.severity];
  return (
    <div
      style={{
        display:      "flex",
        alignItems:   "center",
        gap:          "0.875rem",
        padding:      "0.75rem 1rem",
        background:   bg,
        border:       "1px solid var(--cs-border-soft)",
        borderRadius: "var(--cs-r-md)",
      }}
    >
      <AlertIcon severity={alert.severity} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--cs-text)", marginBottom: 2 }}>
          {alert.title}
        </div>
        <div style={{ fontSize: 12.5, color: "var(--cs-text-muted)" }}>
          {alert.description}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexShrink: 0 }}>
        <span style={{ fontSize: 11.5, color: "var(--cs-text-subtle)", whiteSpace: "nowrap" }}>
          {alert.timeAgo}
        </span>
        <Button
          size="sm"
          variant="outline"
          style={{ fontSize: 12, padding: "4px 10px", height: "auto", whiteSpace: "nowrap" }}
          onClick={() => onViewDispatch(alert.dispatchNumber)}
        >
          View Dispatch
        </Button>
      </div>
    </div>
  );
}

interface DispatchDelaysAlertsTabProps {
  alerts: DispatchAlert[];
  onSelectDispatch: (id: string) => void;
}

export function DispatchDelaysAlertsTab({ alerts, onSelectDispatch }: DispatchDelaysAlertsTabProps) {
  const delayedCount  = alerts.filter((a) => a.id.startsWith("delayed-")).length;
  const noDriverCount = alerts.filter((a) => a.id.startsWith("no-driver-")).length;
  const locationCount = alerts.filter((a) => a.id.startsWith("location-")).length;

  const alertStats = [
    { label: "Delayed Trips",         value: delayedCount,  icon: <Clock size={14} />,         accentColor: "#B91C1C" },
    { label: "Traffic Alerts",        value: 0,             icon: <AlertTriangle size={14} />,   accentColor: "#D97706" },
    { label: "No Driver Assigned",    value: noDriverCount, icon: <User size={14} />,            accentColor: "#D97706" },
    { label: "Location Issues",       value: locationCount, icon: <UserX size={14} />,           accentColor: "#B45309" },
  ];

  return (
    <div>
      <DispatchStatsCards stats={alertStats} />

      {alerts.length === 0 ? (
        <div style={{ padding: "3rem 1rem", textAlign: "center", color: "var(--cs-text-subtle)", fontSize: 13 }}>
          No dispatch alerts at the moment.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {alerts.map((alert) => (
            <AlertRow
              key={alert.id}
              alert={alert}
              onViewDispatch={() => onSelectDispatch(alert.bookingId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
