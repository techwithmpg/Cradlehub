import { AlertTriangle, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Panel,
  StaffAvatar,
  StatusPill,
  formatAttendanceDateTime,
  humanizeAttendanceValue,
} from "@/components/features/attendance/attendance-ui";
import { getAttendanceIssueRecommendation } from "@/lib/attendance/overview-summary";
import type { AttendanceTab, AttendanceWorkspaceData } from "@/lib/attendance/types";

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  warning: 2,
  medium: 2,
  low: 3,
};

export function NeedsAttentionPanel({
  data,
  onTabChange,
}: {
  data: AttendanceWorkspaceData;
  onTabChange: (tab: AttendanceTab) => void;
}) {
  const openExceptions = data.exceptions
    .filter((exception) => exception.status === "open")
    .sort((first, second) => {
      const severityDifference =
        (SEVERITY_ORDER[first.severity] ?? 4) - (SEVERITY_ORDER[second.severity] ?? 4);
      if (severityDifference !== 0) return severityDifference;
      return new Date(second.detected_at).getTime() - new Date(first.detected_at).getTime();
    });

  return (
    <Panel
      title="Needs attention"
      description={
        openExceptions.length > 0
          ? `${openExceptions.length} ${openExceptions.length === 1 ? "item" : "items"} waiting for CRM`
          : "No unresolved attendance issues"
      }
      action={
        openExceptions.length > 0 ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => onTabChange("exceptions")}>
            View all
          </Button>
        ) : null
      }
    >
      {openExceptions.length === 0 ? (
        <div className="flex items-start gap-3 rounded-[var(--cs-r-md)] border border-[var(--cs-success)]/20 bg-[var(--cs-success-bg)] p-4">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--cs-surface)] text-[var(--cs-success-text)] shadow-[var(--cs-shadow-xs)]">
            <CheckCircle2 className="size-5" />
          </span>
          <div>
            <div className="font-semibold text-[var(--cs-success-text)]">Attendance is clear</div>
            <p className="m-0 mt-1 text-xs text-[var(--cs-text-secondary)]">
              New uncertain scans and corrections will appear here automatically.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-0">
          {openExceptions.slice(0, 3).map((exception, index) => (
            <article
              key={exception.id}
              className={`py-4 ${index > 0 ? "border-t border-[var(--cs-border-soft)]" : "pt-1"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <StaffAvatar name={exception.staff_name ?? "Unassigned scan"} />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold text-[var(--cs-text)]">
                      {exception.staff_name ?? "Unassigned scan"}
                    </div>
                    <div className="mt-0.5 truncate text-xs text-[var(--cs-text-muted)]">
                      {formatAttendanceDateTime(exception.detected_at, data.timezone)} ·{" "}
                      {data.branchName}
                    </div>
                  </div>
                </div>
                <StatusPill
                  value={humanizeAttendanceValue(exception.exception_type)}
                  tone={exception.severity === "critical" ? "bad" : "warn"}
                />
              </div>

              <div className="mt-3 rounded-[var(--cs-r-md)] bg-[var(--cs-surface-warm)] p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[var(--cs-warning-text)]" />
                  <div className="min-w-0">
                    <p className="m-0 line-clamp-2 text-xs text-[var(--cs-text-secondary)]">
                      {exception.message}
                    </p>
                    <p className="m-0 mt-2 text-xs font-semibold text-[var(--cs-text)]">
                      Recommended
                    </p>
                    <p className="m-0 mt-0.5 line-clamp-2 text-xs text-[var(--cs-text-secondary)]">
                      {getAttendanceIssueRecommendation(exception)}
                    </p>
                  </div>
                </div>
              </div>

              <Button
                type="button"
                size="sm"
                onClick={() => onTabChange("exceptions")}
                className="mt-3 bg-[var(--cs-crm-accent)] text-white hover:bg-[var(--cs-crm-text)]"
              >
                Open fix
                <ArrowRight data-icon="inline-end" />
              </Button>
            </article>
          ))}
        </div>
      )}

      {openExceptions.length > 3 ? (
        <button
          type="button"
          onClick={() => onTabChange("exceptions")}
          className="flex w-full items-center justify-between border-t border-[var(--cs-border-soft)] pt-3 text-sm font-semibold text-[var(--cs-crm-text)]"
        >
          View {openExceptions.length - 3} more in Review Queue
          <ArrowRight className="size-4" />
        </button>
      ) : null}
    </Panel>
  );
}
