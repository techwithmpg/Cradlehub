import Link from "next/link";
import { ChevronRight, MapPin, Navigation, Route } from "lucide-react";
import {
  StaffCard,
  StaffEmptyState,
  StaffScreen,
  StaffScreenHeader,
  StaffStatusChip,
} from "@/components/features/staff-pwa/native-foundation";
import { StaffSnapshotRecorder } from "@/components/features/staff-pwa/safe-memory";
import { buildDriverRoutePageViewModel } from "@/components/features/staff-portal/driver/map/driver-route-view-model";
import { DriverStartTravelButton } from "@/components/features/staff-portal/driver/map/driver-start-travel-button";
import type { RealDispatchItem } from "@/lib/queries/dispatch-queries";

export function DriverNativeMap({
  items,
  businessDate,
}: {
  items: RealDispatchItem[];
  businessDate: string;
}) {
  const route = buildDriverRoutePageViewModel([...items], {
    detailsBasePath: "/staff/driver/trips",
    today: new Date(`${businessDate}T12:00:00Z`),
  });
  const next = route.nextStop;

  return (
    <StaffScreen>
      <StaffSnapshotRecorder
        snapshot={{
          screen: "driverMap",
          label: "Driver map",
          counts: [
            { label: "Stops", value: route.totalStops },
            { label: "Completed", value: route.completedStops },
            { label: "Active", value: route.activeStops },
          ],
        }}
      />
      <StaffScreenHeader
        title="Map"
        subtitle={`${route.dateLabel} · ${route.totalStops} assigned stops`}
      />
      {next ? (
        <>
          <StaffCard className="overflow-hidden">
            <div className="relative flex min-h-[220px] flex-col justify-end bg-[#e9efe8] p-5">
              <div className="absolute left-5 top-5 grid size-12 place-items-center rounded-2xl bg-white text-[#163a2b] shadow-sm">
                <MapPin size={23} aria-hidden="true" />
              </div>
              <div className="relative rounded-2xl bg-white/90 p-4">
                <p className="text-sm font-semibold text-[#163a2b]">Directions open in Maps</p>
                <p className="mt-1 text-xs leading-5 text-[#65746b]">
                  Route geometry is unavailable here. Use the recorded destination to open external
                  navigation.
                </p>
              </div>
            </div>
            <div className="p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#76501a]">
                  Next stop
                </p>
                <StaffStatusChip tone="gold">
                  {next.routeState.replaceAll("_", " ")}
                </StaffStatusChip>
              </div>
              <h2 className="mt-2 text-lg font-semibold text-[#163a2b]">{next.customerName}</h2>
              <p className="mt-1 text-sm text-[#65746b]">{next.serviceName}</p>
              <p className="mt-3 flex items-start gap-2 text-sm text-[#526358]">
                <MapPin size={16} className="mt-0.5 shrink-0" aria-hidden="true" /> {next.address}
              </p>
              {next.etaMinutes !== null ? (
                <p className="mt-2 text-xs text-[#65746b]">{next.etaLabel}</p>
              ) : null}
              <div className="mt-4 grid gap-2">
                {next.bookingProgressStatus === "not_started" ? (
                  <DriverStartTravelButton bookingId={next.id} navigationUrl={next.navigationUrl} />
                ) : next.navigationUrl ? (
                  <a
                    href={next.navigationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#163a2b] px-4 text-sm font-semibold text-white"
                  >
                    <Navigation size={17} aria-hidden="true" /> Open in Maps
                  </a>
                ) : null}
                <Link
                  href={next.detailsHref}
                  className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#c8a96b] px-4 text-sm font-semibold text-[#163a2b]"
                >
                  Trip details <ChevronRight size={16} aria-hidden="true" />
                </Link>
              </div>
            </div>
          </StaffCard>
          <h2 className="mt-6 text-base font-semibold text-[#163a2b]">Today&apos;s stops</h2>
          <StaffCard className="mt-3 overflow-hidden">
            {route.stops.map((stop) => (
              <Link
                key={stop.id}
                href={stop.detailsHref}
                className="flex min-h-16 items-center gap-3 border-b border-[#eee8dc] px-4 py-3 last:border-0"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#f3e9d6] text-xs font-semibold text-[#76501a]">
                  {stop.stopNumber}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{stop.customerName}</span>
                  <span className="block truncate text-xs text-[#65746b]">
                    {stop.startTimeLabel} · {stop.address}
                  </span>
                </span>
                <ChevronRight size={16} className="shrink-0 text-[#65746b]" aria-hidden="true" />
              </Link>
            ))}
          </StaffCard>
        </>
      ) : (
        <StaffEmptyState
          icon={<Route size={20} />}
          title="No active route"
          description="Assigned stops appear here when available."
        />
      )}
    </StaffScreen>
  );
}
