import Link from "next/link";
import { ClipboardList, Map, Navigation } from "lucide-react";
import type { DriverRouteStopViewModel } from "./driver-route-view-model";

type DriverRouteActionButtonsProps = {
  stop: DriverRouteStopViewModel;
};

export function DriverRouteActionButtons({ stop }: DriverRouteActionButtonsProps) {
  return (
    <div className="space-y-3">
      {stop.navigationUrl ? (
        <a
          href={stop.navigationUrl}
          target="_blank"
          rel="noreferrer"
          className="flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl bg-emerald-900 px-4 text-sm font-black text-white shadow-xl shadow-emerald-950/20 active:scale-[0.99]"
        >
          <Navigation className="h-5 w-5 fill-white" />
          Start Navigation
        </a>
      ) : (
        <div className="flex min-h-14 w-full items-center justify-center rounded-2xl border border-stone-200 bg-stone-50 px-4 text-sm font-black text-stone-500">
          Navigation pending location
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Link
          href={stop.detailsHref}
          className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-stone-200 bg-white px-3 text-sm font-black text-stone-900 shadow-sm active:scale-[0.98]"
        >
          <ClipboardList className="h-4 w-4 text-emerald-800" />
          Details
        </Link>
        {stop.mapSearchUrl ? (
          <a
            href={stop.mapSearchUrl}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-stone-200 bg-white px-3 text-sm font-black text-stone-900 shadow-sm active:scale-[0.98]"
          >
            <Map className="h-4 w-4 text-emerald-800" />
            Open in Maps
          </a>
        ) : (
          <div className="flex min-h-12 items-center justify-center rounded-2xl border border-stone-200 bg-stone-50 px-3 text-sm font-black text-stone-500">
            Map pending
          </div>
        )}
      </div>
    </div>
  );
}
