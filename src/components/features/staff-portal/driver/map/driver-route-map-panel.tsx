import { DriverMapFloatingControls } from "./driver-map-floating-controls";
import { DriverRouteMapPlaceholder } from "./driver-route-map-placeholder";
import type { DriverRoutePageViewModel } from "./driver-route-view-model";

type DriverRouteMapPanelProps = {
  viewModel: DriverRoutePageViewModel;
};

export function DriverRouteMapPanel({
  viewModel,
}: DriverRouteMapPanelProps) {
  return (
    <section className="absolute inset-0 overflow-hidden bg-[#EEF2ED]">
      <DriverRouteMapPlaceholder viewModel={viewModel} />

      <DriverMapFloatingControls viewModel={viewModel} />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-40 bg-gradient-to-t from-[#F7F3EB]/95 via-[#F7F3EB]/30 to-transparent" />
    </section>
  );
}