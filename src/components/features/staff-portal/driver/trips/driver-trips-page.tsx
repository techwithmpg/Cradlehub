"use client";

import { useMemo, useState } from "react";
import { CalendarX2, CheckCircle2, Clock3, Route } from "lucide-react";
import { DriverActiveTripCard } from "./driver-active-trip-card";
import { DriverTripCard } from "./driver-trip-card";
import { DriverTripEmptyState } from "./driver-trip-empty-state";
import { DriverTripsHeader } from "./driver-trips-header";
import { DriverTripsTabs, type DriverTripsTab } from "./driver-trips-tabs";
import type { RealDispatchItem } from "@/lib/queries/dispatch-queries";

type DriverTripsPageProps = {
  todayItems: RealDispatchItem[];
  businessDate?: string;
  historyItems: RealDispatchItem[];
  detailsBasePath?: string;
};

const ACTIVE_TRIP_STATUSES = ["in_route", "arrived_at_customer", "service_started"] as const;
const TERMINAL_TRIP_STATUSES = ["completed", "cancelled"] as const;

function isActiveTrip(item: RealDispatchItem): boolean {
  return ACTIVE_TRIP_STATUSES.includes(item.dispatchStatus as (typeof ACTIVE_TRIP_STATUSES)[number]);
}

function isTerminalTrip(item: RealDispatchItem): boolean {
  return TERMINAL_TRIP_STATUSES.includes(item.dispatchStatus as (typeof TERMINAL_TRIP_STATUSES)[number]);
}

function formatTodayLabel(): string {
  return new Date().toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    weekday: "short",
  });
}

function sortTripAscending(a: RealDispatchItem, b: RealDispatchItem): number {
  return `${a.bookingDate}T${a.startTime}`.localeCompare(`${b.bookingDate}T${b.startTime}`);
}

function sortTripDescending(a: RealDispatchItem, b: RealDispatchItem): number {
  return `${b.bookingDate}T${b.startTime}`.localeCompare(`${a.bookingDate}T${a.startTime}`);
}

function uniqueTrips(items: RealDispatchItem[]): RealDispatchItem[] {
  const seen = new Set<string>();
  const unique: RealDispatchItem[] = [];

  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    unique.push(item);
  }

  return unique;
}

function SectionTitle({ title, count }: { title: string; count: number }) {
  return (
    <div style={{ alignItems: "center", display: "flex", justifyContent: "space-between", marginTop: 2 }}>
      <h2 style={{ color: "var(--cs-text)", fontSize: 13, fontWeight: 850, margin: 0 }}>{title}</h2>
      <span style={{ color: "var(--cs-text-muted)", fontSize: 11, fontWeight: 700 }}>
        {count} {count === 1 ? "trip" : "trips"}
      </span>
    </div>
  );
}

export function DriverTripsPage({
  todayItems,
  businessDate,
  historyItems,
  detailsBasePath = "/staff-portal/jobs",
}: DriverTripsPageProps) {
  const [tab, setTab] = useState<DriverTripsTab>("today");
  const todayLabel = businessDate ?? formatTodayLabel();

  const sortedToday = useMemo(() => [...todayItems].sort(sortTripAscending), [todayItems]);
  const activeTrips = uniqueTrips([...sortedToday, ...historyItems]).filter(isActiveTrip).sort(sortTripAscending);
  const openTrips = uniqueTrips([...sortedToday, ...historyItems]).filter(item => !isTerminalTrip(item)).sort(sortTripAscending);
  const upcomingTrips = openTrips.filter((item) => !isActiveTrip(item));
  const completedToday = sortedToday.filter(isTerminalTrip);
  const historyTrips = uniqueTrips([...completedToday, ...historyItems]).filter(isTerminalTrip).sort(sortTripDescending);
  const counts: Record<DriverTripsTab, number> = {
    today: sortedToday.length,
    upcoming: upcomingTrips.length + activeTrips.length,
    history: historyTrips.length,
  };
  const activeCount = activeTrips.length;

  function detailsHref(item: RealDispatchItem): string {
    return `${detailsBasePath}/${item.id}`;
  }

  return (
    <div style={{ backgroundColor: "var(--cs-bg)", minHeight: "100dvh" }}>
      <DriverTripsHeader todayLabel={todayLabel} totalToday={sortedToday.length} activeCount={activeCount} />
      <DriverTripsTabs activeTab={tab} counts={counts} onTabChange={setTab} />

      <main
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.875rem",
          marginLeft: "auto",
          marginRight: "auto",
          maxWidth: 480,
          padding: "0.875rem 1rem 1.25rem",
        }}
      >
        {tab === "today" ? (
          <>
            {activeTrips.map(item => <DriverActiveTripCard key={item.id} item={item} detailsHref={detailsHref(item)} />)}

            {upcomingTrips.length > 0 ? (
              <section style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
                <SectionTitle title="Upcoming Trips" count={upcomingTrips.length} />
                {upcomingTrips.map((item) => (
                  <DriverTripCard key={item.id} item={item} detailsHref={detailsHref(item)} />
                ))}
              </section>
            ) : null}

            {completedToday.length > 0 ? (
              <section style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
                <SectionTitle title="Concluded Today" count={completedToday.length} />
                {completedToday.map((item) => (
                  <DriverTripCard key={item.id} item={item} detailsHref={detailsHref(item)} />
                ))}
              </section>
            ) : null}

            {sortedToday.length === 0 ? (
              <DriverTripEmptyState
                icon={CalendarX2}
                title="No trips today"
                description="Your assigned home-service jobs will appear here when the team adds them."
              />
            ) : null}
          </>
        ) : null}

        {tab === "upcoming" ? (
          upcomingTrips.length > 0 || activeTrips.length > 0 ? (
            <section style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
              {activeTrips.map(item => <DriverActiveTripCard key={item.id} item={item} detailsHref={detailsHref(item)} />)}
              {upcomingTrips.map((item) => (
                <DriverTripCard key={item.id} item={item} detailsHref={detailsHref(item)} />
              ))}
            </section>
          ) : (
            <DriverTripEmptyState
              icon={Clock3}
              title="No upcoming trips"
              description="You are clear for now. New trip assignments will show up here."
            />
          )
        ) : null}

        {tab === "history" ? (
          historyTrips.length > 0 ? (
            <section style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
              {historyTrips.map((item) => (
                <DriverTripCard key={item.id} item={item} detailsHref={detailsHref(item)} compactDate />
              ))}
            </section>
          ) : (
            <DriverTripEmptyState
              icon={CheckCircle2}
              title="No trip history yet"
              description="Completed and cancelled trips will be saved here after your jobs move forward."
            />
          )
        ) : null}

        {sortedToday.length > 0 && tab === "today" && activeTrips.length === 0 && upcomingTrips.length === 0 && completedToday.length === 0 ? (
          <DriverTripEmptyState
            icon={Route}
            title="No active trips"
            description="Today has trips, but none are waiting for driver action right now."
          />
        ) : null}
      </main>
    </div>
  );
}
