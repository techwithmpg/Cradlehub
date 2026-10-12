"use client";

import { CalendarDays, Route } from "lucide-react";
import {
  StaffCard,
  StaffEmptyState,
  StaffScreen,
  StaffScreenHeader,
  StaffSegmentedControl,
} from "@/components/features/staff-pwa/native-foundation";
import {
  StaffSnapshotRecorder,
  useStaffSafeMemory,
} from "@/components/features/staff-pwa/safe-memory";
import { DriverTripRow } from "./driver-trip-row";
import type { RealDispatchItem } from "@/lib/queries/dispatch-queries";

type Filter = "today" | "upcoming" | "completed";
const filters: readonly { value: Filter; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "upcoming", label: "Upcoming" },
  { value: "completed", label: "Completed" },
];

function isFilter(value: string | null): value is Filter {
  return filters.some((item) => item.value === value);
}

export function DriverNativeTrips({
  businessDate,
  todayItems,
  historyItems,
}: {
  businessDate: string;
  todayItems: RealDispatchItem[];
  historyItems: RealDispatchItem[];
}) {
  const memory = useStaffSafeMemory();
  const saved = memory?.readPreference("driverTripsFilter") ?? null;
  const filter: Filter = isFilter(saved) ? saved : "today";
  const unique = new Map([...todayItems, ...historyItems].map((item) => [item.id, item]));
  const all = [...unique.values()];
  const upcoming = all.filter(
    (item) =>
      item.bookingDate > businessDate &&
      item.dispatchStatus !== "completed" &&
      item.dispatchStatus !== "cancelled"
  );
  const completed = all.filter((item) => item.dispatchStatus === "completed");
  const visible = filter === "today" ? todayItems : filter === "upcoming" ? upcoming : completed;
  const ordered = [...visible].sort((a, b) =>
    filter === "completed"
      ? `${b.bookingDate}T${b.startTime}`.localeCompare(`${a.bookingDate}T${a.startTime}`)
      : `${a.bookingDate}T${a.startTime}`.localeCompare(`${b.bookingDate}T${b.startTime}`)
  );

  return (
    <StaffScreen>
      <StaffSnapshotRecorder
        snapshot={{
          screen: "driverTrips",
          label: "Driver trips",
          counts: [
            { label: "Today", value: todayItems.length },
            { label: "Upcoming", value: upcoming.length },
            { label: "Recent completed", value: completed.length },
          ],
        }}
      />
      <StaffScreenHeader title="Trips" subtitle="Your assigned home-service work" />
      <StaffSegmentedControl
        label="Trip filters"
        options={filters}
        value={filter}
        onChange={(next) => memory?.writePreference("driverTripsFilter", next)}
      />
      <p className="mt-4 text-xs text-[#65746b]">
        {filter === "today"
          ? `Business date ${businessDate}`
          : filter === "upcoming"
            ? "Upcoming assigned trips"
            : "Completed trips in the recent work window"}
      </p>
      {ordered.length ? (
        <StaffCard className="mt-3 overflow-hidden">
          {ordered.map((item) => (
            <DriverTripRow key={item.id} item={item} showDate={filter !== "today"} />
          ))}
        </StaffCard>
      ) : (
        <div className="mt-3">
          <StaffEmptyState
            icon={filter === "today" ? <CalendarDays size={20} /> : <Route size={20} />}
            title={`No ${filter} trips`}
            description="Assigned home-service trips appear here when available."
          />
        </div>
      )}
    </StaffScreen>
  );
}
