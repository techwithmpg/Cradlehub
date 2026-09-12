import { ChevronRight, Navigation } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  DriverRoutePageViewModel,
  DriverRouteStopViewModel,
} from "./driver-route-view-model";

type DriverRouteMapPlaceholderProps = {
  viewModel: DriverRoutePageViewModel;
};

const STOP_POSITIONS = [
  {
    marker: "left-[35%] top-[66%]",
    label: "left-[42%] top-[58%]",
  },
  {
    marker: "left-[49%] top-[45%]",
    label: "left-[55%] top-[38%]",
  },
  {
    marker: "left-[66%] top-[24%]",
    label: "left-[34%] top-[18%]",
  },
] as const;

function StopMarker({
  stop,
  index,
}: {
  stop: DriverRouteStopViewModel;
  index: number;
}) {
  const position = STOP_POSITIONS[index];
  if (!position) return null;

  return (
    <>
      <div
        className={cn(
          "absolute z-20 grid size-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-[3px] border-white text-[11px] font-black text-white shadow-lg",
          position.marker,
          stop.isNextStop
            ? "bg-[#0D6548]"
            : stop.isCompleted
              ? "bg-[#68A78A]"
              : "bg-[#527967]"
        )}
      >
        {stop.stopNumber}
      </div>

      <div
        className={cn(
          "absolute z-20 max-w-[126px] rounded-[11px] bg-white/95 px-2.5 py-1.5 text-[#26394B] shadow-md ring-1 ring-[#DFE5DE]",
          position.label,
          stop.isNextStop &&
            "bg-[#0D6548] text-white ring-[#0D6548]"
        )}
      >
        <div className="flex items-center gap-1 truncate text-[9.5px] font-bold">
          {stop.isNextStop ? "Next" : `Stop ${stop.stopNumber}`}
          {stop.isNextStop ? <ChevronRight size={11} /> : null}
        </div>

        <div className="mt-0.5 truncate text-[8.5px] opacity-80">
          {stop.customerName}
        </div>
      </div>
    </>
  );
}

export function DriverRouteMapPlaceholder({
  viewModel,
}: DriverRouteMapPlaceholderProps) {
  const visibleStops = viewModel.stops.slice(
    0,
    STOP_POSITIONS.length
  );

  return (
    <div className="relative h-full min-h-0 overflow-hidden bg-[#E9EFE8]">
      <div className="absolute left-3 top-3 z-30 rounded-full bg-white/90 px-2.5 py-1 text-[8.5px] font-bold uppercase tracking-[0.06em] text-[#66766D] shadow-sm ring-1 ring-[#DCE4DD]">
        Route preview
      </div>

      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(15,81,56,0.07)_1px,transparent_1px),linear-gradient(0deg,rgba(15,81,56,0.07)_1px,transparent_1px)] bg-[length:42px_42px]" />

      <div className="absolute left-[-15%] top-[19%] h-3 w-[135%] rotate-[14deg] rounded-full bg-white/75" />
      <div className="absolute left-[-10%] top-[56%] h-3 w-[120%] -rotate-[18deg] rounded-full bg-white/85" />
      <div className="absolute left-[72%] top-[-10%] h-[120%] w-5 rotate-[12deg] rounded-full bg-[#CBE5F6]/55" />

      {viewModel.totalStops > 0 ? (
        <svg
          className="absolute inset-0 z-10 h-full w-full"
          aria-hidden="true"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <path
            d="M19 84 C25 75 30 69 35 66 C40 60 44 52 49 45 C56 35 61 29 66 24"
            fill="none"
            stroke="rgba(255,255,255,0.95)"
            strokeWidth="5"
            strokeLinecap="round"
          />

          <path
            d="M19 84 C25 75 30 69 35 66 C40 60 44 52 49 45 C56 35 61 29 66 24"
            fill="none"
            stroke="#0D6548"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </svg>
      ) : null}

      <div className="absolute bottom-[11%] left-[18%] z-20">
        <div className="grid size-10 place-items-center rounded-full bg-white text-[#0D6548] shadow-lg ring-[9px] ring-[#9FD6B4]/20">
          <Navigation size={18} />
        </div>
      </div>

      {visibleStops.map((stop, index) => (
        <StopMarker
          key={stop.id}
          stop={stop}
          index={index}
        />
      ))}
    </div>
  );
}