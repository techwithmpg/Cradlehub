import { Search } from "lucide-react";
import type {
  LiveScheduleConflict,
  LiveScheduleConflictQuickAction,
} from "@/lib/schedule/live-schedule-conflict-types";
import type { ScheduleConflictResolutionIssue } from "./schedule-conflict-center-model";
import { ScheduleConflictIssueCard } from "./schedule-conflict-issue-card";

type Props = {
  issues: ScheduleConflictResolutionIssue[];
  query: string;
  selectedIssueId: string | null;
  onQueryChange: (query: string) => void;
  onIssueSelect: (issue: ScheduleConflictResolutionIssue) => void;
  onAcceptException: (issue: ScheduleConflictResolutionIssue) => void;
  onActionSelect: (
    conflict: LiveScheduleConflict,
    action: LiveScheduleConflictQuickAction
  ) => void;
};

export function ScheduleConflictIssueList({
  issues,
  query,
  selectedIssueId,
  onQueryChange,
  onIssueSelect,
  onAcceptException,
  onActionSelect,
}: Props) {
  return (
    <section className="min-w-0 space-y-3">
      <div className="sticky top-0 z-10 rounded-2xl border border-[var(--cs-border-soft)] bg-white/95 p-2 shadow-sm backdrop-blur">
        <label className="flex min-h-9 items-center gap-2 rounded-xl bg-stone-50 px-3 text-xs text-[var(--cs-text-muted)]">
          <Search className="size-3.5" />
          <span className="sr-only">Search schedule issues</span>
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search staff, room, booking, issue type..."
            className="min-w-0 flex-1 bg-transparent text-xs font-semibold text-[var(--cs-text)] outline-none placeholder:text-[var(--cs-text-muted)]"
          />
        </label>
      </div>

      {issues.length === 0 ? (
        <div className="rounded-2xl border border-[var(--cs-border-soft)] bg-white p-6 text-center text-[var(--cs-text-secondary)] shadow-sm">
          <h3 className="text-sm font-bold text-[var(--cs-text)]">No issues in this view.</h3>
          <p className="mt-1 text-xs">
            Try another tab or search term to continue reviewing schedule issues.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {issues.map((issue) => (
            <ScheduleConflictIssueCard
              key={issue.conflict.id}
              issue={issue}
              selected={selectedIssueId === issue.conflict.id}
              onSelect={onIssueSelect}
              onAcceptException={onAcceptException}
              onActionSelect={onActionSelect}
            />
          ))}
        </div>
      )}
    </section>
  );
}
