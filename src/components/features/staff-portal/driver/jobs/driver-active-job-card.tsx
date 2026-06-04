import Link from "next/link";
import { ChevronRight, Clock3, Home, MapPin, UserRound } from "lucide-react";
import { DriverActiveJobTimer } from "./driver-active-job-timer";
import { DriverJobStatusBadge } from "./driver-job-status-badge";
import type { DriverJobViewModel } from "./driver-jobs-view-model";

type DriverActiveJobCardProps = {
  job: DriverJobViewModel;
  detailsHref: string;
};

export function DriverActiveJobCard({
  job,
  detailsHref,
}: DriverActiveJobCardProps) {
  return (
    <Link
      href={detailsHref}
      aria-label={`Open active job for ${job.customerName}`}
      className="block rounded-[1.75rem] border border-emerald-700/45 bg-white/82 p-4 text-stone-950 shadow-sm active:scale-[0.99]"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex min-h-9 items-center gap-2 rounded-xl bg-emerald-900 px-3 text-sm font-black uppercase text-white shadow-lg shadow-emerald-950/15">
          <Clock3 className="h-4 w-4" />
          Active Job
        </span>
        <DriverJobStatusBadge status={job.displayStatus} label={job.statusLabel} />
      </div>

      <div className="mt-6 grid grid-cols-[132px_1fr] gap-4">
        <div className="flex flex-col items-center justify-center border-r border-stone-200 pr-4 text-center">
          <div className="grid h-20 w-20 place-items-center rounded-full bg-emerald-50 text-emerald-900">
            <Clock3 className="h-9 w-9" />
          </div>
          <div className="mt-3 text-[22px] font-black leading-none text-emerald-900">
            <DriverActiveJobTimer
              startedAt={job.startedAt}
              fallbackLabel={job.statusLabel}
            />
          </div>
          <div className="mt-2 text-sm font-semibold text-stone-500">Elapsed</div>
        </div>

        <div className="min-w-0 py-1">
          <div className="flex items-start justify-between gap-2">
            <div className="text-[30px] font-black leading-none tracking-normal text-stone-950">
              {job.scheduledTimeLabel}
            </div>
            <ChevronRight className="mt-2 h-7 w-7 shrink-0 text-stone-700" />
          </div>

          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-3">
              <UserRound className="h-5 w-5 shrink-0 fill-emerald-800 text-emerald-800" />
              <span className="truncate text-[22px] font-black">{job.customerName}</span>
            </div>
            <div className="flex items-start gap-3 text-base font-semibold leading-6 text-stone-500">
              <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-stone-800" />
              <span>{job.address}</span>
            </div>
            <div className="flex items-center gap-3 text-base font-bold text-stone-800">
              <Home className="h-5 w-5 shrink-0 text-stone-800" />
              <span className="truncate">{job.serviceName ?? "Service pending"}</span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
