import { getMyDriverJobByIdAction } from "../../actions";
import { DriverJobDetailsPage } from "@/components/features/staff-portal/driver/driver-job-details-page";
import type { RealDispatchItem } from "@/lib/queries/dispatch-queries";

type JobResult =
  | { error: string }
  | { job: RealDispatchItem & { durationMinutes: number | null; notes: string | null } };

export default async function StaffJobDetailPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = await params;
  const result = (await getMyDriverJobByIdAction(bookingId)) as JobResult;

  if ("error" in result) {
    return (
      <div style={{ padding: "2rem", textAlign: "center", color: "var(--cs-text-muted)", fontSize: "0.875rem" }}>
        {result.error === "Unauthorized" ? "You are not authorized to view this job." : result.error}
      </div>
    );
  }

  return <DriverJobDetailsPage job={result.job} />;
}
