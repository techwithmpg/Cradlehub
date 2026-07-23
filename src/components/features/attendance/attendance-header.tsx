import { Building2, CalendarDays, Radio, RefreshCw, ShieldCheck, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContextChip } from "@/components/features/attendance/attendance-ui";
import type { AttendanceTab } from "@/lib/attendance/types";
import { cn } from "@/lib/utils";

export function AttendanceHeader({
  branchName,
  timezone,
  nowMs,
  reviewCount,
  refreshing,
  onRefresh,
  onTabChange,
}: {
  branchName: string;
  timezone: string;
  nowMs: number;
  reviewCount: number;
  refreshing: boolean;
  onRefresh: () => void;
  onTabChange: (tab: AttendanceTab) => void;
}) {
  const today = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(nowMs));

  return (
    <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="m-0 text-2xl font-bold tracking-tight text-[var(--cs-text)]">
            Attendance
          </h1>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--cs-success)]/20 bg-[var(--cs-success-bg)] px-2.5 py-1 text-[11px] font-bold text-[var(--cs-success-text)]">
            <Radio className="size-3 animate-pulse" aria-hidden="true" />
            Live
          </span>
        </div>
        <p className="mt-1 max-w-2xl text-sm text-[var(--cs-text-secondary)]">
          Monitor today&apos;s attendance, resolve exceptions, and manage attendance tools from one
          workspace.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
        <ContextChip
          ariaLabel={`Attendance branch: ${branchName}`}
          icon={<Building2 className="size-4" />}
          className="max-w-[240px]"
        >
          {branchName}
        </ContextChip>
        <ContextChip
          ariaLabel={`Attendance date: ${today}`}
          icon={<CalendarDays className="size-4" />}
        >
          {today}
        </ContextChip>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Refresh attendance"
          title="Refresh attendance"
          disabled={refreshing}
          onClick={onRefresh}
          className="border-[var(--cs-border)] bg-[var(--cs-surface)]"
        >
          <RefreshCw className={cn("size-4", refreshing && "animate-spin")} />
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => onTabChange("exceptions")}
          className="border-[var(--cs-border)] bg-[var(--cs-surface)]"
        >
          <Wrench data-icon="inline-start" />
          Review Queue
          {reviewCount > 0 ? (
            <span className="ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-[var(--cs-error-bg)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--cs-error-text)]">
              {reviewCount > 99 ? "99+" : reviewCount}
            </span>
          ) : null}
        </Button>
        <Button
          type="button"
          onClick={() => onTabChange("devices")}
          className="bg-[var(--cs-crm-accent)] text-white hover:bg-[var(--cs-crm-text)]"
        >
          <ShieldCheck data-icon="inline-start" />
          Activate Phone
        </Button>
      </div>
    </header>
  );
}
