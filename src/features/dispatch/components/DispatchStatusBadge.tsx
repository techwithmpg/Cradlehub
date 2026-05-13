import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { DispatchStatus } from "../types";

const statusConfig: Record<
  DispatchStatus,
  { label: string; className: string }
> = {
  in_route: {
    label: "In Route",
    className: "border-[#bfdbfe] bg-[#eff6ff] text-[#1d4ed8]",
  },
  ready: {
    label: "Ready",
    className: "border-[#bbf7d0] bg-[#f0fdf4] text-[#15803d]",
  },
  en_route_to_therapist: {
    label: "En Route to Therapist",
    className: "border-[#c4b5fd] bg-[#f5f3ff] text-[#6d28d9]",
  },
  awaiting_driver: {
    label: "Awaiting Driver",
    className: "border-[#fde68a] bg-[#fffbeb] text-[#b45309]",
  },
  arrived_at_customer: {
    label: "Arrived at Customer",
    className: "border-[#bbf7d0] bg-[#f0fdf4] text-[#15803d]",
  },
  delayed: {
    label: "Delayed",
    className: "border-[#fecaca] bg-[#fef2f2] text-[#b91c1c]",
  },
  completed: {
    label: "Completed",
    className: "border-[#bbf7d0] bg-[#f0fdf4] text-[#15803d]",
  },
  cancelled: {
    label: "Cancelled",
    className: "border-[#fecaca] bg-[#fef2f2] text-[#b91c1c]",
  },
};

export function getDispatchStatusLabel(status: DispatchStatus) {
  return statusConfig[status].label;
}

export function DispatchStatusBadge({
  status,
  className,
}: {
  status: DispatchStatus;
  className?: string;
}) {
  const config = statusConfig[status];

  return (
    <Badge
      variant="outline"
      className={cn(
        "h-5 rounded-[var(--cs-r-sm)] border px-2 text-[11px] font-medium",
        config.className,
        className
      )}
    >
      {config.label}
    </Badge>
  );
}
