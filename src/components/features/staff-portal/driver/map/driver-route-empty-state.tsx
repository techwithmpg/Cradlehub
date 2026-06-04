import Link from "next/link";
import { CalendarX2, Route } from "lucide-react";

type DriverRouteEmptyStateProps = {
  tripsHref: string;
};

export function DriverRouteEmptyState({ tripsHref }: DriverRouteEmptyStateProps) {
  return (
    <section className="mx-4 -mt-20 rounded-[2rem] border border-stone-200 bg-white p-5 text-center shadow-2xl shadow-stone-900/10">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-800">
        <CalendarX2 className="h-7 w-7" />
      </div>
      <h2 className="mt-4 text-xl font-black text-stone-950">No route assigned</h2>
      <p className="mx-auto mt-2 max-w-[280px] text-sm font-medium leading-6 text-stone-500">
        Your route map will appear when today&apos;s home-service jobs are assigned to you.
      </p>
      <Link
        href={tripsHref}
        className="mt-5 inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-900 px-5 text-sm font-black text-white shadow-lg shadow-emerald-950/15 active:scale-95"
      >
        <Route className="h-4 w-4" />
        View Trips
      </Link>
    </section>
  );
}
