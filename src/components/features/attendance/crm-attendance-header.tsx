"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CrmAttendanceHeader({
  branchName,
  timezone,
  businessDate,
  nowMs,
  refreshing,
  onRefresh,
}: {
  branchName: string;
  timezone: string;
  businessDate: string;
  nowMs: number;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const date = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(`${businessDate}T12:00:00Z`));
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(nowMs));

  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--cs-sand-dark)]">
          {branchName} · {time}
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--cs-text)]">Attendance</h1>
        <p className="mt-1 text-sm text-[var(--cs-text-muted)]">
          {date} · Staff operations and exceptions
        </p>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={onRefresh} disabled={refreshing}>
        <RefreshCw className={refreshing ? "animate-spin" : ""} />
        {refreshing ? "Refreshing" : "Refresh"}
      </Button>
    </header>
  );
}
