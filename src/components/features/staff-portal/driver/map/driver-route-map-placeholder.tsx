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
    marker: "left-[38%] top-[68%]",
    label: "left-[43%] top-[59%]",
  },
  {
    marker: "left-[40%] top-[48%]",
    label: "left-[47%] top-[42%]",
  },
  {
    marker: "left-[58%] top-[22%]",
    label: "left-[26%] top-[19%]",
  },
] as const;

function ordinal(value: number): string {
  if (value === 1) return "1st";
  if (value === 2) return "2nd";
  if (value === 3) return "3rd";
  return `${value}th`;
}

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
          "absolute z-20 grid h-10 w-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-[3px] border-white text-sm font-black text-white shadow-lg",
          position.marker,
          stop.isNextStop ? "bg-emerald-900" : "bg-emerald-800",
          stop.isCompleted && "bg-teal-600"
        )}
      >
        {stop.stopNumber}
      </div>
      <div
        className={cn(
          "absolute z-20 max-w-[150px] rounded-2xl bg-white/95 px-3 py-2 text-stone-900 shadow-xl ring-1 ring-stone-200/70",
          position.label,
          stop.isNextStop && "bg-emerald-900 text-white ring-emerald-700"
        )}
      >
        <div className="flex items-center gap-1 text-sm font-black leading-tight">
          {stop.isNextStop ? "Next Stop" : `${ordinal(stop.stopNumber)} Stop`}
          {stop.isNextStop ? <ChevronRight className="h-4 w-4" /> : null}
        </div>
        <div className="mt-1 truncate text-xs font-bold opacity-80">{stop.customerName}</div>
        <div className="text-xs opacity-70">{stop.startTimeLabel}</div>
      </div>
    </>
  );
}

export function DriverRouteMapPlaceholder({ viewModel }: DriverRouteMapPlaceholderProps) {
  const visibleStops = viewModel.stops.slice(0, STOP_POSITIONS.length);

  return (
    <div className="relative h-full min-h-[420px] overflow-hidden bg-[#e9efe7]">
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(15,81,56,0.08)_1px,transparent_1px),linear-gradient(0deg,rgba(15,81,56,0.08)_1px,transparent_1px)] bg-[length:44px_44px]" />
      <div className="absolute left-[-18%] top-[18%] h-3 w-[135%] rotate-[14deg] rounded-full bg-amber-200/55" />
      <div className="absolute left-[-10%] top-[56%] h-2.5 w-[120%] -rotate-[18deg] rounded-full bg-stone-50/80" />
      <div className="absolute left-[66%] top-[-10%] h-[120%] w-2 rotate-[18deg] rounded-full bg-sky-200/45" />
      <div className="absolute left-[5%] top-[35%] rounded-lg bg-white/40 px-2 py-1 text-xl font-black text-stone-800/75">
        Makati
      </div>
      <div className="absolute right-[7%] top-[16%] rounded-lg bg-white/40 px-2 py-1 text-lg font-black text-stone-800/75">
        Mandaluyong
      </div>
      <div className="absolute right-[18%] top-[54%] rounded-lg bg-white/40 px-2 py-1 text-xl font-black text-stone-800/75">
        Taguig
      </div>

      {viewModel.totalStops > 0 ? (
        <svg
          className="absolute inset-0 z-10 h-full w-full"
          aria-hidden="true"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <path
            d="M38 80 L37 64 L47 54 L41 44 L60 32 L58 22"
            className="fill-none stroke-white/80 stroke-[5]"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M38 80 L37 64 L47 54 L41 44 L60 32 L58 22"
            className="fill-none stroke-emerald-800 stroke-[2.4]"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M38 80 L37 64"
            className="fill-none stroke-emerald-600 stroke-[3]"
            strokeDasharray="1 3"
            strokeLinecap="round"
          />
        </svg>
      ) : null}

      <div className="absolute left-[38%] top-[78%] z-20 grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white shadow-xl ring-[12px] ring-sky-300/25">
        <Navigation className="h-6 w-6 rotate-45 fill-emerald-800 text-emerald-800" />
      </div>

      {visibleStops.map((stop, index) => (
        <StopMarker key={stop.id} stop={stop} index={index} />
      ))}
    </div>
  );
}
