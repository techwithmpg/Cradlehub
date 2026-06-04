import { DriverMapFloatingControls } from "./driver-map-floating-controls";
import { DriverRouteMapPlaceholder } from "./driver-route-map-placeholder";
import type { DriverRoutePageViewModel } from "./driver-route-view-model";

type DriverRouteMapPanelProps = {
  viewModel: DriverRoutePageViewModel;
};

export function DriverRouteMapPanel({ viewModel }: DriverRouteMapPanelProps) {
  return (
    <section className="relative min-h-[440px] overflow-hidden border-b border-stone-200 bg-stone-100">
      <DriverRouteMapPlaceholder viewModel={viewModel} />
      <DriverMapFloatingControls viewModel={viewModel} />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-24 bg-gradient-to-t from-[#fbf8f2] to-transparent" />
    </section>
  );
}
