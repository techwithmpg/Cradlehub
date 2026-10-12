"use client";

import { usePathname } from "next/navigation";
import { useNetworkStatus } from "@/hooks/use-network-status";
import {
  StaffCard,
  StaffScreen,
  StaffScreenHeader,
  StaffStatTile,
} from "@/components/features/staff-pwa/native-foundation";
import { useStaffSafeMemory, type SafeSnapshot } from "@/components/features/staff-pwa/safe-memory";

export default function StaffLoading() {
  const pathname = usePathname();
  const { isOffline } = useNetworkStatus();
  const cache = useStaffSafeMemory();
  const screen: SafeSnapshot["screen"] | null = pathname?.startsWith("/staff/schedule")
    ? "schedule"
    : pathname?.startsWith("/staff/progress")
      ? "progress"
      : pathname === "/staff" || pathname === "/staff/"
        ? "today"
        : null;
  const snapshot = screen ? cache?.read(screen) : null;
  const freshness = snapshot
    ? `${isOffline ? "Offline" : "Updating"} · Last updated ${new Date(snapshot.updatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
    : "Loading workspace…";

  return (
    <StaffScreen>
      <StaffScreenHeader title={snapshot?.label ?? "Opening workspace"} subtitle={freshness} />
      {snapshot ? (
        <StaffCard className="p-4">
          <div
            className={`grid gap-2 ${snapshot.counts.length === 4 ? "grid-cols-4" : "grid-cols-3"}`}
          >
            {snapshot.counts.map(({ label, value }) => (
              <StaffStatTile key={label} label={label} value={value} />
            ))}
          </div>
        </StaffCard>
      ) : (
        <StaffCard className="p-5">
          <div className="h-4 w-2/3 animate-pulse rounded-full bg-[#e5dece] motion-reduce:animate-none" />
          <div className="mt-4 h-12 animate-pulse rounded-xl bg-[#eee8dc] motion-reduce:animate-none" />
        </StaffCard>
      )}
    </StaffScreen>
  );
}
