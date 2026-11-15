"use client";

import { AlertTriangle, CheckCircle2, ClipboardList, Clock, Users } from "lucide-react";
import { CrmStatCard, type CrmCardTone } from "@/components/features/crm/shared/crm-cards";

export type ScheduleKpiData = {
  total: number;
  confirmed: number;
  in_progress: number;
  completed: number;
  available_staff: number;
  alerts: number;
};

type ScheduleKpiCardsProps = {
  data: ScheduleKpiData;
};

const KPI_DEF = [
  { key: "total" as const, label: "Total Bookings", icon: ClipboardList, sub: "Scheduled today", tone: "neutral" as CrmCardTone },
  { key: "confirmed" as const, label: "Confirmed", icon: CheckCircle2, sub: "Awaiting service", tone: "info" as CrmCardTone },
  { key: "in_progress" as const, label: "In Progress", icon: Clock, sub: "Currently serving", tone: "warning" as CrmCardTone },
  { key: "completed" as const, label: "Completed", icon: CheckCircle2, sub: "Finished today", tone: "success" as CrmCardTone },
  { key: "available_staff" as const, label: "Available Staff", icon: Users, sub: "On duty now", tone: "success" as CrmCardTone },
  { key: "alerts" as const, label: "Alerts", icon: AlertTriangle, sub: "Need attention", tone: "danger" as CrmCardTone },
];

export function ScheduleKpiCards({ data }: ScheduleKpiCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {KPI_DEF.map((kpi) => {
        const value = data[kpi.key];
        const Icon = kpi.icon;
        const tone: CrmCardTone = kpi.key === "alerts" && value === 0 ? "neutral" : kpi.tone;
        return (
          <CrmStatCard
            key={kpi.key}
            title={kpi.label}
            value={value}
            subtitle={kpi.sub}
            icon={<Icon className="size-4" />}
            tone={tone}
            compact
          />
        );
      })}
    </div>
  );
}
