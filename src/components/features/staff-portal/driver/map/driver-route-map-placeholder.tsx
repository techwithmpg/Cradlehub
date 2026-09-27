import type { DriverRoutePageViewModel } from "./driver-route-view-model";

export function DriverRouteMapPlaceholder({ viewModel }: { viewModel: DriverRoutePageViewModel }) {
  const location = viewModel.nextStop?.recordedLocation;
  const valid = location && Number.isFinite(location.lat) && Number.isFinite(location.lng) &&
    Math.abs(location.lat) <= 90 && Math.abs(location.lng) <= 180;
  return (
    <div className="relative h-full overflow-hidden bg-[#E9EFE8] px-4 py-6 text-sm text-[#26394B]">
      <p className="font-bold">Route geometry unavailable</p>
      <p className="mt-2">Open Maps for directions to the recorded destination.</p>
      {valid ? <div className="mt-4">
        <p>Last recorded location: {location.lat}, {location.lng}</p>
        <p className="text-xs">{location.recorded_at}</p>
      </div> : <p className="mt-4">Driver location unavailable</p>}
    </div>
  );
}
