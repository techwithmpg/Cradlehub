"use client";

import { useEffect, useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, RefreshCw, UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FrontDeskDutyContext } from "@/lib/queries/front-desk-duty";

function formatManilaNow(date: Date): string {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function CradleFlowHeader({
  branchName,
  fallbackDateLabel,
  warningCount,
  duty,
  onRefresh,
  onReviewWarnings,
  isRefreshing: isRefreshingProp,
}: {
  branchName: string;
  fallbackDateLabel: string;
  warningCount: number;
  duty?: FrontDeskDutyContext | null;
  onRefresh: () => void | Promise<void>;
  onReviewWarnings: () => void;
  isRefreshing?: boolean;
}) {
  const [nowLabel, setNowLabel] = useState(fallbackDateLabel);
  const [isTransitioning, startRefresh] = useTransition();
  const isRefreshing = isRefreshingProp ?? isTransitioning;

  useEffect(() => {
    const update = () => setNowLabel(formatManilaNow(new Date()));
    update();
    const timer = window.setInterval(update, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <header className="flex flex-col gap-2.5 md:flex-row md:items-center md:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--cs-success-text)]">
            <span className="size-2 rounded-full bg-[var(--cs-success)] shadow-[0_0_0_4px_var(--cs-success-bg)]" />
            Live · {branchName}
          </div>
          {duty ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#CFE5D6] bg-[#EEF7F1] px-2.5 py-0.5 text-[11px] font-bold text-[#1F4E33]">
              <UserCheck className="size-3" />
              Welcome, {duty.name}
              {duty.shiftLabel ? ` · ${duty.shiftLabel}` : ""}
            </span>
          ) : null}
        </div>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="text-xl font-bold tracking-tight text-[var(--cs-text)] sm:text-2xl">
            CRADLE INTAKE
          </h1>
          <p className="text-xs font-medium text-[var(--cs-text-secondary)]">
            Front Desk Intake & Walk-In Command Center ·{" "}
            <span className="text-[var(--cs-text-muted)]">
              Booking → Waiting → In Service → Ready to Pay → Completed
            </span>
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-lg border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--cs-text-secondary)]">
          {nowLabel} · Manila
        </span>
        <button
          type="button"
          onClick={onReviewWarnings}
          className={cn(
            "inline-flex h-8 items-center gap-2 rounded-lg border px-3 text-xs font-bold",
            warningCount > 0
              ? "border-amber-200 bg-amber-50 text-amber-900"
              : "border-[var(--cs-border)] bg-[var(--cs-surface)] text-[var(--cs-text-secondary)]"
          )}
        >
          {warningCount > 0 ? (
            <AlertTriangle className="size-3.5" />
          ) : (
            <CheckCircle2 className="size-3.5" />
          )}
          {warningCount > 0 ? `${warningCount} warning${warningCount === 1 ? "" : "s"}` : "Ready"}
        </button>
        <button
          type="button"
          onClick={() => startRefresh(onRefresh)}
          disabled={isRefreshing}
          className="inline-flex size-8 items-center justify-center rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] text-[var(--cs-text-secondary)] hover:bg-[var(--cs-surface-warm)] disabled:opacity-60"
          aria-label="Refresh Cradle Intake"
          title="Refresh"
        >
          <RefreshCw className={cn("size-3.5", isRefreshing && "animate-spin")} />
        </button>
      </div>
    </header>
  );
}
