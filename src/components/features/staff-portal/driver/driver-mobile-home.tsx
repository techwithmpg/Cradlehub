import { DriverMobileBottomNav } from "./driver-mobile-bottom-nav";
import { DriverHeader } from "./driver-header";
import { DriverGreetingCard } from "./driver-greeting-card";
import { DriverTodayOverviewCard } from "./driver-today-overview-card";
import { DriverNextStopCard } from "./driver-next-stop-card";
import { DriverQuickActions } from "./driver-quick-actions";
import type { StaffPortalStaff } from "@/components/features/staff-portal/types";
import type { RealDispatchItem, DispatchStats } from "@/lib/queries/dispatch-queries";

type DriverMobileHomeProps = {
  staff: StaffPortalStaff;
  items: RealDispatchItem[];
  stats: DispatchStats;
};

export function DriverMobileHome({ staff, items, stats }: DriverMobileHomeProps) {
  return (
    <div style={{ minHeight: "100dvh", backgroundColor: "var(--cs-bg)", paddingBottom: 96 }}>
      <DriverHeader staff={staff} />

      <div
        style={{
          padding: "0.875rem 1rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
          maxWidth: 480,
          marginLeft: "auto",
          marginRight: "auto",
        }}
      >
        <DriverGreetingCard staff={staff} items={items} />
        <DriverTodayOverviewCard items={items} stats={stats} />
        <DriverNextStopCard items={items} />
        <DriverQuickActions />
      </div>

      <DriverMobileBottomNav />
    </div>
  );
}
