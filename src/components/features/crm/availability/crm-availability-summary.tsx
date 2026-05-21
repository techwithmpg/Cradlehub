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
        gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
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
        sub="Scheduled and free"
        accentColor="var(--cs-success)"
      />
      <StatCard
        label="Busy Now"
        value={summary.busyNow}
        sub="In session / assigned"
        accentColor="var(--cs-info)"
      />
      <StatCard
        label="Off Today"
        value={summary.offToday}
        sub="Not scheduled"
        accentColor="var(--cs-text-muted)"
      />
      <StatCard
        label="Drivers Ready"
        value={summary.driversReady}
        sub={`of ${summary.driversTotal} drivers`}
        accentColor="var(--cs-sand)"
      />
      {summary.needsAttention > 0 && (
        <StatCard
          label="Needs Attention"
          value={summary.needsAttention}
          sub="Action needed"
          accentColor="var(--cs-warning)"
        />
      )}
    </div>
  );
}
