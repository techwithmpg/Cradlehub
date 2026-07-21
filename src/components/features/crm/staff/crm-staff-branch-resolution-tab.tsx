"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ScanLine, ShieldCheck, XCircle } from "lucide-react";
import type {
  BranchAssignmentIssue,
  BranchAssignmentResolutionResult,
} from "@/lib/staff/branch-correction-types";
import {
  branchAssignmentStatusLabel,
  formatBranchAssignmentDate,
  humanizeBranchAssignmentValue,
} from "./branch-assignment-ui";
import { CrmStaffBranchResolutionDialog } from "./crm-staff-branch-resolution-dialog";

type Props = {
  requests: BranchAssignmentIssue[];
  onResolved?: (result: Extract<BranchAssignmentResolutionResult, { ok: true }>) => void;
};
type DialogMode = "resolve" | "wrong_qr";

function statusClass(status: BranchAssignmentIssue["status"]): string {
  if (status === "open") return "bg-amber-100 text-amber-800";
  if (status === "requires_review") return "bg-orange-100 text-orange-800";
  if (status === "dismissed") return "bg-red-100 text-red-800";
  return "bg-emerald-100 text-emerald-800";
}

function BranchEvidence({ issue }: { issue: BranchAssignmentIssue }) {
  return (
    <details className="mt-4 rounded-lg border border-[var(--cs-border-soft)] p-3 text-sm text-[var(--cs-text-muted)]">
      <summary className="flex cursor-pointer items-center gap-2 font-semibold text-[var(--cs-text)]">
        <ScanLine size={16} /> View branch evidence
      </summary>
      <dl className="mt-3 grid gap-2 md:grid-cols-2">
        <div><dt className="text-xs font-semibold uppercase tracking-normal">Detected</dt><dd>{formatBranchAssignmentDate(issue.createdAt)}</dd></div>
        <div><dt className="text-xs font-semibold uppercase tracking-normal">Status</dt><dd>{branchAssignmentStatusLabel(issue)}</dd></div>
        <div><dt className="text-xs font-semibold uppercase tracking-normal">Source</dt><dd>{humanizeBranchAssignmentValue(issue.source)}</dd></div>
        <div><dt className="text-xs font-semibold uppercase tracking-normal">Original scan</dt><dd className="break-all">{issue.scanEventId ?? "Not linked"}</dd></div>
        <div><dt className="text-xs font-semibold uppercase tracking-normal">Schedules</dt><dd>{issue.scheduleBranches.length > 0 ? issue.scheduleBranches.join(", ") : "No active branch duties"}</dd></div>
        <div><dt className="text-xs font-semibold uppercase tracking-normal">Future bookings</dt><dd>{issue.bookingBranches.length > 0 ? issue.bookingBranches.map((entry) => `${entry.name} (${entry.count})`).join(", ") : "None"}</dd></div>
        <div><dt className="text-xs font-semibold uppercase tracking-normal">Temporary permissions</dt><dd>{issue.activeTemporaryPermissionCount}</dd></div>
        <div><dt className="text-xs font-semibold uppercase tracking-normal">Open Attendance</dt><dd>{issue.openAttendanceCount}</dd></div>
      </dl>
      {issue.rootCauses.length > 0 ? (
        <p className="mt-3"><strong className="text-[var(--cs-text)]">Detected causes:</strong> {issue.rootCauses.map(humanizeBranchAssignmentValue).join(", ")}</p>
      ) : null}
      {issue.reason ? <p className="mt-1"><strong className="text-[var(--cs-text)]">Decision note:</strong> {issue.reason}</p> : null}
      {issue.nextAction ? <p className="mt-1"><strong className="text-[var(--cs-text)]">Next action:</strong> {humanizeBranchAssignmentValue(issue.nextAction)}</p> : null}
    </details>
  );
}

export function CrmStaffBranchResolutionTab({ requests, onResolved = () => undefined }: Props) {
  const [selected, setSelected] = useState<BranchAssignmentIssue | null>(null);
  const [mode, setMode] = useState<DialogMode>("resolve");
  const sortedRequests = useMemo(
    () => [...requests].sort((a, b) => {
      const aOpen = a.status === "open" || a.status === "requires_review";
      const bOpen = b.status === "open" || b.status === "requires_review";
      if (aOpen !== bOpen) return aOpen ? -1 : 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }),
    [requests]
  );

  function open(issue: BranchAssignmentIssue, nextMode: DialogMode) {
    setSelected(issue);
    setMode(nextMode);
  }

  if (sortedRequests.length === 0) {
    return (
      <div className="rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] p-6 text-center text-sm text-[var(--cs-text-muted)]">
        No branch assignment issues yet.
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {sortedRequests.map((issue) => {
          const actionable = issue.status === "open" || issue.status === "requires_review";
          return (
            <article key={issue.id} className="rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] p-4 shadow-[var(--cs-shadow-xs)]">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs font-semibold uppercase tracking-normal text-[var(--cs-text-muted)]">Branch assignment</p>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusClass(issue.status)}`}>{branchAssignmentStatusLabel(issue)}</span>
                    {issue.isTest ? <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-800">Test Mode</span> : null}
                  </div>
                  <h3 className="mt-1 text-base font-semibold text-[var(--cs-text)]">
                    {issue.staffName}{issue.staffNickname ? <span className="font-normal text-[var(--cs-text-muted)]"> ({issue.staffNickname})</span> : null}
                  </h3>
                  <p className="mt-1 text-sm text-[var(--cs-text-muted)]">{issue.staffType ?? "Staff"} · {humanizeBranchAssignmentValue(issue.source)}</p>
                </div>
                {actionable ? (
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="inline-flex items-center gap-2 rounded-md bg-[#2f7040] px-3 py-2 text-sm font-semibold text-white" onClick={() => open(issue, "resolve")}><ShieldCheck size={16} /> Resolve branch</button>
                    <button type="button" className="inline-flex items-center gap-2 rounded-md border border-red-200 px-3 py-2 text-sm font-semibold text-red-700" onClick={() => open(issue, "wrong_qr")}><XCircle size={16} /> Wrong QR only</button>
                  </div>
                ) : null}
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-lg bg-[var(--cs-surface-warm)] p-3"><span className="text-xs font-semibold uppercase tracking-normal text-[var(--cs-text-muted)]">Current profile branch</span><strong className="mt-1 block text-sm text-[var(--cs-text)]">{issue.profileBranchName}</strong></div>
                <div className="rounded-lg bg-[var(--cs-surface-warm)] p-3"><span className="text-xs font-semibold uppercase tracking-normal text-[var(--cs-text-muted)]">Scanned / affected branch</span><strong className="mt-1 block text-sm text-[var(--cs-text)]">{issue.affectedBranchName ?? "Not recorded"}</strong></div>
              </div>

              {issue.openAttendanceCount > 0 ? (
                <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><AlertTriangle size={17} className="mt-0.5 shrink-0" /> This staff member has open Attendance and may require manager review.</div>
              ) : null}

              <BranchEvidence issue={issue} />
            </article>
          );
        })}
      </div>

      <CrmStaffBranchResolutionDialog
        issue={selected}
        mode={mode}
        onClose={() => setSelected(null)}
        onResolved={onResolved}
      />
    </>
  );
}
