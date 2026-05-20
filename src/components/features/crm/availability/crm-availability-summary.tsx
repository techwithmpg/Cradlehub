"use client";

import { StatCard } from "@/components/features/dashboard/stat-card";
import type { CrmAvailabilitySummary } from "@/lib/queries/crm-availability";

type Props = {
  summary: CrmAvailabilitySummary;
};

export function CrmAvailabilitySummary({ summary }: Props) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
        gap: "0.625rem",
      }}
    >
      <StatCard
        label="Scheduled Today"
        value={summary.scheduledToday}
        sub={`of ${summary.total} total`}
        accent
        accentColor="var(--cs-sand)"
      />
      <StatCard
        label="Available Now"
        value={summary.availableNow}
        accentColor="var(--cs-success)"
      />
      <StatCard
        label="Busy Now"
        value={summary.busyNow}
        accentColor="var(--cs-info)"
      />
      <StatCard
        label="Off Today"
        value={summary.offToday}
        accentColor="var(--cs-text-muted)"
      />
      <StatCard
        label="No Schedule"
        value={summary.noSchedule}
        accentColor="var(--cs-warning)"
      />
      <StatCard
        label="Drivers Ready"
        value={summary.driversReady}
        sub={`of ${summary.driversTotal}`}
        accentColor="var(--cs-sand)"
      />
    </div>
  );
}
