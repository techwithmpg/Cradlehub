import Link from "next/link";
import { BriefcaseBusiness, RefreshCw } from "lucide-react";

type DriverJobsEmptyStateProps = {
  title?: string;
  description?: string;
  tripsHref: string;
  showRefreshHint?: boolean;
};

export function DriverJobsEmptyState({
  title = "No jobs assigned yet",
  description = "Your assigned jobs will appear here once CRM assigns them to you.",
  tripsHref,
  showRefreshHint = false,
}: DriverJobsEmptyStateProps) {
  return (
    <section className="rounded-[1.75rem] border border-stone-200 bg-white/82 px-5 py-8 text-center shadow-sm">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-800">
        {showRefreshHint ? (
          <RefreshCw className="h-7 w-7" />
        ) : (
          <BriefcaseBusiness className="h-7 w-7" />
        )}
      </div>
      <h2 className="mt-4 text-lg font-black text-stone-950">{title}</h2>
      <p className="mx-auto mt-2 max-w-[280px] text-sm font-semibold leading-6 text-stone-500">
        {description}
      </p>
      <Link
        href={tripsHref}
        className="mt-5 inline-flex min-h-11 items-center rounded-2xl border border-stone-200 bg-white px-4 text-sm font-black text-emerald-800 shadow-sm active:scale-95"
      >
        Go to Trips
      </Link>
    </section>
  );
}
