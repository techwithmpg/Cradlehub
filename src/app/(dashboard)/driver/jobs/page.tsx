import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getMyDriverAllJobsAction } from "../../staff-portal/actions";
import { DriverJobsPage } from "@/components/features/staff-portal/driver/jobs/driver-jobs-page";
import type { RealDispatchItem } from "@/lib/queries/dispatch-queries";

export const metadata: Metadata = { title: "Jobs - Driver" };

type AllJobsResult =
  | { error: string }
  | { today: RealDispatchItem[]; recent: RealDispatchItem[] };

export default async function DriverJobsRoutePage() {
  const result = (await getMyDriverAllJobsAction()) as AllJobsResult;
  const todayISO = new Date().toISOString().split("T")[0]!;

  if ("error" in result && result.error === "Unauthorized") redirect("/login");

  return (
    <DriverJobsPage
      today={"error" in result ? [] : result.today}
      recent={"error" in result ? [] : result.recent}
      detailsBasePath="/driver/jobs"
      tripsHref="/driver/dispatch"
      todayISO={todayISO}
      loadError={"error" in result}
    />
  );
}
