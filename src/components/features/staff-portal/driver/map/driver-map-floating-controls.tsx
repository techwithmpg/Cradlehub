import { LocateFixed, Map, Navigation } from "lucide-react";
import type { DriverRoutePageViewModel } from "./driver-route-view-model";

type DriverMapFloatingControlsProps = {
  viewModel: DriverRoutePageViewModel;
};

export function DriverMapFloatingControls({
  viewModel,
}: DriverMapFloatingControlsProps) {
  return (
    <div className="absolute right-4 top-1/2 z-30 flex -translate-y-1/2 flex-col items-end gap-3">
      <button
        type="button"
        disabled
        aria-label="Live recenter is not available yet"
        className="grid h-12 w-12 place-items-center rounded-full border border-stone-200 bg-white/95 text-stone-500 shadow-xl disabled:opacity-90"
      >
        <LocateFixed className="h-5 w-5" />
      </button>

      {viewModel.openRouteUrl ? (
        <a
          href={viewModel.openRouteUrl}
          target="_blank"
          rel="noreferrer"
          className="flex min-h-12 items-center gap-2 rounded-full border border-stone-200 bg-white/95 px-3 text-xs font-black text-stone-800 shadow-xl active:scale-95"
        >
          <Map className="h-5 w-5" />
          Maps
        </a>
      ) : (
        <span className="grid h-12 w-12 place-items-center rounded-full border border-stone-200 bg-white/95 text-stone-400 shadow-xl">
          <Navigation className="h-5 w-5" />
        </span>
      )}
    </div>
  );
}
