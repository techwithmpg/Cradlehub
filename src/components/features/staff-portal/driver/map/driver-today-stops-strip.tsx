import Link from "next/link";
import { cn } from "@/lib/utils";
import type { DriverRouteStopViewModel } from "./driver-route-view-model";

type DriverTodayStopsStripProps = {
  stops: DriverRouteStopViewModel[];
  tripsHref: string;
};

export function DriverTodayStopsStrip({
  stops,
  tripsHref,
}: DriverTodayStopsStripProps) {
  if (stops.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-black text-stone-950">
          Today&apos;s Stops ({stops.length})
        </h2>
        <Link
          href={tripsHref}
          className="inline-flex items-center rounded-full px-2 py-1 text-sm font-black text-emerald-800 active:scale-95"
        >
          View All
        </Link>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {stops.map((stop) => (
          <Link
            key={stop.id}
            href={stop.detailsHref}
            className={cn(
              "relative flex min-w-[184px] items-center gap-3 rounded-2xl border px-3 py-3 text-stone-900 shadow-sm active:scale-[0.98]",
              stop.isNextStop
                ? "border-emerald-200 bg-emerald-50"
                : "border-stone-200 bg-white",
              stop.isCompleted && "bg-teal-50"
            )}
          >
            <span
              className={cn(
                "grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-black text-white",
                stop.isCompleted ? "bg-teal-600" : "bg-emerald-800"
              )}
            >
              {stop.stopNumber}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-black">{stop.customerName}</span>
              <span className="mt-0.5 block text-xs font-semibold text-stone-500">
                {stop.startTimeLabel}
              </span>
            </span>
            {stop.isNextStop ? (
              <span className="absolute inset-x-0 -bottom-1 mx-auto h-2 w-5 rounded-t-full bg-emerald-800" />
            ) : null}
          </Link>
        ))}
      </div>
    </section>
  );
}
