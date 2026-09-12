import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { DriverRouteStatusBadge } from "./driver-route-status-badge";
import type { DriverRoutePageViewModel } from "./driver-route-view-model";

type DriverRouteMapHeaderProps = {
  viewModel: DriverRoutePageViewModel;
  homeHref: string;
  tripsHref: string;
  profileHref: string;
};

export function DriverRouteMapHeader({
  viewModel,
  homeHref,
}: DriverRouteMapHeaderProps) {
  return (
    <header className="z-40 shrink-0 border-b border-[#E9E4DC] bg-[#FBFAF6]/96 backdrop-blur-xl">
      <div className="mx-auto flex h-[58px] max-w-[480px] items-center gap-3 px-3.5">
        <Link
          href={homeHref}
          aria-label="Back to driver home"
          className="grid size-9 shrink-0 place-items-center rounded-full border border-[#E4DED5] bg-white text-[#273D4E] shadow-sm active:scale-95"
        >
          <ChevronLeft size={17} />
        </Link>

        <div className="min-w-0 flex-1">
          <h1 className="text-[19px] font-bold tracking-[-0.025em] text-[#173146]">
            Map
          </h1>

          <p className="text-[9.5px] font-medium text-[#7B8795]">
            {viewModel.totalStops}{" "}
            {viewModel.totalStops === 1 ? "stop" : "stops"} today
          </p>
        </div>

        <DriverRouteStatusBadge
          state={viewModel.routeState}
          compact
        />
      </div>
    </header>
  );
}