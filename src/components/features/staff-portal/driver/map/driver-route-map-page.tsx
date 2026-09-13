import Link from "next/link";
import { MapPin, Route } from "lucide-react";
import { DriverRouteBottomSheet } from "./driver-route-bottom-sheet";
import { DriverRouteMapHeader } from "./driver-route-map-header";
import { DriverRouteMapPanel } from "./driver-route-map-panel";
import { DriverRouteStatusBadge } from "./driver-route-status-badge";
import {
  buildDriverRoutePageViewModel,
  type DriverRouteStopViewModel,
} from "./driver-route-view-model";
import type { RealDispatchItem } from "@/lib/queries/dispatch-queries";

type DriverRouteMapPageProps = {
  items: RealDispatchItem[];
  businessDate?: string;
  homeHref?: string;
  tripsHref?: string;
  profileHref?: string;
  detailsBasePath?: string;
};

function DesktopStopRow({
  stop,
}: {
  stop: DriverRouteStopViewModel;
}) {
  return (
    <Link
      href={stop.detailsHref}
      className="flex items-start gap-4 border-b border-stone-100 py-4 text-inherit last:border-b-0"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-emerald-800 text-sm font-black text-white">
        {stop.stopNumber}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-sm font-black text-stone-950">
          {stop.customerName}
        </span>

        <span className="mt-1 flex items-start gap-1.5 text-sm font-medium text-stone-500">
          <MapPin className="mt-0.5 size-4 shrink-0" />
          {stop.address}
        </span>
      </span>
    </Link>
  );
}

function DesktopFallback({
  viewModel,
  tripsHref,
}: {
  viewModel: ReturnType<typeof buildDriverRoutePageViewModel>;
  tripsHref: string;
}) {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
      <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-black text-stone-950">
              Route Map
            </h1>

            <p className="mt-1 text-sm font-semibold text-stone-500">
              {viewModel.dateLabel} · {viewModel.totalStops} stops
            </p>
          </div>

          <DriverRouteStatusBadge
            state={viewModel.routeState}
          />
        </div>
      </div>

      <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
        {viewModel.stops.length > 0 ? (
          viewModel.stops.map((stop) => (
            <DesktopStopRow
              key={stop.id}
              stop={stop}
            />
          ))
        ) : (
          <div className="py-10 text-center">
            <Route className="mx-auto size-10 text-emerald-800" />

            <h2 className="mt-3 text-lg font-black">
              No route assigned
            </h2>

            <Link
              href={tripsHref}
              className="mt-4 inline-flex min-h-11 items-center rounded-2xl bg-emerald-900 px-5 text-sm font-black text-white"
            >
              View Trips
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}

export function DriverRouteMapPage({
  items,
  businessDate,
  homeHref = "/staff-portal",
  tripsHref = "/staff-portal/dispatch",
  profileHref = "/staff-portal/profile",
  detailsBasePath = "/staff-portal/jobs",
}: DriverRouteMapPageProps) {
  const viewModel = buildDriverRoutePageViewModel(
    items,
    {
      detailsBasePath,
      today: businessDate ? new Date(businessDate + "T12:00:00Z") : undefined,
    }
  );

  return (
    <>
      <div
        className="block overflow-hidden bg-[#F7F3EB] md:hidden"
        style={{
          height:
            "calc(100dvh - 84px - env(safe-area-inset-bottom))",
        }}
      >
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
          <DriverRouteMapHeader
            viewModel={viewModel}
            homeHref={homeHref}
            tripsHref={tripsHref}
            profileHref={profileHref}
          />

          <main className="relative min-h-0 flex-1 overflow-hidden">
            <DriverRouteMapPanel
              viewModel={viewModel}
            />

            {viewModel.nextStop ? (
              <DriverRouteBottomSheet
                viewModel={viewModel}
                tripsHref={tripsHref}
              />
            ) : (
              <div className="absolute inset-x-3 bottom-3 z-30 rounded-[18px] border border-[#E5E1DA] bg-white/95 p-4 text-center shadow-lg">
                <div className="text-[13px] font-bold text-[#26394B]">
                  No active route
                </div>

                <div className="mt-1 text-[10.5px] text-[#7B8795]">
                  Assigned trips will appear here.
                </div>

                <Link
                  href={tripsHref}
                  className="mt-3 inline-flex min-h-10 items-center rounded-[12px] bg-[#0D6548] px-4 text-[11.5px] font-bold text-white"
                >
                  View Trips
                </Link>
              </div>
            )}
          </main>
        </div>
      </div>

      <div className="hidden md:block">
        <DesktopFallback
          viewModel={viewModel}
          tripsHref={tripsHref}
        />
      </div>
    </>
  );
}
