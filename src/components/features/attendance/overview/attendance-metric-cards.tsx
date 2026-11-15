import { AlertTriangle, CheckCircle2, Clock3, UsersRound } from "lucide-react";
import { CrmStatCard } from "@/components/features/crm/shared/crm-cards";
import type { AttendanceOverviewSummary } from "@/lib/attendance/overview-summary";

export function AttendanceMetricCards({ summary }: { summary: AttendanceOverviewSummary }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <CrmStatCard
        title="On duty"
        value={summary.onDuty}
        subtitle="Currently working"
        icon={<UsersRound className="size-4.5" aria-hidden="true" />}
        tone="success"
      />
      <CrmStatCard
        title="Not in yet"
        value={summary.notInYet}
        subtitle="Expected today"
        icon={<Clock3 className="size-4.5" aria-hidden="true" />}
        tone="warning"
      />
      <CrmStatCard
        title="Completed"
        value={summary.completed}
        subtitle="Finished shifts"
        icon={<CheckCircle2 className="size-4.5" aria-hidden="true" />}
        tone="info"
      />
      <CrmStatCard
        title="Needs review"
        value={summary.reviewItems}
        subtitle={`${summary.needsReviewStaff} staff affected`}
        icon={<AlertTriangle className="size-4.5" aria-hidden="true" />}
        tone="danger"
      />
    </div>
  );
}
