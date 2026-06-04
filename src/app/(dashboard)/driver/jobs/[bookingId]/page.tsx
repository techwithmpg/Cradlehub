import { redirect } from "next/navigation";
import { getMyDriverJobByIdAction } from "../../../staff-portal/actions";
import { DriverJobDetailsPage } from "@/components/features/staff-portal/driver/driver-job-details-page";
import type { RealDispatchItem } from "@/lib/queries/dispatch-queries";

type JobResult =
  | { error: string }
  | { job: RealDispatchItem & { durationMinutes: number | null; notes: string | null } };

export default async function DriverJobDetailRoutePage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = await params;
  const result = (await getMyDriverJobByIdAction(bookingId)) as JobResult;

  if ("error" in result && result.error === "Unauthorized") redirect("/login");

  if ("error" in result) {
    return (
      <div className="mx-auto max-w-[480px] px-4 py-10 text-center text-sm font-semibold text-stone-500">
        {result.error}
      </div>
    );
  }

  return <DriverJobDetailsPage job={result.job} backHref="/driver/jobs" />;
}
