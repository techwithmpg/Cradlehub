"use client";

import {
  CheckCircle2,
  ExternalLink,
  Link2,
  MessageSquareText,
  ShieldCheck,
  Smartphone,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  EmptyState,
  StaffAvatar,
  StatusPill,
  formatAttendanceDateTime,
} from "@/components/features/attendance/attendance-ui";
import { getInternalAttendanceExceptionType } from "@/lib/attendance/exception-codes";
import type { RecoveryIssue } from "@/components/features/attendance/recovery/recovery-issue-types";

function priorityTone(priority: RecoveryIssue["priority"]): "bad" | "warn" | "neutral" {
  if (priority === "high") return "bad";
  if (priority === "medium") return "warn";
  return "neutral";
}

function renderDetailIcon(issue: RecoveryIssue) {
  if (issue.category === "device_access") return <Smartphone className="size-6" />;
  if (issue.category === "staff_day_repair") return <UserRound className="size-6" />;
  return <ShieldCheck className="size-6" />;
}

function snapshotText(
  snapshot: Record<string, unknown> | null | undefined,
  key: string
): string | null {
  const value = snapshot?.[key];
  if (typeof value === "string" && value.trim()) return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return null;
}

function compactEvidenceId(value: string | null): string | null {
  if (!value) return null;
  return value.length > 12 ? `…${value.slice(-8)}` : value;
}

