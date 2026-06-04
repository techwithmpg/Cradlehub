import { cn } from "@/lib/utils";
import type { DriverJobDisplayStatus } from "./driver-jobs-view-model";

type DriverJobStatusBadgeProps = {
  status: DriverJobDisplayStatus | string;
  label?: string;
};

const STATUS_STYLE: Record<DriverJobDisplayStatus, string> = {
  upcoming: "border-violet-100 bg-violet-50 text-violet-700",
  in_progress: "border-emerald-100 bg-emerald-50 text-emerald-800",
  on_route: "border-teal-100 bg-teal-50 text-teal-800",
  arrived: "border-amber-100 bg-amber-50 text-amber-800",
  completed: "border-green-100 bg-green-50 text-green-800",
  cancelled: "border-red-100 bg-red-50 text-red-700",
  no_show: "border-red-100 bg-red-50 text-red-700",
};

function isDriverJobDisplayStatus(status: string): status is DriverJobDisplayStatus {
  return status in STATUS_STYLE;
}

function fallbackLabel(status: string): string {
  return status
    .split("_")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

export function DriverJobStatusBadge({
  status,
  label,
}: DriverJobStatusBadgeProps) {
  const statusKey = isDriverJobDisplayStatus(status) ? status : "upcoming";

  return (
    <span
      className={cn(
        "inline-flex min-h-8 items-center rounded-2xl border px-3 text-xs font-black leading-none",
        STATUS_STYLE[statusKey]
      )}
    >
      {label ?? fallbackLabel(status)}
    </span>
  );
}
