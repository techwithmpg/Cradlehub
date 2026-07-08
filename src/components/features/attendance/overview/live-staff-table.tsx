import { Panel, StaffAvatar, StatusPill, formatAttendanceDateTime, formatMinutesCompact, humanizeAttendanceValue } from "@/components/features/attendance/attendance-ui";
import type { AttendanceRecord, AttendanceSession, AttendanceWorkspaceData } from "@/lib/attendance/types";

function workedMinutesSince(checkedInAt: string): number {
  return Math.max(0, Math.round((Date.now() - new Date(checkedInAt).getTime()) / 60000));
}

function activeSessionForStaff(sessions: AttendanceSession[], staffId: string): AttendanceSession | undefined {
  return sessions.find((session) => session.booking_progress_status === "session_started" && session.staff_id === staffId);
}

function attendanceAvailabilityState(record: AttendanceRecord | undefined, activeService?: AttendanceSession): string {
  if (!record) return "not_arrived";
  if (record.status === "checked_out" || record.checked_out_at) return "clocked_out";
  if (activeService) return "in_service";
  if (record.status === "checked_in") return "available";
  return "not_arrived";
}

export function LiveStaffTable({ data }: { data: AttendanceWorkspaceData }) {
  const checkedInRecords = data.records
    .filter((record) => record.status === "checked_in" && !record.checked_out_at)
    .sort((a, b) => new Date(a.checked_in_at).getTime() - new Date(b.checked_in_at).getTime());

  const checkedInByStaffId = new Map(checkedInRecords.map((record) => [record.staff_id, record]));

  const rows = data.staffOptions
    .slice(0, 24)
    .map((staff) => {
      const record = checkedInByStaffId.get(staff.id) ?? data.records.find((item) => item.staff_id === staff.id);
      const session = activeSessionForStaff(data.sessions, staff.id);
      const queuePosition = record?.status === "checked_in" && !record.checked_out_at
        ? checkedInRecords.findIndex((r) => r.staff_id === staff.id) + 1
        : null;
      return {
        staff,
        record,
        session,
        queuePosition,
        state: attendanceAvailabilityState(record, session),
      };
    })
    .sort((a, b) => {
      const aCheckedIn = a.record?.status === "checked_in" && !a.record.checked_out_at ? 1 : 0;
      const bCheckedIn = b.record?.status === "checked_in" && !b.record.checked_out_at ? 1 : 0;
      if (aCheckedIn !== bCheckedIn) return bCheckedIn - aCheckedIn;
      if (a.record && b.record) {
        return new Date(a.record.checked_in_at).getTime() - new Date(b.record.checked_in_at).getTime();
      }
      return a.staff.full_name.localeCompare(b.staff.full_name);
    });

  return (
    <Panel
      title={`Live Staff Status (${rows.length})`}
      action={<span className="text-xs font-semibold text-emerald-800">Today</span>}
      className="min-w-0"
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b bg-stone-50 text-left text-xs text-muted-foreground">
              <th className="px-3 py-2 font-semibold">Queue</th>
              <th className="px-3 py-2 font-semibold">Staff</th>
              <th className="px-3 py-2 font-semibold">Role</th>
              <th className="px-3 py-2 font-semibold">Shift</th>
              <th className="px-3 py-2 font-semibold">Clock In</th>
              <th className="px-3 py-2 font-semibold">Worked</th>
              <th className="px-3 py-2 font-semibold">Availability</th>
              <th className="px-3 py-2 font-semibold">Current Task</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ staff, record, session, queuePosition, state }) => (
              <tr key={staff.id} className="border-b last:border-b-0">
                <td className="px-3 py-3">
                  {queuePosition ? <span className="font-semibold">#{queuePosition}</span> : <span className="text-muted-foreground">-</span>}
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    <StaffAvatar name={staff.full_name} />
                    <span className="font-semibold">{record?.staff_nickname ?? staff.full_name}</span>
                  </div>
                </td>
                <td className="px-3 py-3 capitalize text-muted-foreground">
                  {humanizeAttendanceValue(staff.staff_type ?? "staff")}
                </td>
                <td className="px-3 py-3 text-muted-foreground">
                  {record ? `${record.shift_type} shift` : "Scheduled today"}
                </td>
                <td className="px-3 py-3">{formatAttendanceDateTime(record?.checked_in_at)}</td>
                <td className="px-3 py-3">
                  {record?.checked_in_at ? formatMinutesCompact(workedMinutesSince(record.checked_in_at)) : "-"}
                </td>
                <td className="px-3 py-3">
                  <StatusPill value={state} />
                </td>
                <td className="px-3 py-3">
                  {session ? (
                    <span>
                      <strong>{session.resource_name ?? "Room"}</strong>
                      <span className="text-muted-foreground"> · {session.service_name}</span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
