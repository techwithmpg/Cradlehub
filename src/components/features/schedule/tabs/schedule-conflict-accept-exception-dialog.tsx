import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import type {
  AcceptedScheduleConflictException,
  ScheduleConflictAuditVisibility,
  ScheduleConflictExceptionScope,
  ScheduleConflictResolutionIssue,
} from "./schedule-conflict-center-model";
import { getConflictTypeLabel, getImpactGroupCopy } from "./schedule-conflict-center-model";

type Props = {
  issue: ScheduleConflictResolutionIssue | null;
  onAccept: (exception: AcceptedScheduleConflictException) => void;
  onClose: () => void;
};

const scopeOptions: Array<{ value: ScheduleConflictExceptionScope; label: string }> = [
  { value: "today_only", label: "Today only" },
  { value: "this_staff_only", label: "This staff only" },
  { value: "this_booking_only", label: "This booking only" },
  { value: "schedule_rule_going_forward", label: "Schedule rule going forward" },
];

const visibilityOptions: Array<{ value: ScheduleConflictAuditVisibility; label: string }> = [
  { value: "front_desk", label: "Front desk note" },
  { value: "manager_audit", label: "Manager audit" },
  { value: "owner_audit", label: "Owner audit" },
];

export function ScheduleConflictAcceptExceptionDialog({
  issue,
  onAccept,
  onClose,
}: Props) {
  const [reason, setReason] = useState("");
  const [scope, setScope] = useState<ScheduleConflictExceptionScope>("today_only");
  const [auditVisibility, setAuditVisibility] = useState<ScheduleConflictAuditVisibility>("manager_audit");

  if (!issue) return null;

  const impactCopy = getImpactGroupCopy(issue.impactGroup);
  const reasonValid = reason.trim().length >= 8;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20 px-4 py-6 backdrop-blur-sm">
      <section className="w-full max-w-lg rounded-2xl border border-amber-200 bg-[#fffaf2] p-4 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-amber-900">
              <AlertTriangle className="size-3.5" />
              Accept exception
            </p>
            <h3 className="mt-1 text-base font-bold text-[var(--cs-text)]">
              {getConflictTypeLabel(issue.conflict.type)}
            </h3>
            <p className="mt-1 text-xs leading-5 text-[var(--cs-text-secondary)]">
              {impactCopy.label} issues require a reason and scope. Must Fix issues cannot be accepted here.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-white text-[var(--cs-text-muted)] transition hover:bg-stone-100"
          >
            <X className="size-4" />
            <span className="sr-only">Close accept exception form</span>
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--cs-text-muted)]">
              Reason
            </span>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              placeholder="Example: Manager approved one-day override after confirming staff availability."
              className="mt-1 w-full rounded-xl border border-[var(--cs-border-soft)] bg-white px-3 py-2 text-sm text-[var(--cs-text)] outline-none transition focus:border-emerald-400"
            />
          </label>

          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--cs-text-muted)]">
              Scope
            </span>
            <select
              value={scope}
              onChange={(event) => setScope(event.target.value as ScheduleConflictExceptionScope)}
              className="mt-1 h-9 w-full rounded-xl border border-[var(--cs-border-soft)] bg-white px-3 text-sm font-semibold text-[var(--cs-text)] outline-none transition focus:border-emerald-400"
            >
              {scopeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--cs-text-muted)]">
              Audit visibility
            </span>
            <select
              value={auditVisibility}
              onChange={(event) => setAuditVisibility(event.target.value as ScheduleConflictAuditVisibility)}
              className="mt-1 h-9 w-full rounded-xl border border-[var(--cs-border-soft)] bg-white px-3 text-sm font-semibold text-[var(--cs-text)] outline-none transition focus:border-emerald-400"
            >
              {visibilityOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-5 text-amber-950">
          This records the exception in the Conflict Center audit list for this review session. It does not hide Must Fix
          issues or override online booking / availability integrity rules.
        </div>

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-9 items-center rounded-xl border border-[var(--cs-border-soft)] bg-white px-3 text-xs font-bold text-[var(--cs-text-secondary)] transition hover:bg-stone-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!issue.canAcceptException || !reasonValid}
            onClick={() =>
              onAccept({
                id: `accepted-${issue.conflict.id}-${Date.now()}`,
                conflictId: issue.conflict.id,
                conflictType: issue.conflict.type,
                reason: reason.trim(),
                scope,
                auditVisibility,
                acceptedAt: new Date().toISOString(),
              })
            }
            className="inline-flex min-h-9 items-center rounded-xl bg-amber-700 px-3 text-xs font-bold text-white transition hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Accept exception
          </button>
        </div>
      </section>
    </div>
  );
}
