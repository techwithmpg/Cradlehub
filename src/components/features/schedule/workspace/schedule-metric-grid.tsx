"use client";

import { CrmMetricGrid, type MetricItem } from "@/components/features/crm/today/crm-metric-grid";

export type ScheduleMetricItem = MetricItem;

export function ScheduleMetricGrid({ metrics }: { metrics: ScheduleMetricItem[] }) {
  return <CrmMetricGrid metrics={metrics} />;
}
