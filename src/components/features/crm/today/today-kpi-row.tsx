"use client";

import { Activity, AlertCircle, CalendarCheck, CheckCircle2 } from "lucide-react";
import { CrmStatCard } from "@/components/features/crm/shared/crm-cards";

type Props = {
  activeToday: number;
  inProgress: number;
  completed: number;
  unpaid: number;
};

export function TodayKpiRow({ activeToday, inProgress, completed, unpaid }: Props) {
  return (
    <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <CrmStatCard
        title="Active Today"
        value={activeToday}
        subtitle="Scheduled today"
        icon={<CalendarCheck className="size-4" />}
        tone="neutral"
        compact
      />
      <CrmStatCard
        title="In Progress"
        value={inProgress}
        subtitle="Currently running"
        icon={<Activity className="size-4" />}
        tone="info"
        compact
      />
      <CrmStatCard
        title="Completed"
        value={completed}
        subtitle="Finished today"
        icon={<CheckCircle2 className="size-4" />}
        tone="success"
        compact
      />
      <CrmStatCard
        title="Unpaid / Outstanding"
        value={unpaid}
        subtitle="Needs settlement"
        icon={<AlertCircle className="size-4" />}
        tone={unpaid > 0 ? "danger" : "neutral"}
        compact
      />
    </div>
  );
}
