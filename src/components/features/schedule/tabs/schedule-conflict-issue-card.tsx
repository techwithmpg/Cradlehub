import { AlertOctagon, AlertTriangle, CheckCircle2, Clock3, DoorOpen, Info, UserRound, Wrench } from "lucide-react";
import type {
  LiveScheduleConflict,
  LiveScheduleConflictQuickAction,
  LiveScheduleConflictSeverity,
} from "@/lib/schedule/live-schedule-conflict-types";
import { formatScheduleTime } from "@/lib/utils/schedule-timeline";
import type { ScheduleConflictResolutionIssue } from "./schedule-conflict-center-model";
import {
  getConflictTypeLabel,
  getImpactGroupCopy,
} from "./schedule-conflict-center-model";

type Props = {
  issue: ScheduleConflictResolutionIssue;
  selected: boolean;
  onSelect: (issue: ScheduleConflictResolutionIssue) => void;
  onAcceptException: (issue: ScheduleConflictResolutionIssue) => void;
  onActionSelect: (
    conflict: LiveScheduleConflict,
    action: LiveScheduleConflictQuickAction
  ) => void;
};

const severityCopy: Record<LiveScheduleConflictSeverity, { label: string; className: string; icon: typeof Info }> = {
  info: {
    label: "Info",
    className: "border-sky-200 bg-sky-50 text-sky-800",
    icon: Info,
  },
  warning: {
    label: "Warning",
    className: "border-amber-200 bg-amber-50 text-amber-900",
    icon: AlertTriangle,
  },
  critical: {
    label: "Critical",
    className: "border-red-200 bg-red-50 text-red-800",
    icon: AlertOctagon,
  },
};

const impactClasses: Record<ScheduleConflictResolutionIssue["impactGroup"], string> = {
  must_fix: "border-red-200 bg-red-50 text-red-800",
  needs_approval: "border-amber-200 bg-amber-50 text-amber-900",
  cleanup_warning: "border-yellow-200 bg-yellow-50 text-yellow-900",
  informational: "border-emerald-200 bg-emerald-50 text-emerald-800",
  accepted: "border-stone-200 bg-stone-50 text-stone-700",
};

function formatConflictTime(conflict: LiveScheduleConflict): string {
  if (!conflict.start_time || !conflict.end_time) return "Time not set";
  return `${formatScheduleTime(conflict.start_time)} - ${formatScheduleTime(conflict.end_time)}`;
}

function DetailPill({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Info;
  label: string;
  value: string | null;
}) {
  if (!value) return null;

  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-stone-100 px-2 py-1 text-[10px] font-semibold text-[var(--cs-text-secondary)]">
      <Icon className="size-3 shrink-0 text-[var(--cs-text-muted)]" />
      <span className="sr-only">{label}</span>
      <span className="truncate">{value}</span>
    </span>
  );
}

export function ScheduleConflictIssueCard({
  issue,
  selected,
  onSelect,
  onAcceptException,
  onActionSelect,
}: Props) {
  const { conflict } = issue;
  const severity = severityCopy[conflict.severity];
  const SeverityIcon = severity.icon;
  const impactCopy = getImpactGroupCopy(issue.impactGroup);
  const staffLabel = conflict.affected_staff_names.join(", ") || null;
  const bookingLabel = conflict.affected_booking_labels.join(", ") || null;
  const resourceLabel = conflict.affected_resource_name;

  return (
    <article
      className={
        selected
          ? "rounded-2xl border border-emerald-500 bg-white p-4 shadow-md shadow-emerald-100 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1"
          : conflict.severity === "critical"
            ? "rounded-2xl border border-red-200 bg-white p-4 shadow-sm shadow-red-100/80 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1"
            : "rounded-2xl border border-[var(--cs-border-soft)] bg-white p-4 shadow-sm motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1"
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--cs-text-muted)]">
            {issue.systemImpact}
          </p>
          <h4 className="mt-1 text-sm font-bold text-[var(--cs-text)]">
            {getConflictTypeLabel(conflict.type)}
          </h4>
          <p className="mt-1 text-xs leading-5 text-[var(--cs-text-secondary)]">
            {conflict.plain_language_message}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-bold ${impactClasses[issue.impactGroup]}`}
          >
            {issue.impactGroup === "accepted" ? <CheckCircle2 className="size-3.5" /> : null}
            {impactCopy.label}
          </span>
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-bold ${severity.className}`}
          >
            <SeverityIcon className="size-3.5" />
            {severity.label}
          </span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <DetailPill icon={AlertTriangle} label="Operational impact" value={`${issue.operationalImpact} impact`} />
        <DetailPill icon={UserRound} label="Staff" value={staffLabel} />
        <DetailPill icon={Clock3} label="Time" value={formatConflictTime(conflict)} />
        <DetailPill icon={Info} label="Booking" value={bookingLabel} />
        <DetailPill icon={DoorOpen} label="Room or resource" value={resourceLabel} />
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--cs-text-muted)]">
            Broken rule
          </p>
          <p className="mt-1 text-[11px] leading-5 text-[var(--cs-text-secondary)]">
            {conflict.broken_rule}
          </p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-amber-950">
            <Wrench className="size-3" />
            Recommended fix
          </p>
          <p className="mt-1 text-[11px] leading-5 text-amber-950">
            {conflict.recommended_fix}
          </p>
        </div>
      </div>

      <p className="mt-3 text-[11px] leading-5 text-[var(--cs-text-muted)]">
        <span className="font-bold text-[var(--cs-text-secondary)]">Why it matters:</span>{" "}
        {conflict.why_it_matters}
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5 text-[10px] font-bold">
        {issue.affectsAvailability ? (
          <span className="rounded-full bg-red-50 px-2 py-1 text-red-800">
            Affects availability
          </span>
        ) : null}
        {issue.affectsOnlineBooking ? (
          <span className="rounded-full bg-red-50 px-2 py-1 text-red-800">
            Affects online booking
          </span>
        ) : null}
        {issue.acceptance ? (
          <span className="rounded-full bg-stone-100 px-2 py-1 text-stone-700">
            Accepted: {issue.acceptance.scope.replaceAll("_", " ")}
          </span>
        ) : null}
      </div>

      {conflict.quick_actions.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => onSelect(issue)}
            className="inline-flex min-h-8 items-center rounded-lg bg-emerald-800 px-2.5 text-[11px] font-bold text-white transition hover:bg-emerald-900"
          >
            Fix issue
          </button>
          {conflict.quick_actions.map((action, index) => (
            <button
              key={`${conflict.id}-${action.intent}-${action.bookingId ?? "none"}-${index}`}
              type="button"
              onClick={() => onActionSelect(conflict, action)}
              className="inline-flex min-h-8 items-center rounded-lg border border-[var(--cs-border-soft)] bg-white px-2.5 text-[11px] font-bold text-[var(--cs-text-secondary)] transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-900"
            >
              {action.label}
            </button>
          ))}
          {issue.canAcceptException ? (
            <button
              type="button"
              onClick={() => onAcceptException(issue)}
              className="inline-flex min-h-8 items-center rounded-lg border border-amber-200 bg-amber-50 px-2.5 text-[11px] font-bold text-amber-900 transition hover:bg-amber-100"
            >
              Accept exception
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
