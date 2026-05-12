"use client";

import { StatCard } from "@/components/features/dashboard/stat-card";

type Props = {
  activeToday: number;
  inProgress: number;
  completed: number;
  unpaid: number;
};

export function TodayKpiRow({ activeToday, inProgress, completed, unpaid }: Props) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
        gap: "0.625rem",
        marginBottom: "1.5rem",
      }}
    >
      <StatCard
        label="Active Today"
        value={activeToday}
        accent
        accentColor="var(--cs-sand)"
      />
      <StatCard
        label="In Progress"
        value={inProgress}
        accentColor="var(--cs-info)"
      />
      <StatCard
        label="Completed"
        value={completed}
        accentColor="var(--cs-success)"
      />
      <StatCard
        label="Unpaid / Outstanding"
        value={unpaid}
        accentColor="var(--cs-error)"
      />
    </div>
  );
}
