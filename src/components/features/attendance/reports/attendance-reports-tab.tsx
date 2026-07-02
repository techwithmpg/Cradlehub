"use client";

import { useMemo, useState } from "react";
import { FileDown, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel, StatusPill, formatMinutesCompact } from "@/components/features/attendance/attendance-ui";
import type { AttendanceWorkspaceData } from "@/lib/attendance/types";

const REPORTS = [
  "Attendance Summary",
  "Worked Hours",
  "Late Arrivals",
  "Early Departures",
  "Overtime",
  "Missing Attendance",
  "Staff Attendance History",
  "Service Durations",
  "Room Utilization",
  "Manual Corrections",
  "Scan Security",
  "Device Status",
];

export function AttendanceReportsTab({ data }: { data: AttendanceWorkspaceData }) {
  const [selectedReport, setSelectedReport] = useState(REPORTS[0] ?? "Attendance Summary");
  const totals = useMemo(() => {
    return data.records.reduce(
      (acc, record) => ({
        worked: acc.worked + record.worked_minutes,
        late: acc.late + record.late_minutes,
        early: acc.early + record.early_leave_minutes,
        overtime: acc.overtime + record.overtime_minutes,
      }),
      { worked: 0, late: 0, early: 0, overtime: 0 }
    );
  }, [data.records]);

  return (
    <div className="grid gap-4">
      <Panel title="Report Filters">
        <div className="flex flex-wrap items-center gap-2">
          <select className="h-8 rounded-lg border border-border bg-background px-3 text-sm font-semibold"><option>Today</option></select>
          <select className="h-8 rounded-lg border border-border bg-background px-3 text-sm font-semibold"><option>{data.branchName}</option></select>
          <select className="h-8 rounded-lg border border-border bg-background px-3 text-sm font-semibold"><option>All staff types</option></select>
          <select className="h-8 rounded-lg border border-border bg-background px-3 text-sm font-semibold"><option>All staff</option></select>
          <Button type="button" variant="outline"><FileDown data-icon="inline-start" />Export</Button>
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
        <Panel title="Reports">
          <div className="grid gap-1">
            {REPORTS.map((report) => (
              <button
                key={report}
                type="button"
                onClick={() => setSelectedReport(report)}
                className={`rounded-lg px-3 py-2 text-left text-sm font-semibold ${selectedReport === report ? "bg-emerald-900 text-white" : "hover:bg-muted"}`}
              >
                {report}
              </button>
            ))}
          </div>
        </Panel>

        <Panel
          title={selectedReport}
          action={
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm"><FileDown data-icon="inline-start" />CSV</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => window.print()}><Printer data-icon="inline-start" />Print</Button>
            </div>
          }
        >
          <div className="mb-3 flex flex-wrap gap-2 text-sm">
            <StatusPill value={`${data.records.length} records`} tone="neutral" />
            <StatusPill value={`${data.sessions.length} sessions`} tone="neutral" />
            <StatusPill value={`${data.exceptions.filter((item) => item.status === "open").length} open exceptions`} tone="warn" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b bg-stone-50 text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-semibold">Metric</th>
                  <th className="px-3 py-2 font-semibold">Value</th>
                  <th className="px-3 py-2 font-semibold">Notes</th>
                </tr>
              </thead>
              <tbody>
                <ReportRow label="Worked Hours" value={formatMinutesCompact(totals.worked)} note="Sum of recorded worked minutes." />
                <ReportRow label="Late Arrivals" value={formatMinutesCompact(totals.late)} note="Late minutes from attendance records." />
                <ReportRow label="Early Departures" value={formatMinutesCompact(totals.early)} note="Early leave minutes from attendance records." />
                <ReportRow label="Overtime" value={formatMinutesCompact(totals.overtime)} note="Overtime minutes from attendance records." />
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function ReportRow({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <tr className="border-b last:border-b-0">
      <td className="px-3 py-3 font-semibold">{label}</td>
      <td className="px-3 py-3">{value}</td>
      <td className="px-3 py-3 text-muted-foreground">{note}</td>
    </tr>
  );
}
