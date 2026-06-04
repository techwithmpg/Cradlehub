"use client";

import { useMemo, useState } from "react";
import { DriverActiveJobCard } from "./driver-active-job-card";
import { DriverJobCard } from "./driver-job-card";
import { DriverJobsEmptyState } from "./driver-jobs-empty-state";
import { DriverJobsHeader } from "./driver-jobs-header";
import { DriverJobsSummaryRow } from "./driver-jobs-summary-row";
import { DriverJobsTabs, type DriverJobsTab } from "./driver-jobs-tabs";
import {
  buildDriverJobViewModels,
  getDriverJobsSummary,
  groupDriverJobsForDisplay,
  sortDriverJobsByTime,
  type DriverJobViewModel,
} from "./driver-jobs-view-model";
import type { RealDispatchItem } from "@/lib/queries/dispatch-queries";

type DriverJobsPageProps = {
  today: RealDispatchItem[];
  recent: RealDispatchItem[];
  detailsBasePath: string;
  tripsHref: string;
  todayISO: string;
  loadError?: boolean;
};

function SectionHeading({
  label,
  count,
}: {
  label: string;
  count?: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-lg font-black text-stone-500">{label}</h2>
      {typeof count === "number" ? (
        <span className="text-xs font-black text-stone-400">
          {count} {count === 1 ? "job" : "jobs"}
        </span>
      ) : null}
    </div>
  );
}

function uniqueJobs(jobs: DriverJobViewModel[]): DriverJobViewModel[] {
  const seen = new Set<string>();
  const unique: DriverJobViewModel[] = [];

  for (const job of jobs) {
    if (seen.has(job.id)) continue;
    seen.add(job.id);
    unique.push(job);
  }

  return unique;
}

export function DriverJobsPage({
  today,
  recent,
  detailsBasePath,
  tripsHref,
  todayISO,
  loadError = false,
}: DriverJobsPageProps) {
  const [tab, setTab] = useState<DriverJobsTab>("today");

  const todayJobs = useMemo(
    () => sortDriverJobsByTime(buildDriverJobViewModels({ items: today, detailsBasePath, todayISO })),
    [detailsBasePath, today, todayISO]
  );
  const recentJobs = useMemo(
    () => sortDriverJobsByTime(buildDriverJobViewModels({ items: recent, detailsBasePath, todayISO })),
    [detailsBasePath, recent, todayISO]
  );
  const allJobs = useMemo(
    () => sortDriverJobsByTime(uniqueJobs([...todayJobs, ...recentJobs])),
    [recentJobs, todayJobs]
  );

  const activeJob = todayJobs.find((job) => job.isActive) ?? null;
  const todayListJobs = todayJobs.filter((job) => job.id !== activeJob?.id);
  const allListJobs = allJobs.filter((job) => job.id !== activeJob?.id);
  const visibleJobs = tab === "today" ? todayJobs : allJobs;
  const summary = getDriverJobsSummary(visibleJobs);
  const groups = groupDriverJobsForDisplay(
    tab === "today"
      ? recentJobs.filter((job) => job.displayStatus === "completed")
      : allListJobs
  );
  const hasAnyJobs = allJobs.length > 0;

  return (
    <main className="min-h-dvh bg-[#fbf8f2] px-4 text-stone-950 md:bg-transparent md:px-6">
      <div className="mx-auto flex max-w-[480px] flex-col gap-7 pb-6 md:max-w-3xl">
        <DriverJobsHeader notificationCount={0} />
        <DriverJobsTabs activeTab={tab} todayCount={todayJobs.length} onTabChange={setTab} />
        <DriverJobsSummaryRow summary={summary} />

        {loadError ? (
          <DriverJobsEmptyState
            title="Could not load jobs"
            description="Please try again. Your assigned jobs will appear here once the connection is ready."
            tripsHref={tripsHref}
            showRefreshHint
          />
        ) : null}

        {!loadError && !hasAnyJobs ? (
          <DriverJobsEmptyState tripsHref={tripsHref} />
        ) : null}

        {!loadError && hasAnyJobs && tab === "today" ? (
          <div className="space-y-5">
            {activeJob ? (
              <DriverActiveJobCard job={activeJob} detailsHref={activeJob.detailsHref} />
            ) : null}

            {todayListJobs.length > 0 ? (
              <section className="space-y-4">
                {todayListJobs.map((job) => (
                  <DriverJobCard key={job.id} job={job} detailsHref={job.detailsHref} />
                ))}
              </section>
            ) : null}

            {groups
              .filter((group) => group.label !== "Today")
              .map((group) => (
                <section key={group.label} className="space-y-3">
                  <SectionHeading label={group.label} />
                  {group.jobs.map((job) => (
                    <DriverJobCard key={job.id} job={job} detailsHref={job.detailsHref} compact />
                  ))}
                </section>
              ))}
          </div>
        ) : null}

        {!loadError && hasAnyJobs && tab === "all" ? (
          <div className="space-y-5">
            {activeJob ? (
              <DriverActiveJobCard job={activeJob} detailsHref={activeJob.detailsHref} />
            ) : null}

            {groups.map((group) => (
              <section key={group.label} className="space-y-3">
                <SectionHeading label={group.label} count={group.jobs.length} />
                {group.jobs.map((job) => (
                  <DriverJobCard
                    key={job.id}
                    job={job}
                    detailsHref={job.detailsHref}
                    compact={!job.isToday}
                  />
                ))}
              </section>
            ))}
          </div>
        ) : null}
      </div>
    </main>
  );
}
