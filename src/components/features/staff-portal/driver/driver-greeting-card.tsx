import { Car, CheckCircle2, Activity, Minus } from "lucide-react";
import { getStaffDisplayName } from "@/lib/staff/display-name";
import type { StaffPortalStaff } from "@/components/features/staff-portal/types";
import type { RealDispatchItem } from "@/lib/queries/dispatch-queries";

type DriverStatus = "on_route" | "arrived" | "in_progress" | "on_duty" | "off_duty";

function getDriverStatus(items: RealDispatchItem[]): DriverStatus {
  if (items.some((i) => i.dispatchStatus === "in_route")) return "on_route";
  if (items.some((i) => i.dispatchStatus === "arrived_at_customer")) return "arrived";
  if (items.some((i) => i.dispatchStatus === "service_started")) return "in_progress";
  if (items.some((i) => !["completed", "cancelled"].includes(i.dispatchStatus))) return "on_duty";
  return "off_duty";
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

type StatusCfg = { label: string; bg: string; color: string; border: string; Icon: React.ElementType };

const STATUS_CFG: Record<DriverStatus, StatusCfg> = {
  on_route: { label: "On Route", bg: "rgba(34,197,94,0.1)", color: "#15803D", border: "rgba(34,197,94,0.2)", Icon: Car },
  arrived: { label: "Arrived", bg: "rgba(59,130,246,0.1)", color: "#2563EB", border: "rgba(59,130,246,0.2)", Icon: CheckCircle2 },
  in_progress: { label: "In Progress", bg: "rgba(139,92,246,0.1)", color: "#7C3AED", border: "rgba(139,92,246,0.2)", Icon: Activity },
  on_duty: { label: "On Duty", bg: "var(--cs-success-bg)", color: "var(--cs-success)", border: "rgba(90,138,106,0.2)", Icon: Activity },
  off_duty: { label: "Off Duty", bg: "var(--cs-surface-warm)", color: "var(--cs-text-muted)", border: "var(--cs-border-soft)", Icon: Minus },
};

export function DriverGreetingCard({ staff, items }: { staff: StaffPortalStaff; items: RealDispatchItem[] }) {
  const displayName = getStaffDisplayName(staff);
  const firstName = displayName.split(" ")[0] ?? displayName;
  const todayLabel = new Date().toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric" });
  const status = getDriverStatus(items);
  const { label, bg, color, border, Icon } = STATUS_CFG[status];

  return (
    <div style={{ backgroundColor: "#fff", borderRadius: 16, border: "1px solid var(--cs-border-soft)", padding: "1rem 1.125rem", boxShadow: "var(--cs-shadow-xs)" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.5rem" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 21, fontWeight: 700, color: "var(--cs-text)", lineHeight: 1.2 }}>
            Good {getGreeting()}, {firstName} 👋
          </h1>
          <p style={{ margin: "0.25rem 0 0", fontSize: 13, color: "var(--cs-text-secondary)", lineHeight: 1.4 }}>
            {todayLabel}
          </p>
        </div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 4, backgroundColor: bg, color, borderRadius: 100, padding: "0.3rem 0.625rem", fontSize: 11, fontWeight: 700, flexShrink: 0, border: `1px solid ${border}` }}>
          <Icon size={11} />
          {label}
        </div>
      </div>
    </div>
  );
}
