"use client";

import {
  BedDouble,
  CheckCircle2,
  LayoutGrid,
  MapPin,
  Navigation,
  RefreshCw,
  RotateCcw,
  Send,
  UserRound,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TripFilterCounts, TripFilterKey } from "@/lib/dispatch/trip-presentation";

type FilterDef = {
  key: TripFilterKey;
  label: string;
  icon: typeof LayoutGrid;
  activeClass: string;
  iconClass: string;
};

const FILTER_DEFS: FilterDef[] = [
  {
    key: "all",
    label: "All",
    icon: LayoutGrid,
    activeClass: "border-[#155A33] bg-[#EEF7F1] text-[#155A33]",
    iconClass: "text-[#155A33]",
  },
  {
    key: "pickup",
    label: "Pickup",
    icon: UserRound,
    activeClass: "border-sky-600 bg-sky-50 text-sky-800",
    iconClass: "text-sky-600",
  },
  {
    key: "dispatched",
    label: "Dispatched",
    icon: Send,
    activeClass: "border-slate-600 bg-slate-100 text-slate-800",
    iconClass: "text-slate-600",
  },
  {
    key: "en_route",
    label: "En Route",
    icon: Navigation,
    activeClass: "border-blue-600 bg-blue-50 text-blue-800",
    iconClass: "text-blue-600",
  },
  {
    key: "arrived",
    label: "Arrived",
    icon: MapPin,
    activeClass: "border-purple-600 bg-purple-50 text-purple-800",
    iconClass: "text-purple-600",
  },
  {
    key: "in_service",
    label: "In Service",
    icon: BedDouble,
    activeClass: "border-emerald-600 bg-emerald-50 text-emerald-800",
    iconClass: "text-emerald-600",
  },
  {
    key: "collection",
    label: "Collection",
    icon: Users,
    activeClass: "border-orange-600 bg-orange-50 text-orange-800",
    iconClass: "text-orange-600",
  },
  {
    key: "returning",
    label: "Returning",
    icon: RotateCcw,
    activeClass: "border-slate-700 bg-slate-100 text-slate-900",
    iconClass: "text-slate-700",
  },
];

export function LiveMapFilterBar({
  activeFilter,
  counts,
  onSelectFilter,
  onRefresh,
}: {
  activeFilter: TripFilterKey;
  counts: TripFilterCounts;
  onSelectFilter: (key: TripFilterKey) => void;
  onRefresh?: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[var(--cs-text)]">
            Live Home-Service Map
          </h2>
          <p className="text-xs text-[var(--cs-text-secondary)]">
            Real-time drivers, trips, and service status
          </p>
        </div>

        {onRefresh ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRefresh}
            className="shrink-0 lg:hidden"
          >
            <RefreshCw size={13} />
            Refresh
          </Button>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <div
          role="group"
          aria-label="Journey status filters"
          className="flex flex-1 items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0"
        >
          {FILTER_DEFS.map((filter) => {
            const Icon = filter.icon;
            const selected = activeFilter === filter.key;
            const count = counts[filter.key];
            return (
              <button
                key={filter.key}
                type="button"
                aria-pressed={selected}
                onClick={() => onSelectFilter(filter.key)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                  selected
                    ? `${filter.activeClass} shadow-xs`
                    : "border-[var(--cs-border)] bg-white text-[var(--cs-text-secondary)] hover:border-[var(--cs-border-strong)] hover:bg-[var(--cs-surface-warm)]"
                )}
              >
                <Icon size={13} className={filter.iconClass} />
                <span>
                  {filter.label} ({count})
                </span>
              </button>
            );
          })}
        </div>

        {onRefresh ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRefresh}
            className="hidden shrink-0 lg:inline-flex"
          >
            <RefreshCw size={13} />
            Refresh
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export { CheckCircle2 };
