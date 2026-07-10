import type { ReactNode } from "react";
import { ArrowRight, CalendarClock, DoorOpen, MapPinned, UsersRound, Wrench, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type {
  LiveScheduleConflict,
  LiveScheduleConflictQuickAction,
} from "@/lib/schedule/live-schedule-conflict-types";
import { formatScheduleTime } from "@/lib/utils/schedule-timeline";
import type { ScheduleConflictResolutionIssue } from "./schedule-conflict-center-model";
import { getConflictTypeLabel, getImpactGroupCopy } from "./schedule-conflict-center-model";
import { ScheduleConflictSafePreview } from "./schedule-conflict-safe-preview";

type Props = {
  issue: ScheduleConflictResolutionIssue | null;
  duplicateIssueCount: number;
  onRunAction: (
    conflict: LiveScheduleConflict,
    action: LiveScheduleConflictQuickAction
  ) => void;
  onAcceptException: (issue: ScheduleConflictResolutionIssue) => void;
  onClear: () => void;
};

function formatConflictTime(conflict: LiveScheduleConflict): string {
  if (!conflict.start_time || !conflict.end_time) return "All day";
  return `${formatScheduleTime(conflict.start_time)} - ${formatScheduleTime(conflict.end_time)}`;
}

function ActionButton({
  action,
  issue,
  onRunAction,
}: {
  action: LiveScheduleConflictQuickAction;
  issue: ScheduleConflictResolutionIssue;
  onRunAction: Props["onRunAction"];
}) {
  return (
    <button
      type="button"
      onClick={() => onRunAction(issue.conflict, action)}
      className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-2.5 text-[11px] font-bold text-emerald-900 transition hover:bg-emerald-50"
    >
      {action.label}
      <ArrowRight className="size-3.5" />
    </button>
  );
}

function ResolutionGuidance({ issue }: { issue: ScheduleConflictResolutionIssue }) {
  const { conflict } = issue;

  if (conflict.type === "duplicate_schedule_window") {
    const windows = Array.isArray(conflict.debug_metadata.schedule_windows)
      ? conflict.debug_metadata.schedule_windows
      : [];
    return (
      <div className="space-y-2">
        <PanelNote icon={CalendarClock} title="Precise schedule editor">
          Review the affected day and keep only the correct schedule window. Duplicate windows stay as cleanup unless
          they affect booking availability, then they become Must Fix.
        </PanelNote>
        {windows.length > 0 ? (
          <div className="rounded-xl bg-stone-50 p-2 text-[11px] text-[var(--cs-text-secondary)]">
            <p className="font-bold text-[var(--cs-text)]">Overlapping windows</p>
            <div className="mt-1 space-y-1">
              {windows.map((window, index) => {
                if (
                  typeof window !== "object" ||
                  window === null ||
                  !("startTime" in window) ||
                  !("endTime" in window)
                ) {
                  return null;
                }
                return (
                  <p key={`${String(window.startTime)}-${String(window.endTime)}-${index}`}>
                    Window {index + 1}: {String(window.startTime)} - {String(window.endTime)}
                  </p>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  if (conflict.type === "room_double_booked" || conflict.type === "missing_room") {
    return (
      <div className="space-y-2">
        <PanelNote icon={DoorOpen} title="Room / bed selector">
          Assign an eligible room or move the booking using the existing room and availability tools. Unavailable rooms
          should stay disabled when occupied, blocked, wrong branch, not eligible, in setup buffer, or too tight.
        </PanelNote>
        <div className="grid gap-1.5">
          {["Available Room A", "Current room occupied", "Setup buffer too short"].map((label, index) => (
            <div
              key={label}
              className={
                index === 0
                  ? "rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-[11px] font-bold text-emerald-900"
                  : "rounded-xl border border-stone-200 bg-stone-50 px-2.5 py-2 text-[11px] font-semibold text-stone-500"
              }
            >
              {label}
              {index > 0 ? <span className="ml-1 font-medium">- unavailable</span> : null}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (conflict.type === "home_service_travel_buffer_warning") {
    return (
      <div className="space-y-2">
        <PanelNote icon={MapPinned} title="Travel timing panel">
          Review the home-service booking, nearby booking, required buffer, and actual gap before changing time or staff.
        </PanelNote>
        <div className="grid gap-1.5 text-[11px]">
          <Metric label="Required buffer" value={String(conflict.debug_metadata.required_buffer_minutes ?? "Rule")} />
          <Metric label="Actual gap" value={String(conflict.debug_metadata.gap_minutes ?? "Needs review")} />
        </div>
      </div>
    );
  }

  if (conflict.type === "staff_overlap") {
    return (
      <PanelNote icon={UsersRound} title="Staff assignment panel">
        Move one booking or assign one booking to another qualified available staff member. Do not clear this until the
        backend schedule refresh confirms no overlap remains.
      </PanelNote>
    );
  }

  return (
    <PanelNote icon={Wrench} title="Decision panel">
      Move the booking into a safe slot, assign another available qualified staff member, edit the staff schedule for this
      day, or accept only if the issue is approval-level and does not damage availability integrity.
    </PanelNote>
  );
}

function PanelNote({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[var(--cs-border-soft)] bg-white p-3 shadow-sm">
      <div className="flex items-start gap-2">
        <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-800">
          <Icon className="size-3.5" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-bold text-[var(--cs-text)]">{title}</p>
          <p className="mt-1 text-[11px] leading-5 text-[var(--cs-text-secondary)]">{children}</p>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-stone-50 px-2.5 py-2">
      <span className="font-semibold text-[var(--cs-text-muted)]">{label}</span>
      <span className="font-bold text-[var(--cs-text)]">{value}</span>
    </div>
  );
}

export function ScheduleConflictResolutionPanel({
  issue,
  duplicateIssueCount,
  onRunAction,
  onAcceptException,
  onClear,
}: Props) {
  if (!issue) {
    return (
      <aside className="rounded-2xl border border-[var(--cs-border-soft)] bg-white p-4 text-sm text-[var(--cs-text-secondary)] shadow-sm">
        <p className="font-bold text-[var(--cs-text)]">Safe Resolution Panel</p>
        <p className="mt-2 text-xs leading-5">
          Select an issue to review guided options. The panel stays inside the modal and will not make the Schedule page taller.
        </p>
      </aside>
    );
  }

  const impactCopy = getImpactGroupCopy(issue.impactGroup);

  return (
    <aside className="sticky top-0 max-h-[calc(85vh-11rem)] overflow-y-auto rounded-2xl border border-[var(--cs-border)] bg-[#fffdf8] p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--cs-text-muted)]">
            Safe Resolution Panel
          </p>
          <h3 className="mt-1 text-sm font-bold text-[var(--cs-text)]">
            {getConflictTypeLabel(issue.conflict.type)}
          </h3>
          <p className="mt-1 text-[11px] font-semibold text-[var(--cs-text-muted)]">
            {impactCopy.label} · {issue.operationalImpact} operational impact
          </p>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-stone-100 text-[var(--cs-text-muted)] transition hover:bg-stone-200 hover:text-[var(--cs-text)]"
        >
          <X className="size-3.5" />
          <span className="sr-only">Clear selected issue</span>
        </button>
      </div>

      <div className="mt-3 space-y-3">
        <div className="rounded-2xl border border-stone-200 bg-white p-3 text-[11px] leading-5 text-[var(--cs-text-secondary)]">
          <Metric label="Staff" value={issue.conflict.affected_staff_names.join(", ") || "Not staff-specific"} />
          <div className="mt-1.5" />
          <Metric label="Time" value={formatConflictTime(issue.conflict)} />
          {issue.conflict.affected_resource_name ? (
            <>
              <div className="mt-1.5" />
              <Metric label="Room/resource" value={issue.conflict.affected_resource_name} />
            </>
          ) : null}
        </div>

        <ResolutionGuidance issue={issue} />

        {issue.conflict.type === "duplicate_schedule_window" && duplicateIssueCount > 1 ? (
          <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-3 text-yellow-950">
            <p className="text-xs font-bold">Bulk review duplicate windows</p>
            <p className="mt-1 text-[11px] leading-5">
              {duplicateIssueCount} duplicate-window issues are visible. Review affected staff, preview recommended cleanup,
              and apply only selected safe fixes in the schedule editor.
            </p>
          </div>
        ) : null}

        <ScheduleConflictSafePreview issue={issue} />

        <div className="sticky bottom-0 rounded-2xl border border-[var(--cs-border-soft)] bg-white p-3 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--cs-text-muted)]">
            Actions
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {issue.conflict.quick_actions.map((action, index) => (
              <ActionButton
                key={`${issue.conflict.id}-${action.intent}-${action.bookingId ?? "none"}-${index}`}
                issue={issue}
                action={action}
                onRunAction={onRunAction}
              />
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
        </div>
      </div>
    </aside>
  );
}
