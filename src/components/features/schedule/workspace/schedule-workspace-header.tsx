"use client";

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { OpenAdministrativeBookingButton } from "@/components/features/bookings/administrative-booking-modal-provider";
import { CrmPageHeader } from "@/components/features/crm/shared/crm-page-header";
import { addDaysToYmd, BRANCH_TIMEZONE, formatBranchYmd, getBranchTime } from "@/lib/engine/slot-time";
import { isToday as isScheduleToday } from "@/lib/utils/schedule-timeline";

export function ScheduleWorkspaceHeader({
  branchName,
  date,
  initialNow,
  onDateChange,
}: {
  branchName: string;
  date: string;
  initialNow: string;
  onDateChange: (date: string) => void;
}) {
  const now = new Date(initialNow);
  const dateLabel = formatBranchYmd(date, {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: BRANCH_TIMEZONE,
  });
  const isToday = isScheduleToday(date, now);

  function shiftDate(days: number) {
    onDateChange(addDaysToYmd(date, days));
  }

  return (
    <CrmPageHeader
      eyebrow={branchName}
      title="Schedule"
      description="Manage staff availability, bookings, and resources for today."
      className="mb-5"
      actions={
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap">
          <div className="inline-flex min-w-0 flex-1 items-center justify-between gap-1 rounded-lg border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] px-2.5 py-1.5 sm:flex-none">
            <button
              type="button"
              onClick={() => shiftDate(-1)}
              aria-label="Previous day"
              className="inline-flex size-6 items-center justify-center rounded-md text-[var(--cs-text-muted)] transition hover:bg-[#F5F2EE] hover:text-[var(--cs-text)]"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="inline-flex min-w-0 items-center justify-center gap-1.5 text-[13px] font-semibold text-[var(--cs-text)]">
              <CalendarDays size={14} className="shrink-0 text-[#A67B5B]" />
              <span className="truncate">{dateLabel}</span>
            </span>
            <button
              type="button"
              onClick={() => shiftDate(1)}
              aria-label="Next day"
              className="inline-flex size-6 items-center justify-center rounded-md text-[var(--cs-text-muted)] transition hover:bg-[#F5F2EE] hover:text-[var(--cs-text)]"
            >
              <ChevronRight size={14} />
            </button>
          </div>

          {!isToday && (
            <button
              type="button"
              onClick={() => onDateChange(getBranchTime(now, BRANCH_TIMEZONE).ymd)}
              className="rounded-lg border border-[var(--cs-border-soft)] bg-white px-3 py-2 text-xs font-semibold text-[var(--cs-text-secondary)] transition hover:bg-[#F5F2EE]"
            >
              Today
            </button>
          )}

          <OpenAdministrativeBookingButton
            mode="standard_future"
            date={date}
            label="+ New Booking"
            showIcon={false}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#1F4E33] px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-[#163B26]"
          />
        </div>
      }
    />
  );
}
