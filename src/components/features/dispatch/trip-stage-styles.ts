import type { GpsFreshnessState } from "@/lib/dispatch/crm-live-map-model";
import type { TripStageKey } from "@/lib/dispatch/trip-presentation";

export interface StageStyleMeta {
  badgeClass: string;
  accentHex: string;
  mutedHex: string;
  markerBgHex: string;
  dotClass: string;
  ringClass: string;
}

export const TRIP_STAGE_STYLES: Record<TripStageKey, StageStyleMeta> = {
  pickup: {
    badgeClass: "border-sky-300 bg-sky-50 text-sky-800",
    accentHex: "#0284C7",
    mutedHex: "#94A3B8",
    markerBgHex: "#0284C7",
    dotClass: "bg-sky-600",
    ringClass: "border-sky-600 ring-sky-200",
  },
  dispatched: {
    badgeClass: "border-slate-300 bg-slate-100 text-slate-700",
    accentHex: "#475569",
    mutedHex: "#CBD5E1",
    markerBgHex: "#475569",
    dotClass: "bg-slate-600",
    ringClass: "border-slate-600 ring-slate-200",
  },
  en_route: {
    badgeClass: "border-blue-300 bg-blue-50 text-blue-700",
    accentHex: "#2563EB",
    mutedHex: "#94A3B8",
    markerBgHex: "#2563EB",
    dotClass: "bg-blue-600",
    ringClass: "border-blue-600 ring-blue-200",
  },
  arrived: {
    badgeClass: "border-purple-300 bg-purple-50 text-purple-700",
    accentHex: "#7C3AED",
    mutedHex: "#94A3B8",
    markerBgHex: "#7C3AED",
    dotClass: "bg-purple-600",
    ringClass: "border-purple-600 ring-purple-200",
  },
  in_service: {
    badgeClass: "border-emerald-300 bg-emerald-50 text-emerald-700",
    accentHex: "#15803D",
    mutedHex: "#94A3B8",
    markerBgHex: "#15803D",
    dotClass: "bg-emerald-600",
    ringClass: "border-emerald-600 ring-emerald-200",
  },
  collection: {
    badgeClass: "border-orange-300 bg-orange-50 text-orange-800",
    accentHex: "#EA580C",
    mutedHex: "#94A3B8",
    markerBgHex: "#EA580C",
    dotClass: "bg-orange-600",
    ringClass: "border-orange-600 ring-orange-200",
  },
  returning: {
    badgeClass: "border-slate-400 bg-slate-100 text-slate-800",
    accentHex: "#334155",
    mutedHex: "#94A3B8",
    markerBgHex: "#334155",
    dotClass: "bg-slate-700",
    ringClass: "border-slate-700 ring-slate-200",
  },
  completed: {
    badgeClass: "border-green-300 bg-green-50 text-green-800",
    accentHex: "#155A33",
    mutedHex: "#94A3B8",
    markerBgHex: "#155A33",
    dotClass: "bg-[#155A33]",
    ringClass: "border-[#155A33] ring-green-200",
  },
};

export function gpsFreshnessBadgeClass(state: GpsFreshnessState): string {
  switch (state) {
    case "live":
      return "border-emerald-300 bg-emerald-50 text-emerald-700";
    case "delayed":
    case "poor_accuracy":
      return "border-amber-300 bg-amber-50 text-amber-800";
    case "stale":
    case "permission_missing":
    case "offline":
      return "border-red-300 bg-red-50 text-red-700";
    default:
      return "border-slate-300 bg-slate-50 text-slate-600";
  }
}
