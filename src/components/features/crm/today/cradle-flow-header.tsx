"use client";

import { useEffect, useState, useTransition } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

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
  onRefresh,
  onReviewWarnings,
}: {
  branchName: string;
  fallbackDateLabel: string;
  warningCount: number;
  onRefresh: () => void;
  onReviewWarnings: () => void;
}) {
  const [nowLabel, setNowLabel] = useState(fallbackDateLabel);
  const [isRefreshing, startRefresh] = useTransition();

  useEffect(() => {
    const update = () => setNowLabel(formatManilaNow(new Date()));
    update();
    const timer = window.setInterval(update, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div>
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--cs-success-text)]">
          <span className="size-2 rounded-full bg-[var(--cs-success)] shadow-[0_0_0_4px_var(--cs-success-bg)]" />
          Live · {branchName}
        </div>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-[var(--cs-text)] sm:text-[1.75rem]">
          CRADLE FLOW
        </h1>
        <p className="mt-1 text-sm font-medium text-[var(--cs-text-secondary)]">
          Front Desk Command Center
        </p>
        <p className="mt-1 text-xs text-[var(--cs-text-muted)]">
          Booking → Waiting → In Service → Ready to Pay → Completed
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-lg border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] px-3 py-2 text-xs font-semibold text-[var(--cs-text-secondary)]">
          {nowLabel} · Manila
        </span>
        <button
          type="button"
          onClick={onReviewWarnings}
          className={cn(
            "inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-bold",
            warningCount > 0
              ? "border-amber-200 bg-amber-50 text-amber-900"
              : "border-[var(--cs-border)] bg-[var(--cs-surface)] text-[var(--cs-text-secondary)]"
          )}
        >
          <AlertTriangle className="size-3.5" />
          {warningCount > 0 ? `${warningCount} warning${warningCount === 1 ? "" : "s"}` : "Ready"}
        </button>
        <button
          type="button"
          onClick={() => startRefresh(onRefresh)}
          disabled={isRefreshing}
          className="inline-flex size-9 items-center justify-center rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] text-[var(--cs-text-secondary)] hover:bg-[var(--cs-surface-warm)] disabled:opacity-60"
          aria-label="Refresh Cradle Flow"
          title="Refresh"
        >
          <RefreshCw className={cn("size-4", isRefreshing && "animate-spin")} />
        </button>
      </div>
    </header>
  );
}
