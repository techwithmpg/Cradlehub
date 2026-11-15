"use client";

import { useTransition } from "react";
import { Bell, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { sendScheduledClockInRemindersAction } from "@/app/(dashboard)/crm/attendance/actions";
import { Button } from "@/components/ui/button";
import type { CrmAttendanceView } from "@/lib/attendance/crm-navigation";

export function CrmAttendanceHeader({
  branchName,
  timezone,
  businessDate,
  nowMs,
  activeView,
  unscannedCount,
  refreshing,
  onRefresh,
}: {
  branchName: string;
  timezone: string;
  businessDate: string;
  nowMs: number;
  activeView: CrmAttendanceView;
  unscannedCount: number;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const [reminding, startReminding] = useTransition();

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

  const subtitle =
    activeView === "today"
      ? `Staff operations · ${date}`
      : activeView === "review"
        ? "Staff timekeeping, reviews, and attendance issues"
        : activeView === "history"
          ? "Attendance records, worked hours, and corrections history"
          : `${date} · Staff operations and configuration`;

  function handleSendReminder() {
    startReminding(async () => {
      const res = await sendScheduledClockInRemindersAction();
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
    });
  }

  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-[0.7rem] font-bold uppercase tracking-[0.16em] text-[var(--cs-sand-dark)]">
          {branchName} · {time}
        </p>
        <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-[var(--cs-text)] sm:text-[1.65rem]">
          Attendance
        </h1>
        <p className="mt-0.5 text-xs font-medium text-[var(--cs-text-muted)] sm:text-sm">
          {subtitle}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={refreshing}
          className="h-9 rounded-lg border-[var(--cs-border)] bg-white px-3.5 text-xs font-semibold text-[var(--cs-text)] hover:bg-[var(--cs-surface-warm)]"
        >
          <RefreshCw className={refreshing ? "mr-1.5 size-3.5 animate-spin" : "mr-1.5 size-3.5"} />
          {refreshing ? "Refreshing…" : "Refresh"}
        </Button>

        {activeView === "today" ? (
          <Button
            type="button"
            size="sm"
            disabled={reminding || unscannedCount <= 0}
            onClick={handleSendReminder}
            title={
              unscannedCount <= 0
                ? "All scheduled staff for today have already clocked in"
                : `Send clock-in reminder push notification (${unscannedCount})`
            }
            className="h-9 rounded-lg bg-[#1F4E33] px-3.5 text-xs font-semibold text-white shadow-xs hover:bg-[#163B26] disabled:opacity-55"
          >
            <Bell className="mr-1.5 size-3.5" />
            {reminding
              ? "Sending Reminder…"
              : unscannedCount > 0
                ? `Send Clock-In Reminder (${unscannedCount})`
                : "Send Clock-In Reminder"}
          </Button>
        ) : null}
      </div>
    </header>
  );
}
