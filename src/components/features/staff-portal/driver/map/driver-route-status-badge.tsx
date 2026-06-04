import { CheckCircle2, Clock3, LocateFixed, MapPinned, PlayCircle, Route } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DriverRouteState } from "./driver-route-view-model";

type DriverRouteStatusBadgeProps = {
  state: DriverRouteState;
  compact?: boolean;
};

const STATUS_META: Record<
  DriverRouteState,
  {
    label: string;
    className: string;
    icon: typeof Route;
  }
> = {
  no_route: {
    label: "No Route",
    className: "border-slate-200 bg-slate-50 text-slate-600",
    icon: Route,
  },
  upcoming: {
    label: "Upcoming",
    className: "border-amber-200 bg-amber-50 text-amber-800",
    icon: Clock3,
  },
  on_route: {
    label: "On Route",
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
    icon: LocateFixed,
  },
  arrived: {
    label: "Arrived",
    className: "border-blue-200 bg-blue-50 text-blue-800",
    icon: MapPinned,
  },
  in_progress: {
    label: "In Progress",
    className: "border-violet-200 bg-violet-50 text-violet-800",
    icon: PlayCircle,
  },
  completed: {
    label: "Completed",
    className: "border-teal-200 bg-teal-50 text-teal-800",
    icon: CheckCircle2,
  },
};

export function DriverRouteStatusBadge({
  state,
  compact = false,
}: DriverRouteStatusBadgeProps) {
  const meta = STATUS_META[state];
  const Icon = meta.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border font-extrabold",
        compact ? "px-2.5 py-1 text-[11px]" : "px-3 py-2 text-xs",
        meta.className
      )}
    >
      <Icon className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
      {meta.label}
    </span>
  );
}
