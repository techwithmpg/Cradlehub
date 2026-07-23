"use client";

import { Clock3, RotateCcw, Search, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  EmptyState,
  StaffAvatar,
  StatusPill,
  formatAttendanceDate,
  formatAttendanceDateTime,
  formatMinutesCompact,
  humanizeAttendanceValue,
} from "@/components/features/attendance/attendance-ui";
import type { AttendanceRecord, AttendanceWorkspaceData } from "@/lib/attendance/types";

function needsRepair(record: AttendanceRecord): boolean {
  return (
    record.status === "checked_in" ||
    record.exception_state === "open" ||
    record.attendance_status !== "present"
  );
}

export function StaffDayRepairPanel({
  data,
  isPending,
  onManualClockOut,
  onResetAttendanceState,
}: {
  data: AttendanceWorkspaceData;
  isPending: boolean;
  onManualClockOut: (record: AttendanceRecord, reason: string) => void;
  onResetAttendanceState: (record: AttendanceRecord, reason: string, confirmVoid: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [repairReason, setRepairReason] = useState("");
  const [confirmVoid, setConfirmVoid] = useState(false);

  const records = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return data.records.filter((record) => {
      if (!needsRepair(record)) return false;
      if (!normalizedQuery) return true;

      return [
        record.staff_name,
        record.staff_nickname ?? "",
        record.shift_type,
        record.attendance_status,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [data.records, query]);

  const selectedRecord =
    records.find((record) => record.id === selectedRecordId) ?? records[0] ?? null;

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(420px,1fr)]">
      <section className="rounded-3xl border border-border bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-foreground">Attendance State Repair</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Reset selected attendance state without changing raw QR scan history.
            </p>
          </div>

          <label className="flex h-10 w-full max-w-sm items-center gap-2 rounded-2xl border border-border bg-card px-3">
            <Search className="size-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search staff..."
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
          </label>
        </div>

        <div className="grid max-h-[680px] gap-2 overflow-y-auto p-4">
          {records.length === 0 ? (
            <EmptyState
              title="No staff-day repair items"
              detail="Checked-in, late, early-leave, overtime, and open-exception records appear here."
            />
          ) : (
            records.map((record) => {
              const selected = selectedRecord?.id === record.id;

              return (
                <button
                  key={record.id}
                  type="button"
                  onClick={() => setSelectedRecordId(record.id)}
                  className={`grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border px-4 py-3 text-left transition hover:border-primary ${
                    selected ? "border-primary bg-primary/10" : "border-border bg-card"
                  }`}
                >
                  <StaffAvatar name={record.staff_nickname ?? record.staff_name} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-foreground">
                      {record.staff_nickname ?? record.staff_name}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {humanizeAttendanceValue(record.shift_type)} ·{" "}
                      {formatAttendanceDate(record.shift_date)}
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      In {formatAttendanceDateTime(record.checked_in_at)} · Out{" "}
                      {formatAttendanceDateTime(record.checked_out_at)}
                    </span>
                  </span>
                  <StatusPill value={record.attendance_status} />
                </button>
              );
            })
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
        {selectedRecord ? (
          <div className="grid gap-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <StaffAvatar name={selectedRecord.staff_nickname ?? selectedRecord.staff_name} />
                <div className="min-w-0">
                  <h3 className="truncate text-lg font-bold text-foreground">
                    {selectedRecord.staff_nickname ?? selectedRecord.staff_name}
                  </h3>
                  <p className="text-sm capitalize text-muted-foreground">
                    {selectedRecord.staff_type ?? "Staff"} ·{" "}
                    {humanizeAttendanceValue(selectedRecord.shift_type)}
                  </p>
                </div>
              </div>
              <StatusPill value={selectedRecord.attendance_status} />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <RepairTile
                label="Clock In"
                value={formatAttendanceDateTime(selectedRecord.checked_in_at)}
              />
              <RepairTile
                label="Clock Out"
                value={formatAttendanceDateTime(selectedRecord.checked_out_at)}
              />
              <RepairTile
                label="Worked"
                value={formatMinutesCompact(selectedRecord.worked_minutes)}
              />
              <RepairTile label="Late" value={formatMinutesCompact(selectedRecord.late_minutes)} />
              <RepairTile
                label="Early Leave"
                value={formatMinutesCompact(selectedRecord.early_leave_minutes)}
              />
              <RepairTile
                label="Overtime"
                value={formatMinutesCompact(selectedRecord.overtime_minutes)}
              />
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="font-bold text-foreground">Safe repair preview</div>
              <p className="mt-1 text-sm leading-6 text-amber-900">
                This affects only the selected interpreted attendance record. Raw scan events remain
                available for audit and future rebuilds.
              </p>
            </div>

            <div className="grid gap-3 rounded-2xl border border-border bg-card p-4">
              <label className="grid gap-1 text-sm font-semibold">
                Required reason
                <textarea
                  value={repairReason}
                  onChange={(event) => setRepairReason(event.target.value)}
                  placeholder="Example: Launch-day stale open row; reset next scan state."
                  className="min-h-20 rounded-xl border border-border bg-card p-3 text-sm font-normal outline-none focus:border-primary"
                />
              </label>

              <label className="flex items-start gap-3 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={confirmVoid}
                  onChange={(event) => setConfirmVoid(event.target.checked)}
                  className="mt-1 size-4"
                />
                <span>
                  I understand this voids only the selected interpreted attendance record and keeps
                  raw scans plus correction history.
                </span>
              </label>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {selectedRecord.status === "checked_in" ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={isPending || !repairReason.trim()}
                  onClick={() => onManualClockOut(selectedRecord, repairReason)}
                >
                  <Clock3 className="mr-2 size-4" />
                  Set Manual Clock Out
                </Button>
              ) : null}

              <Button
                type="button"
                variant="outline"
                disabled={isPending || !repairReason.trim() || !confirmVoid}
                onClick={() => onResetAttendanceState(selectedRecord, repairReason, confirmVoid)}
              >
                <RotateCcw className="mr-2 size-4" />
                Fix Next Scan
              </Button>

              <Button type="button" className="sm:col-span-2" disabled>
                <UserRound className="mr-2 size-4" />
                Rebuild From Raw Scans
              </Button>
            </div>
          </div>
        ) : (
          <EmptyState
            title="Select a staff record"
            detail="Choose a staff day to preview clock-in, clock-out, worked time, and safe repair actions."
          />
        )}
      </section>
    </div>
  );
}

function RepairTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-2 text-sm font-bold text-foreground">{value}</div>
    </div>
  );
}
