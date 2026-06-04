import Link from "next/link";
import { ChevronRight, MapPin, Route } from "lucide-react";
import { DriverRouteBottomSheet } from "./driver-route-bottom-sheet";
import { DriverRouteEmptyState } from "./driver-route-empty-state";
import { DriverRouteMapHeader } from "./driver-route-map-header";
import { DriverRouteMapPanel } from "./driver-route-map-panel";
import { DriverRouteStatusBadge } from "./driver-route-status-badge";
import { DriverRouteSummaryBar } from "./driver-route-summary-bar";
import {
  buildDriverRoutePageViewModel,
  type DriverRouteStopViewModel,
} from "./driver-route-view-model";
import type { RealDispatchItem } from "@/lib/queries/dispatch-queries";

type DriverRouteMapPageProps = {
  items: RealDispatchItem[];
  homeHref?: string;
  tripsHref?: string;
  profileHref?: string;
  detailsBasePath?: string;
};

function DesktopStopRow({ stop }: { stop: DriverRouteStopViewModel }) {
  return (
    <Link
      href={stop.detailsHref}
      className="flex items-start gap-4 border-b border-stone-100 py-4 text-inherit last:border-b-0"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-800 text-sm font-black text-white">
        {stop.stopNumber}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-black text-stone-950">{stop.customerName}</span>
        <span className="mt-1 flex items-start gap-1.5 text-sm font-medium text-stone-500">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
          {stop.address}
        </span>
        <span className="mt-1 block text-xs font-bold text-stone-500">{stop.serviceName}</span>
      </span>
      <span className="shrink-0 text-right">
        <span className="block text-sm font-black text-stone-950">{stop.startTimeLabel}</span>
        <ChevronRight className="ml-auto mt-2 h-4 w-4 text-stone-400" />
      </span>
    </Link>
  );
}

function DriverRouteDesktopFallback({
  viewModel,
  tripsHref,
}: {
  viewModel: ReturnType<typeof buildDriverRoutePageViewModel>;
  tripsHref: string;
}) {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
      <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-stone-950">Route Map</h1>
            <p className="mt-1 text-sm font-semibold text-stone-500">
              {viewModel.dateLabel} · {viewModel.totalStops} stops
            </p>
          </div>
          <DriverRouteStatusBadge state={viewModel.routeState} />
        </div>
      </div>

      <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
        {viewModel.stops.length > 0 ? (
          viewModel.stops.map((stop) => <DesktopStopRow key={stop.id} stop={stop} />)
        ) : (
          <div className="py-10 text-center">
            <Route className="mx-auto h-10 w-10 text-emerald-800" />
            <h2 className="mt-3 text-lg font-black text-stone-950">No route assigned</h2>
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
  homeHref = "/staff-portal",
  tripsHref = "/staff-portal/dispatch",
  profileHref = "/staff-portal/profile",
  detailsBasePath = "/staff-portal/jobs",
}: DriverRouteMapPageProps) {
  const viewModel = buildDriverRoutePageViewModel(items, {
    detailsBasePath,
  });

  return (
    <div className="min-h-dvh bg-[#fbf8f2] text-stone-950 md:bg-transparent">
      <div className="block md:hidden">
        <DriverRouteMapHeader
          viewModel={viewModel}
          homeHref={homeHref}
          tripsHref={tripsHref}
          profileHref={profileHref}
        />
        <DriverRouteSummaryBar viewModel={viewModel} />
        <main>
          <DriverRouteMapPanel viewModel={viewModel} />
          {viewModel.nextStop ? (
            <DriverRouteBottomSheet viewModel={viewModel} tripsHref={tripsHref} />
          ) : (
            <DriverRouteEmptyState tripsHref={tripsHref} />
          )}
        </main>
      </div>

      <div className="hidden md:block">
        <DriverRouteDesktopFallback viewModel={viewModel} tripsHref={tripsHref} />
      </div>
    </div>
  );
}
