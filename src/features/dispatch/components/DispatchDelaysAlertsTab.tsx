import {
  AlertTriangle,
  Car,
  MapPin,
  Route,
  TimerReset,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  delayAlertStats,
  dispatchAlerts,
} from "../data/mockDispatchData";
import type { DispatchAlert } from "../types";
import { DispatchStatsCards } from "./DispatchStatsCards";

const alertStatIcons = [
  <TimerReset key="timer" className="size-4" aria-hidden="true" />,
  <Car key="car" className="size-4" aria-hidden="true" />,
  <UserRound key="driver" className="size-4" aria-hidden="true" />,
  <UserRound key="therapist" className="size-4" aria-hidden="true" />,
];

export function DispatchDelaysAlertsTab({
  onViewDispatch,
}: {
  onViewDispatch: (dispatchNumber: string) => void;
}) {
  return (
    <div className="space-y-3">
      <DispatchStatsCards
        stats={delayAlertStats.map((stat, index) => ({
          ...stat,
          icon: alertStatIcons[index],
        }))}
      />

      <Card className="rounded-[var(--cs-r-md)] border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] py-0 shadow-none ring-0">
        <CardContent className="divide-y divide-[var(--cs-border-soft)] p-0">
          {dispatchAlerts.map((alert) => (
            <AlertRow
              key={alert.id}
              alert={alert}
              onViewDispatch={onViewDispatch}
            />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function AlertRow({
  alert,
  onViewDispatch,
}: {
  alert: DispatchAlert;
  onViewDispatch: (dispatchNumber: string) => void;
}) {
  const Icon =
    alert.title === "Location Issue"
      ? MapPin
      : alert.title === "Detour Added"
        ? Route
        : alert.title === "Traffic Delay"
          ? Car
          : alert.title === "Driver Running Late"
            ? UserRound
            : AlertTriangle;

  const severityClasses = {
    danger: "bg-[#fef2f2] text-[#dc2626]",
    warning: "bg-[#fffbeb] text-[#f59e0b]",
    info: "bg-[#eff6ff] text-[#2563eb]",
  }[alert.severity];

  return (
    <div className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center">
      <div
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full",
          severityClasses
        )}
        aria-hidden="true"
      >
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold leading-5 text-[var(--cs-text)]">
          {alert.title}
        </div>
        <div className="text-xs leading-5 text-[var(--cs-text-secondary)]">
          {alert.description}
        </div>
      </div>
      <div className="text-xs font-medium text-[var(--cs-text-muted)] sm:w-24 sm:text-right">
        {alert.timeAgo}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 border-[#c4b5fd] text-xs font-semibold text-[#6d28d9] sm:w-32"
        onClick={() => onViewDispatch(alert.dispatchNumber)}
      >
        View Dispatch
      </Button>
    </div>
  );
}
