import { BriefcaseBusiness, Clock3, MapPin } from "lucide-react";
import { DriverRouteActionButtons } from "./driver-route-action-buttons";
import { DriverRouteStatusBadge } from "./driver-route-status-badge";
import { DriverTodayStopsStrip } from "./driver-today-stops-strip";
import type { DriverRoutePageViewModel } from "./driver-route-view-model";

type DriverRouteBottomSheetProps = {
  viewModel: DriverRoutePageViewModel;
  tripsHref: string;
};

export function DriverRouteBottomSheet({
  viewModel,
  tripsHref,
}: DriverRouteBottomSheetProps) {
  const nextStop = viewModel.nextStop;
  if (!nextStop) return null;

  return (
    <section className="relative z-30 mx-4 -mt-20 rounded-[2rem] border border-stone-200 bg-white p-4 shadow-2xl shadow-stone-900/12">
      <div className="mx-auto mb-4 h-1.5 w-16 rounded-full bg-stone-300" />

      <div className="grid grid-cols-[1fr_auto] gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-stone-100 text-base font-black text-stone-800 ring-4 ring-white">
              {nextStop.customerInitials}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-[22px] font-black leading-tight text-stone-950">
                  {nextStop.customerName}
                </h2>
                <DriverRouteStatusBadge state={nextStop.routeState} compact />
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <div className="flex items-start gap-3 text-sm font-semibold leading-6 text-stone-700">
              <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-emerald-800" />
              <span>{nextStop.address}</span>
            </div>
            <div className="flex items-start gap-3 text-sm font-semibold leading-6 text-stone-700">
              <BriefcaseBusiness className="mt-0.5 h-5 w-5 shrink-0 text-stone-700" />
              <span>
                <span className="block font-black text-stone-950">{nextStop.serviceName}</span>
                <span className="text-stone-500">Home-service job</span>
              </span>
            </div>
          </div>
        </div>

        <div className="grid h-[126px] w-[104px] place-items-center rounded-3xl border border-emerald-100 bg-emerald-50/80 text-center">
          <div>
            <div className="text-xs font-black uppercase text-stone-500">ETA</div>
            <div className="mt-1 text-2xl font-black text-stone-950">{viewModel.etaLabel}</div>
            <div className="mt-2 flex items-center justify-center gap-1 text-xs font-bold text-stone-600">
              <Clock3 className="h-3.5 w-3.5" />
              {viewModel.distanceLabel}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5">
        <DriverRouteActionButtons stop={nextStop} />
      </div>

      <div className="mt-6">
        <DriverTodayStopsStrip stops={viewModel.stops} tripsHref={tripsHref} />
      </div>
    </section>
  );
}
