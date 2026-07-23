"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { Download, Search } from "lucide-react";
import { toast } from "sonner";
import { loadAttendanceHistoryAction } from "@/app/(dashboard)/crm/attendance/actions";
import { AttendanceCorrectionDialog } from "@/components/features/attendance/review/attendance-correction-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { addDaysToYmd } from "@/lib/engine/slot-time";
import type { AttendanceHistoryData } from "@/lib/attendance/queries";
import type { AttendanceRecord, AttendanceWorkspaceData } from "@/lib/attendance/types";

function csvCell(value: unknown): string {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function exportCsv(data: AttendanceHistoryData) {
  const rows = [
    ["Date", "Staff", "Clock in", "Clock out", "Worked minutes", "Status"],
    ...data.records.map((row) => [
      row.shift_date,
      row.staff_name,
      row.checked_in_at,
      row.checked_out_at ?? "",
      row.worked_minutes,
      row.attendance_status,
    ]),
  ];
  const blob = new Blob([rows.map((row) => row.map(csvCell).join(",")).join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `attendance-${data.fromDate}-${data.toDate}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function clock(value: string | null, timezone: string): string {
  return value
    ? new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(value))
    : "—";
}

export function AttendanceHistoryView({
  workspace,
  onRefresh,
}: {
  workspace: AttendanceWorkspaceData;
  onRefresh: () => void;
}) {
  const [fromDate, setFromDate] = useState(addDaysToYmd(workspace.businessDate, -13));
  const [toDate, setToDate] = useState(workspace.businessDate);
  const [mode, setMode] = useState<"records" | "changes">("records");
  const [search, setSearch] = useState("");
  const [data, setData] = useState<AttendanceHistoryData | null>(null);
  const [selected, setSelected] = useState<AttendanceRecord | null>(null);
  const [correcting, setCorrecting] = useState(false);
  const [pending, startTransition] = useTransition();
  const load = useCallback(
    () =>
      startTransition(async () => {
        const result = await loadAttendanceHistoryAction({ fromDate, toDate });
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        setData(result.data);
      }),
    [fromDate, toDate]
  );
  useEffect(() => {
    load();
  }, [load]);
  const records = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (data?.records ?? []).filter(
      (row) =>
        !query ||
        `${row.staff_name} ${row.shift_date} ${row.attendance_status}`.toLowerCase().includes(query)
    );
  }, [data, search]);

  return (
    <>
      <section className="overflow-hidden rounded-xl border border-[var(--cs-border)] bg-white">
        <div className="grid gap-3 border-b border-[var(--cs-border-soft)] p-4 lg:grid-cols-[1fr_auto_auto]">
          <div>
            <h2 className="font-bold">Attendance history</h2>
            <p className="mt-0.5 text-xs text-[var(--cs-text-muted)]">
              Records load only for the selected date range.
            </p>
          </div>
          <div className="flex gap-2">
            <Input
              aria-label="From date"
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
            />
            <Input
              aria-label="To date"
              type="date"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
            />
            <Button variant="outline" onClick={load} disabled={pending}>
              {pending ? "Loading…" : "Apply"}
            </Button>
          </div>
          <Button variant="outline" onClick={() => data && exportCsv(data)} disabled={!data}>
            <Download />
            Export CSV
          </Button>
        </div>
        <div className="flex flex-col gap-3 border-b border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-1 rounded-lg border bg-white p-1">
            {(["records", "changes"] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setMode(item)}
                className={`rounded-md px-3 py-1.5 text-xs font-bold ${mode === item ? "bg-[#2A5A3A] text-white" : "text-[var(--cs-text-muted)]"}`}
              >
                {item === "records" ? "Records" : "Corrections & audit"}
              </button>
            ))}
          </div>
          <label className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--cs-text-muted)]" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search history"
              className="pl-9"
            />
            <span className="sr-only">Search history</span>
          </label>
        </div>
        {mode === "records" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-[var(--cs-text-muted)]">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Staff</th>
                  <th className="px-4 py-3">Clock in</th>
                  <th className="px-4 py-3">Clock out</th>
                  <th className="px-4 py-3">Worked</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {records.map((row) => (
                  <tr
                    key={row.id}
                    tabIndex={0}
                    onClick={() => setSelected(row)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") setSelected(row);
                    }}
                    className="cursor-pointer border-t border-[var(--cs-border-soft)] hover:bg-[var(--cs-surface-warm)]"
                  >
                    <td className="px-4 py-3">{row.shift_date}</td>
                    <td className="px-4 py-3 font-semibold">{row.staff_name}</td>
                    <td className="px-4 py-3">{clock(row.checked_in_at, workspace.timezone)}</td>
                    <td className="px-4 py-3">{clock(row.checked_out_at, workspace.timezone)}</td>
                    <td className="px-4 py-3">
                      {Math.floor(row.worked_minutes / 60)}h {row.worked_minutes % 60}m
                    </td>
                    <td className="px-4 py-3 capitalize">
                      {row.attendance_status.replaceAll("_", " ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="divide-y divide-[var(--cs-border-soft)]">
            {(data?.corrections ?? []).map((item) => (
              <article
                key={item.id}
                className="grid gap-1 px-4 py-3 text-sm sm:grid-cols-[1fr_1fr_2fr]"
              >
                <div className="font-semibold">{item.staff_name ?? "System change"}</div>
                <div className="capitalize text-[var(--cs-text-muted)]">
                  {item.action_type.replaceAll("_", " ")}
                </div>
                <div>{item.reason}</div>
              </article>
            ))}
          </div>
        )}
        {!pending &&
        (mode === "records" ? records.length === 0 : (data?.corrections.length ?? 0) === 0) ? (
          <div className="p-10 text-center text-sm text-[var(--cs-text-muted)]">
            No history matches this range.
          </div>
        ) : null}
      </section>
      <Sheet
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{selected?.staff_name}</SheetTitle>
            <SheetDescription>{selected?.shift_date} attendance record</SheetDescription>
          </SheetHeader>
          {selected ? (
            <div className="grid gap-4 p-4">
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <Detail
                  label="Clock in"
                  value={clock(selected.checked_in_at, workspace.timezone)}
                />
                <Detail
                  label="Clock out"
                  value={clock(selected.checked_out_at, workspace.timezone)}
                />
                <Detail label="Worked" value={`${selected.worked_minutes} minutes`} />
                <Detail label="Status" value={selected.attendance_status.replaceAll("_", " ")} />
              </dl>
              <Button onClick={() => setCorrecting(true)}>Correct attendance</Button>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
      <AttendanceCorrectionDialog
        key={selected?.id ?? "none"}
        open={correcting}
        onOpenChange={setCorrecting}
        branchId={workspace.branchId}
        timezone={workspace.timezone}
        record={selected}
        exception={null}
        onSaved={() => {
          setSelected(null);
          load();
          onRefresh();
        }}
      />
    </>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--cs-border-soft)] p-3">
      <dt className="text-xs font-bold text-[var(--cs-text-muted)]">{label}</dt>
      <dd className="mt-1 capitalize">{value}</dd>
    </div>
  );
}
