"use client";

/**
 * DispatchSummaryCards
 *
 * Six KPI cards showing live dispatch state at a glance.
 * All values derived from DispatchData — no additional queries.
 */

import {
  Clock,
  Car,
  Navigation,
  Briefcase,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { CrmStatCard, type CrmCardTone } from "@/components/features/crm/shared/crm-cards";
import type { RealDispatchItem, DispatchStats } from "@/lib/queries/dispatch-queries";

interface Props {
  items: RealDispatchItem[];
  stats: DispatchStats;
  alertCount: number;
}

interface KpiCard {
  icon: React.ReactNode;
  value: number;
  label: string;
  detail: string;
  tone: CrmCardTone;
}

export function DispatchSummaryCards({ items, stats, alertCount }: Props) {
  const readyCount = items.filter((i) => i.dispatchStatus === "ready").length;
  const enRouteCount = items.filter((i) => i.dispatchStatus === "in_route").length;
  const inServiceCount = items.filter(
    (i) => i.dispatchStatus === "service_started"
  ).length;

  const cards: KpiCard[] = [
    {
      icon: <Clock className="h-4 w-4" />,
      value: stats.awaitingDispatch,
      label: "Needs Driver",
      detail: "Awaiting assignment",
      tone: stats.awaitingDispatch > 0 ? "warning" : "neutral",
    },
    {
      icon: <Car className="h-4 w-4" />,
      value: readyCount,
      label: "Ready",
      detail: "Driver assigned",
      tone: readyCount > 0 ? "info" : "neutral",
    },
    {
      icon: <Navigation className="h-4 w-4" />,
      value: enRouteCount,
      label: "En Route",
      detail: "Trip underway",
      tone: enRouteCount > 0 ? "info" : "neutral",
    },
    {
      icon: <Briefcase className="h-4 w-4" />,
      value: inServiceCount,
      label: "In Service",
      detail: "Session ongoing",
      tone: inServiceCount > 0 ? "success" : "neutral",
    },
    {
      icon: <CheckCircle2 className="h-4 w-4" />,
      value: stats.completedToday,
      label: "Completed",
      detail: "Finished today",
      tone: "success",
    },
    {
      icon: <AlertTriangle className="h-4 w-4" />,
      value: alertCount,
      label: "Alerts",
      detail: "Need attention",
      tone: alertCount > 0 ? "danger" : "neutral",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {cards.map((card) => (
        <CrmStatCard
          key={card.label}
          title={card.label}
          value={card.value}
          subtitle={card.detail}
          icon={card.icon}
          tone={card.tone}
          compact
        />
      ))}
    </div>
  );
}
