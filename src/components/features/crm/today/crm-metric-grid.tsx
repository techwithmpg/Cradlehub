"use client";

import { CrmMetricCard } from "./crm-metric-card";

export type MetricItem = {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  color?: string;
  icon?: React.ReactNode;
  trend?: string;
  href?: string;
  onClick?: () => void;
};

export function CrmMetricGrid({ metrics }: { metrics: MetricItem[] }) {
  return (
    <div
      style={{
        display: "grid",
        gap: "0.75rem",
        marginBottom: "1.5rem",
      }}
      className="grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
    >
      {metrics.map((m) => (
        <CrmMetricCard
          key={m.label}
          label={m.label}
          value={m.value}
          prefix={m.prefix}
          suffix={m.suffix}
          color={m.color}
          icon={m.icon}
          trend={m.trend}
          href={m.href}
          onClick={m.onClick}
        />
      ))}
    </div>
  );
}
