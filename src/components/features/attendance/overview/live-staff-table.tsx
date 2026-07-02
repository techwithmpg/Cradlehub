import { Panel, StaffAvatar, StatusPill, formatAttendanceDateTime, humanizeAttendanceValue } from "@/components/features/attendance/attendance-ui";
import type { AttendanceWorkspaceData } from "@/lib/attendance/types";

function getAttendanceState(record: AttendanceWorkspaceData["records"][number] | undefined): string {
  if (!record) return "not_arrived";
  if (record.checked_out_at) return "clocked_out";
  if (record.attendance_status) return record.attendance_status;
  return record.status;
}

export function LiveStaffTable({ data }: { data: AttendanceWorkspaceData }) {
  const activeSessionByStaff = new Map(
    data.sessions
      .filter((session) => session.booking_progress_status === "session_started")
      .map((session) => [session.staff_name, session])
  );

  const rows = data.staffOptions.slice(0, 12).map((staff) => {
    const record = data.records.find((item) => item.staff_id === staff.id);
    const session = activeSessionByStaff.get(staff.full_name);
    return {
      staff,
      record,
      session,
      state: getAttendanceState(record),
    };
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
              <th className="px-3 py-2 font-semibold">Staff</th>
              <th className="px-3 py-2 font-semibold">Role</th>
              <th className="px-3 py-2 font-semibold">Scheduled Shift</th>
              <th className="px-3 py-2 font-semibold">Clock In</th>
              <th className="px-3 py-2 font-semibold">Attendance</th>
              <th className="px-3 py-2 font-semibold">Current Task</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ staff, record, session, state }) => (
              <tr key={staff.id} className="border-b last:border-b-0">
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    <StaffAvatar name={staff.full_name} />
                    <span className="font-semibold">{staff.full_name}</span>
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
