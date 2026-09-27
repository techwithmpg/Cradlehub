import { Clock3, MapPin } from "lucide-react";
import { DriverRouteActionButtons } from "./driver-route-action-buttons";
import { DriverRouteStatusBadge } from "./driver-route-status-badge";
import type { DriverRoutePageViewModel } from "./driver-route-view-model";

type DriverRouteBottomSheetProps = {
  viewModel: DriverRoutePageViewModel;
  tripsHref: string;
};

export function DriverRouteBottomSheet({
  viewModel,
}: DriverRouteBottomSheetProps) {
  const nextStop = viewModel.nextStop;

  if (!nextStop) return null;

  return (
    <section className="absolute inset-x-3 bottom-3 z-30 rounded-[20px] border border-[#E5E1DA] bg-white/97 p-3.5 shadow-[0_12px_34px_rgba(30,41,59,0.16)] backdrop-blur-xl">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="truncate text-[15px] font-bold text-[#203548]">
              {nextStop.customerName}
            </h2>

            <DriverRouteStatusBadge
              state={nextStop.routeState}
              compact
            />
          </div>

          <div className="mt-1 truncate text-[10.5px] text-[#69798B]">
            {nextStop.serviceName}
          </div>
        </div>

        <div className="shrink-0 text-right">
          <div className="flex items-center justify-end gap-1 text-[8.5px] font-bold uppercase tracking-[0.04em] text-[#84908E]">
            <Clock3 size={10} />
            ETA
          </div>

          <div className="mt-0.5 text-[16px] font-bold text-[#173B2E]">
            {nextStop.etaLabel}
          </div>
        </div>
      </div>

      <div className="mt-2.5 flex items-start gap-2 rounded-[11px] bg-[#F6F7F4] px-2.5 py-2">
        <MapPin
          size={13}
          className="mt-0.5 shrink-0 text-[#557063]"
        />

        <div className="line-clamp-2 text-[10.5px] leading-4 text-[#506274]">
          {nextStop.address}
        </div>
      </div>

      <div className="mt-2.5">
        <DriverRouteActionButtons stop={nextStop} />
      </div>
    </section>
  );
}