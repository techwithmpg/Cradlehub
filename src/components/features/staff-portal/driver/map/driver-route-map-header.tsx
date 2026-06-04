import Link from "next/link";
import { Bell, ChevronLeft, MoreHorizontal } from "lucide-react";
import type { DriverRoutePageViewModel } from "./driver-route-view-model";

type DriverRouteMapHeaderProps = {
  viewModel: DriverRoutePageViewModel;
  homeHref: string;
  tripsHref: string;
  profileHref: string;
};

export function DriverRouteMapHeader({
  viewModel,
  homeHref,
  tripsHref,
  profileHref,
}: DriverRouteMapHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-stone-200/70 bg-[#fbf8f2]/95 px-4 pb-4 pt-[calc(0.875rem+env(safe-area-inset-top))] backdrop-blur-xl">
      <div className="mx-auto flex max-w-[480px] items-center gap-3">
        <Link
          href={homeHref}
          aria-label="Back to driver home"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-stone-200 bg-white text-stone-900 shadow-sm active:scale-95"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[26px] font-black leading-tight text-emerald-950">
            Route Map
          </h1>
          <p className="mt-0.5 truncate text-sm font-semibold text-stone-500">
            Today&apos;s active route
          </p>
        </div>

        <Link
          href={tripsHref}
          aria-label={
            viewModel.attentionCount > 0
              ? `${viewModel.attentionCount} route items need attention`
              : "Open trips"
          }
          className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full border border-stone-200 bg-white text-stone-900 shadow-sm active:scale-95"
        >
          <Bell className="h-5 w-5" />
          {viewModel.attentionCount > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 grid min-h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-black leading-none text-white">
              {viewModel.attentionCount}
            </span>
          ) : null}
        </Link>

        <Link
          href={profileHref}
          aria-label="Open profile"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-stone-200 bg-white text-stone-900 shadow-sm active:scale-95"
        >
          <MoreHorizontal className="h-5 w-5" />
        </Link>
      </div>
    </header>
  );
}
