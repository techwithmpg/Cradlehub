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
        label="Scheduled"
        value={summary.scheduledToday}
        sub={`of ${summary.total} staff`}
        accentColor="var(--cs-sand)"
      />
      <StatCard
        label="Checked In"
        value={summary.checkedIn}
        sub="physically present"
        accentColor="var(--cs-success)"
      />
      <StatCard
        label="Available"
        value={summary.availableNow}
        sub="checked in + free"
        accentColor="var(--cs-success)"
      />
      <StatCard
        label="Busy"
        value={summary.busyNow}
        sub="in session"
        accentColor="var(--cs-info)"
      />
      {summary.notCheckedIn > 0 && (
        <StatCard
          label="Not Checked In"
          value={summary.notCheckedIn}
          sub="scheduled, absent?"
          accentColor="var(--cs-warning)"
        />
      )}
      <StatCard
        label="Drivers Ready"
        value={`${summary.driversReady}/${summary.driversTotal}`}
        sub="checked in + free"
        accentColor={summary.driversReady > 0 ? "var(--cs-info)" : "var(--cs-text-muted)"}
      />
      {summary.needsAttention > 0 && (
        <StatCard
          label="Needs Attention"
          value={summary.needsAttention}
          sub="no schedule set"
          accentColor="var(--cs-warning)"
        />
      )}
    </div>
  );
}
