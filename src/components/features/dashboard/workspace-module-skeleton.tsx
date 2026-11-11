"use client";

import type { WorkspaceRuntimeModuleId } from "./workspace-domain-events";

function PulseBlock({ className }: { className: string }) {
  return (
    <div
      className={`animate-pulse rounded-xl bg-stone-200/75 dark:bg-stone-800/60 ${className}`}
    />
  );
}

/**
 * Architectural, layout-accurate skeleton shown ONLY when navigating to an
 * uncached module for the very first time. Never shown once the module is retained.
 */
export function WorkspaceModuleFirstLoadSkeleton({
  moduleId,
}: {
  moduleId?: WorkspaceRuntimeModuleId | string | null;
}) {
  const isSchedule = moduleId?.includes("schedule");
  const isCashFlow = moduleId?.includes("cash-flow");
  const isWorkQueue = moduleId?.includes("work-queue");

  return (
    <div
      role="status"
      aria-label="Loading workspace module"
      className="mx-auto w-full max-w-[1600px] space-y-5 px-1 py-2 animate-in fade-in duration-150"
    >
      {/* Header & Action Bar Skeleton */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--cs-border-soft)] pb-4">
        <div className="space-y-2">
          <PulseBlock className="h-7 w-48 rounded-lg" />
          <PulseBlock className="h-4 w-72 rounded-md opacity-70" />
        </div>
        <div className="flex items-center gap-2.5">
          <PulseBlock className="h-9 w-32 rounded-lg" />
          <PulseBlock className="h-9 w-28 rounded-lg" />
        </div>
      </div>

      {/* Sub-navigation Tabs / KPI Strip */}
      {isCashFlow ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <PulseBlock className="h-24 rounded-2xl" />
          <PulseBlock className="h-24 rounded-2xl" />
          <PulseBlock className="h-24 rounded-2xl" />
          <PulseBlock className="h-24 rounded-2xl" />
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <PulseBlock className="h-9 w-24 rounded-full" />
            <PulseBlock className="h-9 w-28 rounded-full opacity-75" />
            <PulseBlock className="h-9 w-24 rounded-full opacity-60" />
            <PulseBlock className="h-9 w-24 rounded-full opacity-50" />
          </div>
          <div className="flex items-center gap-2">
            <PulseBlock className="h-9 w-52 rounded-lg" />
            <PulseBlock className="h-9 w-28 rounded-lg" />
          </div>
        </div>
      )}

      {/* Main Content Geometry */}
      {isSchedule ? (
        /* Timeline Grid Skeleton for Schedule */
        <div className="rounded-2xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] p-4 shadow-xs space-y-3">
          <div className="grid grid-cols-6 gap-3 border-b border-[var(--cs-border-soft)] pb-3">
            <PulseBlock className="h-6 w-28" />
            <PulseBlock className="h-6 w-full" />
            <PulseBlock className="h-6 w-full" />
            <PulseBlock className="h-6 w-full" />
            <PulseBlock className="h-6 w-full" />
            <PulseBlock className="h-6 w-full" />
          </div>
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="grid grid-cols-6 items-center gap-3 py-2">
              <div className="flex items-center gap-2.5">
                <PulseBlock className="size-9 shrink-0 rounded-full" />
                <div className="space-y-1.5 flex-1">
                  <PulseBlock className="h-4 w-24 rounded-md" />
                  <PulseBlock className="h-3 w-16 rounded-md opacity-60" />
                </div>
              </div>
              <PulseBlock className="col-span-2 h-14 rounded-xl" />
              <PulseBlock className="col-span-1 h-14 rounded-xl opacity-50" />
              <PulseBlock className="col-span-2 h-14 rounded-xl opacity-80" />
            </div>
          ))}
        </div>
      ) : isWorkQueue ? (
        /* Split Main + Right Operational Rail Skeleton for Today */
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
          <div className="xl:col-span-8 space-y-3 rounded-2xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] p-4">
            <div className="flex items-center justify-between pb-2">
              <PulseBlock className="h-5 w-36 rounded-md" />
              <PulseBlock className="h-8 w-44 rounded-lg" />
            </div>
            {Array.from({ length: 5 }).map((_, idx) => (
              <PulseBlock key={idx} className="h-16 w-full rounded-xl" />
            ))}
          </div>
          <div className="xl:col-span-4 space-y-4">
            <div className="rounded-2xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] p-4 space-y-3">
              <PulseBlock className="h-5 w-40 rounded-md" />
              <PulseBlock className="h-16 w-full rounded-xl" />
              <PulseBlock className="h-16 w-full rounded-xl" />
            </div>
            <div className="rounded-2xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] p-4 space-y-3">
              <PulseBlock className="h-5 w-36 rounded-md" />
              <PulseBlock className="h-14 w-full rounded-xl" />
              <PulseBlock className="h-14 w-full rounded-xl" />
            </div>
          </div>
        </div>
      ) : (
        /* Clean Operational Table Skeleton for Bookings, Attendance, Customers, Cash Flow */
        <div className="rounded-2xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] p-4 shadow-xs space-y-3">
          <div className="grid grid-cols-6 gap-4 border-b border-[var(--cs-border-soft)] pb-3">
            <PulseBlock className="h-4 w-20 rounded-md" />
            <PulseBlock className="h-4 w-32 rounded-md" />
            <PulseBlock className="h-4 w-28 rounded-md" />
            <PulseBlock className="h-4 w-24 rounded-md" />
            <PulseBlock className="h-4 w-20 rounded-md" />
            <PulseBlock className="h-4 w-20 rounded-md justify-self-end" />
          </div>
          {Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={idx}
              className="grid grid-cols-6 items-center gap-4 border-b border-[var(--cs-border-soft)]/50 py-3 last:border-0"
            >
              <PulseBlock className="h-4 w-16 rounded-md" />
              <div className="space-y-1.5">
                <PulseBlock className="h-4 w-36 rounded-md" />
                <PulseBlock className="h-3 w-24 rounded-md opacity-60" />
              </div>
              <PulseBlock className="h-4 w-28 rounded-md" />
              <PulseBlock className="h-4 w-24 rounded-md" />
              <PulseBlock className="h-6 w-24 rounded-full" />
              <PulseBlock className="h-8 w-20 rounded-lg justify-self-end" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
