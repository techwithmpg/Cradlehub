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
  valueColor: string;
  iconColor: string;
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
      valueColor:
        stats.awaitingDispatch > 0 ? "#B45309" : "var(--cs-text-muted)",
      iconColor:
        stats.awaitingDispatch > 0 ? "#B45309" : "var(--cs-text-muted)",
    },
    {
      icon: <Car className="h-4 w-4" />,
      value: readyCount,
      label: "Ready",
      detail: "Driver assigned",
      valueColor: readyCount > 0 ? "#1D4ED8" : "var(--cs-text-muted)",
      iconColor: readyCount > 0 ? "#1D4ED8" : "var(--cs-text-muted)",
    },
    {
      icon: <Navigation className="h-4 w-4" />,
      value: enRouteCount,
      label: "En Route",
      detail: "Trip underway",
      valueColor: enRouteCount > 0 ? "#7C3AED" : "var(--cs-text-muted)",
      iconColor: enRouteCount > 0 ? "#7C3AED" : "var(--cs-text-muted)",
    },
    {
      icon: <Briefcase className="h-4 w-4" />,
      value: inServiceCount,
      label: "In Service",
      detail: "Session ongoing",
      valueColor:
        inServiceCount > 0 ? "var(--cs-success)" : "var(--cs-text-muted)",
      iconColor:
        inServiceCount > 0 ? "var(--cs-success)" : "var(--cs-text-muted)",
    },
    {
      icon: <CheckCircle2 className="h-4 w-4" />,
      value: stats.completedToday,
      label: "Completed",
      detail: "Finished today",
      valueColor: "var(--cs-text-secondary)",
      iconColor: "var(--cs-text-muted)",
    },
    {
      icon: <AlertTriangle className="h-4 w-4" />,
      value: alertCount,
      label: "Alerts",
      detail: "Need attention",
      valueColor: alertCount > 0 ? "var(--cs-error)" : "var(--cs-text-muted)",
      iconColor: alertCount > 0 ? "var(--cs-error)" : "var(--cs-text-muted)",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {cards.map((card) => (
        <div
          key={card.label}
          className="cs-metric flex flex-col gap-1.5"
        >
          <span style={{ color: card.iconColor }}>{card.icon}</span>
          <span
            style={{
              fontSize: "1.5rem",
              fontWeight: 700,
              lineHeight: 1,
              color: card.valueColor,
            }}
          >
            {card.value}
          </span>
          <span
            style={{
              fontSize: "0.8125rem",
              fontWeight: 600,
              color: "var(--cs-text)",
            }}
          >
            {card.label}
          </span>
          <span
            style={{ fontSize: "0.6875rem", color: "var(--cs-text-muted)" }}
          >
            {card.detail}
          </span>
        </div>
      ))}
    </div>
  );
}
