import { MapPin, Navigation, Timer } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  activeDispatchTrips,
  tripTimelineSteps,
} from "../data/mockDispatchData";
import { getDispatchStatusLabel } from "./DispatchStatusBadge";
import { DispatchMockMap } from "./DispatchMockMap";

export function DispatchLiveTrackingTab() {
  return (
    <div className="grid gap-3 xl:grid-cols-[220px_minmax(0,1fr)_240px]">
      <div className="space-y-3">
        {activeDispatchTrips.map((trip, index) => {
          const active = index === 0;

          return (
            <button
              key={trip.dispatchId}
              type="button"
              className={cn(
                "w-full rounded-[var(--cs-r-md)] border bg-[var(--cs-surface)] p-3 text-left shadow-none transition",
                active
                  ? "border-[#8b5cf6] bg-[#fbfaff]"
                  : "border-[var(--cs-border-soft)] hover:border-[#c4b5fd]"
              )}
            >
              <div className="text-sm font-bold text-[#6d28d9]">{trip.number}</div>
              <div className="mt-2 text-xs font-semibold text-[var(--cs-text)]">
                {trip.customerName}
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-[11px] text-[var(--cs-text-muted)]">
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    trip.status === "arrived_at_customer"
                      ? "bg-[#16a34a]"
                      : "bg-[#6d28d9]"
                  )}
                  aria-hidden="true"
                />
                {getDispatchStatusLabel(trip.status)}
              </div>
              <div className="mt-2 text-[11px] font-semibold text-[var(--cs-text)]">
                ETA
                <span className="ml-1 text-xs">{trip.etaMinutes} min</span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="space-y-3">
        <DispatchMockMap variant="route" />
        <Card className="rounded-[var(--cs-r-md)] border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] py-0 shadow-none ring-0">
          <CardContent className="px-3 py-3">
            <div className="grid gap-3 sm:grid-cols-5">
              {tripTimelineSteps.map((step, index) => (
                <div key={step.label} className="relative text-center">
                  {index < tripTimelineSteps.length - 1 ? (
                    <div className="absolute left-1/2 top-3 hidden h-px w-full bg-[var(--cs-border-soft)] sm:block" />
                  ) : null}
                  <div
                    className={cn(
                      "relative z-10 mx-auto flex size-6 items-center justify-center rounded-full border bg-white text-[10px]",
                      step.state === "completed" &&
                        "border-[#bbf7d0] bg-[#f0fdf4] text-[#16a34a]",
                      step.state === "active" &&
                        "border-[#6d28d9] bg-[#6d28d9] text-white",
                      step.state === "upcoming" &&
                        "border-[var(--cs-border)] bg-[var(--cs-surface-warm)] text-[var(--cs-text-muted)]"
                    )}
                  >
                    {index + 1}
                  </div>
                  <div className="mt-2 text-[11px] font-semibold text-[var(--cs-text)]">
                    {step.label}
                  </div>
                  <div className="text-[10px] text-[var(--cs-text-muted)]">{step.time}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="h-fit rounded-[var(--cs-r-md)] border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] py-0 shadow-none ring-0">
        <CardHeader className="border-b border-[var(--cs-border-soft)] px-3 py-3">
          <CardTitle className="text-sm font-bold text-[var(--cs-text)]">
            Trip Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 px-3 py-3">
          <SummaryField icon={Navigation} label="Driver" value="Mark Reyes" />
          <SummaryField icon={MapPin} label="Therapist" value="Ana Lopez" />
          <SummaryField icon={MapPin} label="Destination" value="Bacolod City" />
          <SummaryField icon={Timer} label="ETA" value="16 min" />
          <SummaryField label="Traffic" value="Light" valueClassName="text-[#16a34a]" />
          <SummaryField label="Last Update" value="8:09 AM" />
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryField({
  icon: Icon,
  label,
  value,
  valueClassName,
}: {
  icon?: typeof MapPin;
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[11px] font-medium leading-4 text-[var(--cs-text-muted)]">
        {Icon ? <Icon className="size-3" aria-hidden="true" /> : null}
        {label}
      </div>
      <div
        className={cn(
          "mt-0.5 text-[13px] font-bold leading-5 text-[var(--cs-text)]",
          valueClassName
        )}
      >
        {value}
      </div>
    </div>
  );
}
