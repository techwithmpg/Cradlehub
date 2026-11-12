"use client";

import { useTransition } from "react";
import { BellRing } from "lucide-react";
import { toast } from "sonner";
import { sendScheduledClockInRemindersAction } from "@/app/(dashboard)/crm/attendance/actions";
import { AttendanceRecentActivity } from "@/components/features/attendance/today/attendance-recent-activity";
import { AttendanceStaffTable } from "@/components/features/attendance/today/attendance-staff-table";
import { AttendanceSummaryCards } from "@/components/features/attendance/today/attendance-summary-cards";
import type { AttendanceStaffDiagnostic } from "@/lib/attendance/staff-diagnostics";
import type { AttendanceWorkspaceData } from "@/lib/attendance/types";

function RemindUnscannedStaffBanner({ unscannedCount }: { unscannedCount: number }) {
  const [pending, startTransition] = useTransition();
  if (unscannedCount <= 0) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-950 shadow-2xs">
      <div className="flex items-center gap-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-200/80 text-amber-900">
          <BellRing className="size-4" />
        </span>
        <div>
          <p className="font-bold leading-tight">{unscannedCount} scheduled staff member{unscannedCount === 1 ? " has" : "s have"} not scanned in yet</p>
          <p className="text-xs text-amber-800">Send an instant push notification to their phone that opens the QR scanner directly.</p>
        </div>
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          startTransition(async () => {
            const res = await sendScheduledClockInRemindersAction();
            if (res.ok) toast.success(res.message);
            else toast.error(res.message);
          });
        }}
        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-800 px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-emerald-900 disabled:opacity-50"
      >
        <BellRing className="size-3.5" />
        {pending ? "Sending Push Alerts…" : `Send Clock-In Push Reminder (${unscannedCount})`}
      </button>
    </div>
  );
}

export function AttendanceTodayView({
  data,
  rows,
  onOpen,
  onOpenHistory,
  onOpenPhone,
}: {
  data: AttendanceWorkspaceData;
  rows: AttendanceStaffDiagnostic[];
  onOpen: (row: AttendanceStaffDiagnostic) => void;
  onOpenHistory: (row?: AttendanceStaffDiagnostic) => void;
  onOpenPhone: (row?: AttendanceStaffDiagnostic) => void;
}) {
  const activeServiceContexts = data.sessions.filter(
    (session) => session.booking_progress_status === "session_started"
  );
  return (
    <div className="grid gap-4">
      <RemindUnscannedStaffBanner unscannedCount={data.dailyStaffStates.filter((r) => !r.clockInAt && Boolean(r.scheduledStart && !r.clockOutAt)).length} />
      <AttendanceSummaryCards rows={rows} />
      <AttendanceStaffTable
        rows={rows}
        onOpen={onOpen}
        onOpenHistory={onOpenHistory}
        onOpenPhone={onOpenPhone}
      />
      {activeServiceContexts.length > 0 ? (
        <section
          className="rounded-xl border border-amber-200 bg-amber-50 p-4"
          aria-labelledby="service-context-heading"
        >
          <h2 id="service-context-heading" className="text-sm font-bold text-amber-950">
            Active service context
          </h2>
          <p className="mt-1 text-xs text-amber-800">
            These sessions stay visible for review but do not block a valid QR clock-out.
          </p>
          <div className="mt-3 divide-y divide-amber-200">
            {activeServiceContexts.map((session) => (
              <div
                key={session.id}
                className="flex items-center justify-between gap-4 py-2 text-sm"
              >
                <div>
                  <span className="font-semibold text-amber-950">{session.staff_name}</span>
                  <span className="text-amber-800"> · {session.service_name}</span>
                </div>
                <span className="text-xs text-amber-800">{session.customer_name}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
      <AttendanceRecentActivity data={data} onViewHistory={() => onOpenHistory()} />
    </div>
  );
}





