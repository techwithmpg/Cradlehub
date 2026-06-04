import { Activity, Clock3, Gauge, Navigation } from "lucide-react";
import { DriverRouteStatusBadge } from "./driver-route-status-badge";
import type { DriverRoutePageViewModel } from "./driver-route-view-model";

type DriverRouteSummaryBarProps = {
  viewModel: DriverRoutePageViewModel;
};

function SummaryChip({
  icon: Icon,
  label,
}: {
  icon: typeof Clock3;
  label: string;
}) {
  return (
    <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-stone-200 bg-white/85 px-3 py-2 text-xs font-extrabold text-stone-800 shadow-sm">
      <Icon className="h-4 w-4 text-emerald-800" />
      {label}
    </span>
  );
}

export function DriverRouteSummaryBar({ viewModel }: DriverRouteSummaryBarProps) {
  return (
    <section className="border-b border-stone-200/70 bg-[#fbf8f2]/95 px-4 py-3 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[480px] gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <DriverRouteStatusBadge state={viewModel.routeState} />
        <SummaryChip icon={Clock3} label={viewModel.etaLabel} />
        <SummaryChip icon={Navigation} label={viewModel.distanceLabel} />
        <SummaryChip icon={Gauge} label={viewModel.trafficLabel} />
        <SummaryChip icon={Activity} label={viewModel.liveLocationLabel} />
      </div>
    </section>
  );
}