export function SelectedRecoveryIssuePanel({
  issue,
  isPending,
  notes,
  onAllowBranchToday,
  onAskStaff,
  onEscalateTechnical,
  onIgnoreAsTest,
  onMarkReviewed,
  onCorrectPermanentBranch,
  onOpenDevices,
  onOpenStateReset,
  onOpenStaffRecords,
  reason,
  setNotes,
  setReason,
}: {
  issue: RecoveryIssue | null;
  isPending: boolean;
  notes: string;
  onAllowBranchToday: (issue: RecoveryIssue) => void;
  onAskStaff: (issue: RecoveryIssue) => void;
  onEscalateTechnical: (issue: RecoveryIssue) => void;
  onIgnoreAsTest: (issue: RecoveryIssue) => void;
  onMarkReviewed: (issue: RecoveryIssue) => void;
  onCorrectPermanentBranch: (issue: RecoveryIssue) => void;
  onOpenDevices: () => void;
  onOpenStateReset: () => void;
  onOpenStaffRecords: () => void;
  reason: string;
  setNotes: (value: string) => void;
  setReason: (value: string) => void;
}) {
  if (!issue) {
    return (
      <section className="rounded-3xl border border-dashed border-border bg-card p-8">
        <EmptyState
          title="Select a recovery issue"
          detail="Choose a blocked scan, device problem, or staff-day repair item to see safe actions."
        />
      </section>
    );
  }

  const canResolveBranch = issue.exception
    ? getInternalAttendanceExceptionType(issue.exception) === "wrong_branch" &&
      Boolean(issue.staffId)
    : false;
  const policySnapshot = issue.record?.attendance_policy_snapshot ?? null;
  const expectedEnd = snapshotText(policySnapshot, "expectedEndAt");
  const scheduledEnd =
    snapshotText(policySnapshot, "resolvedScheduleEndAt") ??
    snapshotText(policySnapshot, "rawScheduledEndAt");
  const source = snapshotText(policySnapshot, "kind");
  const sourceEvidenceId = compactEvidenceId(
    snapshotText(policySnapshot, "sourceBookingId") ??
      snapshotText(policySnapshot, "sourceDispatchId") ??
      snapshotText(policySnapshot, "sourceTripId")
  );
  const buffer = snapshotText(policySnapshot, "appliedBufferMinutes");
  const method = snapshotText(policySnapshot, "clockOutMethod");
  const blockedReason = snapshotText(policySnapshot, "portalEligibilityReason");

  return (
    <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-bold text-foreground">Selected Issue</h2>
          <StatusPill value={`${issue.priority} priority`} tone={priorityTone(issue.priority)} />
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() => onMarkReviewed(issue)}
          >
            <CheckCircle2 className="mr-2 size-4" />
            Mark as Reviewed
          </Button>
        </div>
      </div>

      <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1fr)_260px]">
        <div className="grid min-w-0 gap-5">
          <div className="grid gap-4 md:grid-cols-[56px_minmax(0,1fr)_auto] md:items-start">
            <span className="flex size-14 items-center justify-center rounded-full bg-red-50 text-red-700">
              {renderDetailIcon(issue)}
            </span>

            <div className="min-w-0">
              <h3 className="truncate text-xl font-bold text-foreground">{issue.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{issue.subtitle}</p>
            </div>

            <StatusPill value={issue.priority} tone={priorityTone(issue.priority)} />
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <InfoTile label="Scanned At" value={formatAttendanceDateTime(issue.detectedAt)} />
            <InfoTile label="Branch" value={issue.branchName} />
            <InfoTile label="Device Info" value={issue.deviceInfo ?? "Not available"} />
            <InfoTile
              label="Scan Count"
              value={
                issue.scanCount === null
                  ? "—"
                  : `${issue.scanCount} scan${issue.scanCount === 1 ? "" : "s"}`
              }
            />
          </div>

          <div className="border-t border-border pt-4">
            <h4 className="text-sm font-bold text-foreground">What happened</h4>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{issue.description}</p>
          </div>

          {issue.record ? (
            <div className="grid gap-3 rounded-2xl border border-border bg-muted/20 p-4 md:grid-cols-3">
              <InfoTile
                label="Expected clock-out"
                value={expectedEnd ? formatAttendanceDateTime(expectedEnd) : "Schedule fallback"}
              />
              <InfoTile
                label="Schedule fallback"
                value={scheduledEnd ? formatAttendanceDateTime(scheduledEnd) : "Not available"}
              />
              <InfoTile label="Dynamic source" value={source ?? "schedule"} />
              <InfoTile
                label="Source evidence"
                value={sourceEvidenceId ?? "No qualifying assignment"}
              />
              <InfoTile label="Applied buffer" value={buffer ? `${buffer} minutes` : "0 minutes"} />
              <InfoTile
                label="Clock-out method"
                value={method ?? issue.record.clock_out_method ?? "Not completed"}
              />
              {blockedReason && blockedReason !== "use_branch_qr" ? (
                <InfoTile label="Portal result" value={blockedReason} />
              ) : null}
              {issue.record.provisional_auto_closed_at ? (
                <InfoTile
                  label="Provisional close"
                  value={formatAttendanceDateTime(issue.record.provisional_auto_closed_at)}
                />
              ) : null}
              {issue.record.actual_clock_out_reconciled_at ? (
                <InfoTile
                  label="Actual reconciliation"
                  value={formatAttendanceDateTime(issue.record.actual_clock_out_reconciled_at)}
                />
              ) : null}
            </div>
          ) : null}

          <div className="grid gap-4 border-t border-dashed border-border pt-4 md:grid-cols-2">
            <div>
              <h4 className="text-sm font-bold text-foreground">Why this happened</h4>
              <ul className="mt-2 grid gap-1 pl-4 text-sm leading-6 text-muted-foreground">
                {issue.reasonBullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-bold text-foreground">Recommended action</h4>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {issue.recommendedAction}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Staff {issue.staffName ? "" : "(if known)"}
            </div>

            {issue.staffName ? (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <StaffAvatar name={issue.staffName} />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold text-foreground">
                      {issue.staffName}
                    </div>
                    <div className="truncate text-xs capitalize text-muted-foreground">
                      {issue.staffRole ?? "Staff member"}
                    </div>
                  </div>
                </div>

                <Button type="button" variant="outline" size="sm" onClick={onOpenStaffRecords}>
                  Open Staff Records
                  <ExternalLink className="ml-2 size-3.5" />
                </Button>
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                This issue is not linked to a staff member yet.
              </p>
            )}
          </div>

          {issue.category === "device_access" ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 size-5 shrink-0 text-amber-800" />
                <div>
                  <div className="font-bold text-foreground">About Device Recovery</div>
                  <p className="mt-1 text-sm leading-6 text-amber-900">
                    Recovery links reconnect a phone securely to the staff member profile. The
                    current device remains active until the new device confirms, unless CRM revokes
                    it.
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <aside className="grid content-start gap-4 rounded-3xl border border-border bg-card p-4">
          <h3 className="text-base font-bold text-foreground">Actions</h3>

          {issue.category === "device_access" ? (
            <Button type="button" onClick={onOpenDevices}>
              <Link2 className="mr-2 size-4" />
              Connect Replacement Phone
            </Button>
          ) : null}

          {canResolveBranch ? (
            <>
              <Button type="button" disabled={isPending} onClick={() => onAllowBranchToday(issue)}>
                Approve Temporary Assignment
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => onCorrectPermanentBranch(issue)}
              >
                Transfer Permanently
              </Button>
            </>
          ) : null}

          {issue.category === "staff_day_repair" || issue.category === "scan_recovery" ? (
            <Button type="button" variant="outline" onClick={onOpenStateReset}>
              <UserRound className="mr-2 size-4" />
              Open Attendance State Reset
            </Button>
          ) : null}

          {issue.category === "device_access" ? (
            <Button type="button" variant="outline" onClick={onOpenDevices}>
              <Smartphone className="mr-2 size-4" />
              Open Staff Phones
            </Button>
          ) : null}

          {issue.staffId ? (
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => onAskStaff(issue)}
            >
              <MessageSquareText className="mr-2 size-4" />
              Ask Staff for Information
            </Button>
          ) : null}

          {issue.exception?.exception_type.toLowerCase().includes("attendance_") ||
          issue.exception?.severity === "critical" ? (
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => onEscalateTechnical(issue)}
            >
              <ShieldCheck className="mr-2 size-4" />
              Escalate to Technical Support
            </Button>
          ) : null}

          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() => onMarkReviewed(issue)}
          >
            <CheckCircle2 className="mr-2 size-4" />
            Mark as Reviewed
          </Button>

          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() => onIgnoreAsTest(issue)}
          >
            <ShieldCheck className="mr-2 size-4" />
            Ignore as Test Scan
          </Button>

          <div className="mt-2 border-t border-border pt-4">
            <div className="text-sm font-bold text-foreground">Required</div>

            <label className="mt-3 grid gap-1 text-sm font-semibold">
              Reason
              <select
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className="h-10 rounded-xl border border-border bg-card px-3 text-sm font-normal outline-none focus:border-primary"
              >
                <option value="Attendance recovery correction.">Select reason...</option>
                <option value="Device recovery support.">Device recovery support</option>
                <option value="Staff forgot to clock out.">Staff forgot to clock out</option>
                <option value="Launch recovery review.">Launch recovery review</option>
                <option value="Training or test scan.">Training or test scan</option>
              </select>
            </label>

            <label className="mt-3 grid gap-1 text-sm font-semibold">
              Notes optional
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Add notes about this action..."
                className="min-h-20 rounded-xl border border-border bg-card p-3 text-sm font-normal outline-none focus:border-primary"
              />
            </label>
          </div>
        </aside>
      </div>
    </section>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-muted/30 p-3">
      <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-2 text-sm font-bold text-foreground">{value}</div>
    </div>
  );
}
