"use client";

import { useMemo, useState } from "react";
import { FileDown, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Panel,
  StatusPill,
  ToolbarSelect,
  ToolbarShell,
  formatMinutesCompact,
} from "@/components/features/attendance/attendance-ui";
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

function escapeCsvCell(value: string): string {
  if (!/[",\n]/.test(value)) return value;
  return `"${value.replaceAll('"', '""')}"`;
}

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
  const reportRows = [
    ["Worked Hours", formatMinutesCompact(totals.worked), "Sum of recorded worked minutes."],
    ["Late Arrivals", formatMinutesCompact(totals.late), "Late minutes from attendance records."],
    ["Early Departures", formatMinutesCompact(totals.early), "Early leave minutes from attendance records."],
    ["Overtime", formatMinutesCompact(totals.overtime), "Overtime minutes from attendance records."],
  ] as const;

  function exportCsv() {
    const rows = [
      ["Report", "Metric", "Value", "Notes"],
      ...reportRows.map(([metric, value, note]) => [selectedReport, metric, value, note]),
    ];
    const csv = rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `attendance-${selectedReport.toLowerCase().replaceAll(" ", "-")}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success(`${selectedReport} CSV exported.`);
  }

  return (
    <div className="grid gap-4">
      <Panel title="Report Filters" description="Scope report output before exporting or printing.">
        <ToolbarShell
          className="border-0 bg-transparent p-0 shadow-none"
          fieldsClassName="sm:grid-cols-2 xl:grid-cols-4"
          actions={<Button type="button" variant="outline" onClick={exportCsv}><FileDown data-icon="inline-start" />Export</Button>}
        >
          <ToolbarSelect label="Range" value="today" onChange={() => undefined}>
            <option value="today">Today</option>
          </ToolbarSelect>
          <ToolbarSelect label="Branch" value={data.branchName} disabled onChange={() => undefined}>
            <option>{data.branchName}</option>
          </ToolbarSelect>
          <ToolbarSelect label="Staff Type" value="all" onChange={() => undefined}>
            <option value="all">All staff types</option>
          </ToolbarSelect>
          <ToolbarSelect label="Staff" value="all" onChange={() => undefined}>
            <option value="all">All staff</option>
          </ToolbarSelect>
        </ToolbarShell>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
        <Panel title="Reports">
          <div className="grid gap-1">
            {REPORTS.map((report) => (
              <button
                key={report}
                type="button"
                onClick={() => setSelectedReport(report)}
                aria-pressed={selectedReport === report}
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
              <Button type="button" variant="outline" size="sm" onClick={exportCsv}><FileDown data-icon="inline-start" />CSV</Button>
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
                {reportRows.map(([label, value, note]) => (
                  <ReportRow key={label} label={label} value={value} note={note} />
                ))}
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
