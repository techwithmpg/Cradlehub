import Link from "next/link";
import {
  Activity,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Home,
  MapPin,
  Navigation,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DriverJobStatusBadge } from "./driver-job-status-badge";
import type { DriverJobDisplayStatus, DriverJobViewModel } from "./driver-jobs-view-model";

type DriverJobCardProps = {
  job: DriverJobViewModel;
  detailsHref: string;
  compact?: boolean;
};

function StatusIcon({ status }: { status: DriverJobDisplayStatus }) {
  if (status === "completed") return <CheckCircle2 className="h-8 w-8" />;
  if (status === "on_route" || status === "arrived") return <Navigation className="h-8 w-8" />;
  if (status === "in_progress") return <Activity className="h-8 w-8" />;
  return <Clock3 className="h-8 w-8" />;
}

function iconTone(status: DriverJobDisplayStatus): string {
  if (status === "completed") return "bg-green-50 text-green-800";
  if (status === "on_route" || status === "arrived") return "bg-teal-50 text-teal-800";
  if (status === "in_progress") return "bg-emerald-50 text-emerald-800";
  if (status === "cancelled" || status === "no_show") return "bg-red-50 text-red-700";
  return "bg-violet-50 text-violet-700";
}

export function DriverJobCard({
  job,
  detailsHref,
  compact = false,
}: DriverJobCardProps) {
  return (
    <Link
      href={detailsHref}
      aria-label={`Open job for ${job.customerName}`}
      className={cn(
        "block rounded-[1.75rem] border border-stone-200 bg-white/82 text-stone-950 shadow-sm active:scale-[0.99]",
        compact ? "px-4 py-4" : "px-4 py-5"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {!compact ? (
            <div className="mb-4 text-[28px] font-black leading-none tracking-normal text-stone-950">
              {job.scheduledTimeLabel}
            </div>
          ) : null}
          {compact && job.scheduledDateLabel ? (
            <div className="mb-2 text-xs font-black uppercase tracking-wide text-stone-500">
              {job.scheduledDateLabel}
            </div>
          ) : null}
        </div>
        <DriverJobStatusBadge status={job.displayStatus} label={job.statusLabel} />
      </div>

      <div className="mt-2 grid grid-cols-[88px_1fr_auto] items-center gap-4">
        <div className="flex justify-center border-r border-stone-200 pr-4">
          <div className={cn("grid h-20 w-20 place-items-center rounded-full", iconTone(job.displayStatus))}>
            <StatusIcon status={job.displayStatus} />
          </div>
        </div>

        <div className="min-w-0 space-y-3">
          <div className="flex items-center gap-3">
            <UserRound className={cn(
              "h-5 w-5 shrink-0",
              job.displayStatus === "upcoming" ? "fill-violet-700 text-violet-700" : "fill-emerald-800 text-emerald-800"
            )} />
            <span className="truncate text-[22px] font-black leading-tight">
              {job.customerName}
            </span>
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

        <ChevronRight className="h-7 w-7 shrink-0 text-stone-700" />
      </div>
    </Link>
  );
}
