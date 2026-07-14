"use client";

import { useMemo, useState } from "react";
import { FileDown, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Panel, StatusPill } from "@/components/features/attendance/attendance-ui";
import {
  ATTENDANCE_REPORT_NAMES,
  buildAttendanceReport,
  type AttendanceReportName,
} from "@/lib/attendance/reports";
import type { AttendanceWorkspaceData } from "@/lib/attendance/types";

function escapeCsvCell(value: string | number): string {
  const normalized = String(value);
  if (!/[",\n]/.test(normalized)) return normalized;
  return `"${normalized.replaceAll('"', '""')}"`;
}
const fieldClass = "h-10 w-full rounded-xl border border-border bg-white px-3 text-sm outline-none focus:border-emerald-800";

export function AttendanceReportsTab({ data }: { data: AttendanceWorkspaceData }) {
  const [selectedReport, setSelectedReport] = useState<AttendanceReportName>("Daily Attendance");
  const [startDate, setStartDate] = useState(data.businessDate);
  const [endDate, setEndDate] = useState(data.businessDate);
  const [staffType, setStaffType] = useState("all");
  const [staffId, setStaffId] = useState("all");
  const staffTypes = useMemo(
    () => Array.from(new Set(data.staffOptions.map((staff) => staff.staff_type).filter((value): value is string => Boolean(value)))).sort(),
    [data.staffOptions]
  );
  const report = useMemo(
    () => buildAttendanceReport({
      name: selectedReport,
      data,
      filters: { startDate, endDate, staffType, staffId },
    }),
    [data, endDate, selectedReport, staffId, staffType, startDate]
  );

  function exportCsv() {
    const rows = [
      report.columns.map((column) => column.label),
      ...report.rows.map((row) => report.columns.map((column) => row[column.key] ?? "")),
    ];
    const csv = rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `attendance-${selectedReport.toLowerCase().replaceAll(" ", "-")}-${startDate}-${endDate}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success(`${selectedReport} CSV exported.`);
  }

  return (
    <div className="grid gap-4">
      <Panel title="Report Filters" description="All filters apply to the table, print view, and CSV output.">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
            Start date
            <input className={fieldClass} type="date" value={startDate} max={endDate} onChange={(event) => setStartDate(event.target.value)} />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
            End date
            <input className={fieldClass} type="date" value={endDate} min={startDate} max={data.businessDate} onChange={(event) => setEndDate(event.target.value)} />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
            Staff type
            <select className={fieldClass} value={staffType} onChange={(event) => setStaffType(event.target.value)}>
              <option value="all">All staff types</option>
              {staffTypes.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
            Staff
            <select className={fieldClass} value={staffId} onChange={(event) => setStaffId(event.target.value)}>
              <option value="all">All staff</option>
              {data.staffOptions.map((staff) => <option key={staff.id} value={staff.id}>{staff.full_name}</option>)}
            </select>
          </label>
          <div className="flex items-end">
            <Button className="w-full" type="button" variant="outline" onClick={exportCsv}><FileDown data-icon="inline-start" />Export CSV</Button>
          </div>
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)]">
        <Panel title="Reports" description="Three operational outputs only.">
          <div className="grid gap-1">
            {ATTENDANCE_REPORT_NAMES.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => setSelectedReport(name)}
                aria-pressed={selectedReport === name}
                className={`rounded-lg px-3 py-2 text-left text-sm font-semibold ${selectedReport === name ? "bg-emerald-900 text-white" : "hover:bg-muted"}`}
              >
                {name}
              </button>
            ))}
          </div>
        </Panel>

        <Panel
          title={report.name}
          action={
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={exportCsv}><FileDown data-icon="inline-start" />CSV</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => window.print()}><Printer data-icon="inline-start" />Print</Button>
            </div>
          }
        >
          <div className="mb-3 flex flex-wrap gap-2 text-sm">
            <StatusPill value={`${report.rows.length} rows`} tone="neutral" />
            <StatusPill value={`${startDate} to ${endDate}`} tone="neutral" />
            <StatusPill value={data.branchName} tone="neutral" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-max text-sm">
              <thead>
                <tr className="border-b bg-stone-50 text-left text-xs text-muted-foreground">
                  {report.columns.map((column) => <th key={column.key} className="whitespace-nowrap px-3 py-2 font-semibold">{column.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {report.rows.map((row, index) => (
                  <tr key={`${row.auditReference ?? row.businessDate ?? "row"}-${index}`} className="border-b align-top last:border-b-0">
                    {report.columns.map((column) => <td key={column.key} className="max-w-[320px] whitespace-nowrap px-3 py-3">{row[column.key]}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
            {report.rows.length === 0 ? <div className="p-8 text-center text-sm text-muted-foreground">No rows match these filters.</div> : null}
          </div>
        </Panel>
      </div>
    </div>
  );
}
