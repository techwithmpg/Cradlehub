"use client";

import { useMemo, useState } from "react";
import { FileText, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, Panel, StatusPill, formatAttendanceDate, formatAttendanceDateTime, formatMinutesCompact } from "@/components/features/attendance/attendance-ui";
import type { AttendanceRecord, AttendanceWorkspaceData } from "@/lib/attendance/types";

export function AttendanceRecordsTab({ data }: { data: AttendanceWorkspaceData }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);

  const rows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return data.records.filter((record) => {
      const matchesQuery = !normalizedQuery || record.staff_name.toLowerCase().includes(normalizedQuery);
      const matchesStatus = status === "all" || record.attendance_status === status || record.status === status;
      return matchesQuery && matchesStatus;
    });
  }, [data.records, query, status]);

  return (
    <div className="grid gap-4">
      <Panel title="Attendance History">
        <div className="flex flex-wrap items-center gap-2">
          <select className="h-8 rounded-lg border border-border bg-background px-3 text-sm font-semibold">
            <option>Today</option>
            <option>This week</option>
            <option>This month</option>
            <option>Custom</option>
          </select>
          <select className="h-8 rounded-lg border border-border bg-background px-3 text-sm font-semibold">
            <option>{data.branchName}</option>
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
                  <tr key={record.id} className="border-b last:border-b-0">
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
              <div className="grid grid-cols-2 gap-3">
                <Readout label="Original clock in" value={formatAttendanceDateTime(selectedRecord.checked_in_at)} />
                <Readout label="Original clock out" value={formatAttendanceDateTime(selectedRecord.checked_out_at)} />
                <Readout label="Worked" value={formatMinutesCompact(selectedRecord.worked_minutes)} />
                <Readout label="Method" value={selectedRecord.source_label ?? "QR/manual"} />
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

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="text-xs font-semibold text-muted-foreground">{label}</div>
      <div className="mt-1 font-semibold">{value}</div>
    </div>
  );
}
