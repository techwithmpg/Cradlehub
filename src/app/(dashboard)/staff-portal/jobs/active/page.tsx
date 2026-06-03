import { getMyDriverJobsAction } from "../../actions";
import { DriverActiveJobPage } from "@/components/features/staff-portal/driver/driver-active-job-page";
import type { RealDispatchItem, DispatchStats } from "@/lib/queries/dispatch-queries";

type JobsResult =
  | { error: string }
  | { items: RealDispatchItem[]; stats: DispatchStats };

function findActiveJob(items: RealDispatchItem[]): RealDispatchItem | null {
  // Prefer the one currently in_route or arrived
  const inProgress = items.find((i) =>
    ["in_route", "arrived_at_customer", "service_started"].includes(i.dispatchStatus)
  );
  if (inProgress) return inProgress;
  // Fall back to the first non-completed/cancelled job
  return (
    items.find((i) => !["completed", "cancelled"].includes(i.dispatchStatus)) ?? null
  );
}

export default async function StaffActiveJobPage() {
  const today = new Date().toISOString().split("T")[0]!;
  const result = (await getMyDriverJobsAction(today)) as JobsResult;

  if ("error" in result) {
    return (
      <div style={{ padding: "2rem", textAlign: "center", color: "var(--cs-text-muted)", fontSize: "0.875rem" }}>
        {result.error}
      </div>
    );
  }

  const activeJob = findActiveJob(result.items);

  if (!activeJob) {
    return (
      <div style={{ padding: "2rem", textAlign: "center", color: "var(--cs-text-muted)", fontSize: "0.875rem" }}>
        No active job found. Check back when a job is dispatched.
      </div>
    );
  }

  return <DriverActiveJobPage job={activeJob} />;
}
