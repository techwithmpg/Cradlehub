"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ChevronDown, Search } from "lucide-react";
import { AttendanceIssuePanel } from "@/components/features/attendance/fix-scan/attendance-issue-panel";
import type { AttendanceIssueAction } from "@/lib/attendance/issue-presentation-types";
import type { AttendanceStaffDiagnostic } from "@/lib/attendance/staff-diagnostics";
import type { AttendanceWorkspaceData } from "@/lib/attendance/types";

const RECOVERY_ACTIONS = new Set([
  "approve_temporary_assignment",
  "transfer_permanently",
  "reject_scan",
  "view_branch_history",
  "record_for_review",
  "review_previous_record",
  "close_record_safely",
  "fix_next_scan",
  "escalate",
  "correct_today_attendance",
]);

export function AttendanceFixScanView({
  data,
  rows,
  advancedRecovery,
  initialStaffId,
  onAction,
}: {
  data: AttendanceWorkspaceData;
  rows: AttendanceStaffDiagnostic[];
  advancedRecovery: (staffId: string | null) => ReactNode;
  initialStaffId?: string | null;
  onAction: (action: AttendanceIssueAction, row: AttendanceStaffDiagnostic) => void;
}) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(
    () => initialStaffId ?? rows.find((row) => row.needsHelp)?.staff.staffId ?? null
  );
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const matches = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows
      .filter((row) => !query || row.staff.staffName.toLowerCase().includes(query))
      .slice(0, 8);
  }, [rows, search]);
  const selected = rows.find((row) => row.staff.staffId === selectedId) ?? null;

  function handleAction(action: AttendanceIssueAction, row: AttendanceStaffDiagnostic) {
    if (RECOVERY_ACTIONS.has(action.id)) setAdvancedOpen(true);
    onAction(action, row);
  }

  return (
    <div className="grid gap-4">
      <section className="rounded-2xl border border-[var(--cs-border)] bg-white p-4 shadow-sm">
        <label className="grid gap-2">
          <span className="text-sm font-bold">Who is having a problem?</span>
          <span className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--cs-text-muted)]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search staff name"
              className="h-11 w-full rounded-xl border border-[var(--cs-border)] bg-white pl-10 pr-4 text-sm outline-none focus:border-[var(--sp-forest)] focus:ring-2 focus:ring-[var(--sp-forest)]/15"
            />
          </span>
        </label>
        {search ? (
          <div className="mt-2 grid max-h-64 overflow-y-auto rounded-xl border border-[var(--cs-border-soft)]">
            {matches.map((row) => (
              <button
                key={row.staff.staffId}
                type="button"
                onClick={() => {
                  setSelectedId(row.staff.staffId);
                  setSearch("");
                }}
                className="flex min-h-11 items-center justify-between gap-3 border-t border-[var(--cs-border-soft)] px-3 text-left text-sm first:border-t-0 hover:bg-[var(--cs-surface-warm)]"
              >
                <span className="font-semibold">{row.staff.staffName}</span>
                <span className="text-xs text-[var(--cs-text-muted)]">{row.statusLabel}</span>
              </button>
            ))}
            {matches.length === 0 ? (
              <div className="p-3 text-sm text-[var(--cs-text-muted)]">No staff found.</div>
            ) : null}
          </div>
        ) : null}
        {!search && rows.some((row) => row.needsHelp) ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {rows
              .filter((row) => row.needsHelp)
              .slice(0, 5)
              .map((row) => (
                <button
                  key={row.staff.staffId}
                  type="button"
                  onClick={() => setSelectedId(row.staff.staffId)}
                  className="min-h-9 rounded-lg border border-amber-200 bg-amber-50 px-3 text-xs font-bold text-amber-900 hover:border-[var(--sp-forest)]"
                >
                  {row.staff.staffName} · {row.statusLabel}
                </button>
              ))}
          </div>
        ) : null}
      </section>
      {selected ? (
        <AttendanceIssuePanel data={data} row={selected} onAction={handleAction} />
      ) : (
        <section className="rounded-2xl border border-dashed border-[var(--cs-border)] bg-white p-8 text-center">
          <Search className="mx-auto size-7 text-[var(--cs-text-muted)]" />
          <h2 className="mt-3 font-bold">Select a staff member</h2>
          <p className="mt-1 text-sm text-[var(--cs-text-muted)]">
            Search by name to see their schedule, phone, latest scan and recommended next action.
          </p>
        </section>
      )}
      <details
        open={advancedOpen}
        onToggle={(event) => setAdvancedOpen(event.currentTarget.open)}
        className="rounded-2xl border border-[var(--cs-border)] bg-white shadow-sm"
      >
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sp-forest)]">
          All scan problems, recovery tools and audit history
          <ChevronDown className="size-4" />
        </summary>
        <div className="border-t border-[var(--cs-border-soft)] p-3">
          {advancedRecovery(selectedId)}
        </div>
      </details>
    </div>
  );
}
