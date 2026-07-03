"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FileText, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, Panel, StatusPill, formatAttendanceDate, formatAttendanceDateTime, formatMinutesCompact } from "@/components/features/attendance/attendance-ui";
import { AttendanceRecordReadout } from "@/components/features/attendance/records/attendance-record-readout";
import type {
  AttendanceRecord,
  AttendanceRecordFilters,
  AttendanceWorkspaceData,
} from "@/lib/attendance/types";
export function AttendanceRecordsTab({
  data,
  initialFilters,
}: {
  data: AttendanceWorkspaceData;
  initialFilters?: AttendanceRecordFilters;
}) {
  const initialStaffId = initialFilters?.staffId ?? null;
  const initialDate = initialFilters?.date ?? null;
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [staffId, setStaffId] = useState(initialStaffId ?? "all");
  const [selectedDate, setSelectedDate] = useState(initialDate ?? "all");
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);

  const dateOptions = useMemo(() => {
    const dates = new Set(data.records.map((record) => record.shift_date));
    if (initialDate) dates.add(initialDate);
    return Array.from(dates).sort((a, b) => b.localeCompare(a));
  }, [data.records, initialDate]);

  const rows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return data.records.filter((record) => {
      const matchesQuery = !normalizedQuery || record.staff_name.toLowerCase().includes(normalizedQuery);
      const matchesStatus = status === "all" || record.attendance_status === status || record.status === status;
      const matchesStaff = staffId === "all" || record.staff_id === staffId;
      const matchesDate = selectedDate === "all" || record.shift_date === selectedDate;
      return matchesQuery && matchesStatus && matchesStaff && matchesDate;
    });
  }, [data.records, query, selectedDate, staffId, status]);

  const highlightedRecordId = useMemo(() => {
    if (!initialStaffId) return null;
    return (
      data.records.find(
        (record) =>
          record.staff_id === initialStaffId &&
          (!initialDate || record.shift_date === initialDate)
      )?.id ?? null
    );
  }, [data.records, initialDate, initialStaffId]);

  return (
    <div className="grid gap-4">
      <Panel title="Attendance History">
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="h-8 rounded-lg border border-border bg-background px-3 text-sm font-semibold"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
          >
            <option value="all">All dates</option>
            {dateOptions.map((date) => (
              <option key={date} value={date}>
                {formatAttendanceDate(date)}
              </option>
            ))}
          </select>
          <select
            className="h-8 rounded-lg border border-border bg-background px-3 text-sm font-semibold"
            disabled
          >
            <option>{data.branchName}</option>
          </select>
          <select
            className="h-8 rounded-lg border border-border bg-background px-3 text-sm font-semibold"
            value={staffId}
            onChange={(event) => setStaffId(event.target.value)}
          >
            <option value="all">All staff</option>
            {data.staffOptions.map((staff) => (
              <option key={staff.id} value={staff.id}>
                {staff.full_name}
              </option>
            ))}
          </select>
          <select
            className="h-8 rounded-lg border border-border bg-background px-3 text-sm font-semibold"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="present">Present</option>
            <option value="late">Late</option>
            <option value="early_leave">Early departure</option>
            <option value="overtime">Overtime</option>
            <option value="checked_in">Checked in</option>
          </select>
          <label className="flex h-8 min-w-64 flex-1 items-center gap-2 rounded-lg border border-border bg-background px-3">
            <Search className="size-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search staff..."
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
          </label>
          <Button type="button" variant="outline">
            <FileText data-icon="inline-start" />
            Export
          </Button>
        </div>
      </Panel>

      <Panel title={`Records (${rows.length})`}>
        {rows.length === 0 ? (
          <EmptyState title="No attendance records found." detail="Try a different date, status, or staff search." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead>
                <tr className="border-b bg-stone-50 text-left text-xs text-muted-foreground">
                  {["Date", "Staff", "Scheduled Shift", "Clock In", "Clock Out", "Worked", "Late", "Early Leave", "Overtime", "Method", "Status", "Actions"].map((heading) => (
                    <th key={heading} className="px-3 py-2 font-semibold">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((record) => (
                  <tr
                    key={record.id}
                    className={`border-b last:border-b-0 ${
                      record.id === highlightedRecordId
                        ? "bg-amber-50 ring-1 ring-inset ring-amber-300"
                        : ""
                    }`}
                  >
                    <td className="px-3 py-3">{formatAttendanceDate(record.shift_date)}</td>
                    <td className="px-3 py-3 font-semibold">{record.staff_name}</td>
                    <td className="px-3 py-3 capitalize">{record.shift_type}</td>
                    <td className="px-3 py-3">{formatAttendanceDateTime(record.checked_in_at)}</td>
                    <td className="px-3 py-3">{formatAttendanceDateTime(record.checked_out_at)}</td>
                    <td className="px-3 py-3">{formatMinutesCompact(record.worked_minutes)}</td>
                    <td className="px-3 py-3">{formatMinutesCompact(record.late_minutes)}</td>
                    <td className="px-3 py-3">{formatMinutesCompact(record.early_leave_minutes)}</td>
                    <td className="px-3 py-3">{formatMinutesCompact(record.overtime_minutes)}</td>
                    <td className="px-3 py-3">{record.source_label ?? "QR/manual"}</td>
                    <td className="px-3 py-3"><StatusPill value={record.attendance_status} /></td>
                    <td className="px-3 py-3">
                      <Button type="button" variant="outline" size="sm" onClick={() => setSelectedRecord(record)}>
                        View Details
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Dialog open={selectedRecord !== null} onOpenChange={(open) => !open && setSelectedRecord(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Attendance Record Details</DialogTitle>
            <DialogDescription>Corrections preserve the original values and require a reason.</DialogDescription>
          </DialogHeader>
          {selectedRecord ? (
            <div className="grid gap-3 text-sm">
              <div>
                <p className="font-semibold">{selectedRecord.staff_name}</p>
                <Link
                  href={`/crm/staff?tab=management&staffId=${encodeURIComponent(selectedRecord.staff_id)}`}
                  className="text-xs font-semibold text-emerald-800 underline-offset-4 hover:underline"
                >
                  View staff profile
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <AttendanceRecordReadout label="Original clock in" value={formatAttendanceDateTime(selectedRecord.checked_in_at)} />
                <AttendanceRecordReadout label="Original clock out" value={formatAttendanceDateTime(selectedRecord.checked_out_at)} />
                <AttendanceRecordReadout label="Worked" value={formatMinutesCompact(selectedRecord.worked_minutes)} />
                <AttendanceRecordReadout label="Method" value={selectedRecord.source_label ?? "QR/manual"} />
              </div>
              <textarea className="min-h-24 rounded-lg border border-border bg-background p-3 outline-none" placeholder="Correction reason..." />
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSelectedRecord(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
