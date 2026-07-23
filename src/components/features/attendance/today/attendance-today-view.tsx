import { AttendanceRecentActivity } from "@/components/features/attendance/today/attendance-recent-activity";
import { AttendanceStaffTable } from "@/components/features/attendance/today/attendance-staff-table";
import { AttendanceSummaryCards } from "@/components/features/attendance/today/attendance-summary-cards";
import type { AttendanceStaffDiagnostic } from "@/lib/attendance/staff-diagnostics";
import type { AttendanceWorkspaceData } from "@/lib/attendance/types";

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
  const serviceBlockers = data.settings.active_service_blocks_clock_out
    ? data.sessions.filter((session) => session.booking_progress_status === "session_started")
    : [];
  return (
    <div className="grid gap-4">
      <AttendanceSummaryCards rows={rows} />
      <AttendanceStaffTable
        rows={rows}
        onOpen={onOpen}
        onOpenHistory={onOpenHistory}
        onOpenPhone={onOpenPhone}
      />
      {serviceBlockers.length > 0 ? (
        <section
          className="rounded-xl border border-amber-200 bg-amber-50 p-4"
          aria-labelledby="service-blockers-heading"
        >
          <h2 id="service-blockers-heading" className="text-sm font-bold text-amber-950">
            Service activity affecting clock-out
          </h2>
          <p className="mt-1 text-xs text-amber-800">
            These active sessions must finish before the assigned staff can clock out.
          </p>
          <div className="mt-3 divide-y divide-amber-200">
            {serviceBlockers.map((session) => (
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
