import Link from "next/link";
import { ClipboardList, Navigation } from "lucide-react";
import { DriverStartTravelButton } from "./driver-start-travel-button";
import type { DriverRouteStopViewModel } from "./driver-route-view-model";

type DriverRouteActionButtonsProps = {
  stop: DriverRouteStopViewModel;
};

export function DriverRouteActionButtons({
  stop,
}: DriverRouteActionButtonsProps) {
  const canStartTravel =
    stop.bookingProgressStatus === "not_started";

  return (
    <div className="grid gap-2">
      {canStartTravel ? (
        <DriverStartTravelButton
          bookingId={stop.id}
          navigationUrl={stop.navigationUrl}
        />
      ) : stop.navigationUrl ? (
        <a
          href={stop.navigationUrl}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-[14px] bg-[#0D6548] px-4 text-[13px] font-bold text-white shadow-[0_6px_18px_rgba(13,101,72,0.20)] active:scale-[0.99]"
        >
          <Navigation size={17} />
          Open Navigation
        </a>
      ) : (
        <div className="flex min-h-12 w-full items-center justify-center rounded-[14px] bg-[#ECEAE5] px-4 text-[11px] font-semibold text-[#7B8388]">
          Destination location pending
        </div>
      )}

      <Link
        href={stop.detailsHref}
        className="flex min-h-10 items-center justify-center gap-2 rounded-[12px] border border-[#C8DCD0] bg-white/90 px-3 text-[11.5px] font-bold text-[#285B46] active:scale-[0.99]"
      >
        <ClipboardList size={14} />
        Trip Details
      </Link>
    </div>
  );
}