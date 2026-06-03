import { getMyDriverAllJobsAction } from "../actions";
import { DriverJobsListPage } from "@/components/features/staff-portal/driver/driver-jobs-list-page";
import type { RealDispatchItem } from "@/lib/queries/dispatch-queries";

type AllJobsResult =
  | { error: string }
  | { today: RealDispatchItem[]; recent: RealDispatchItem[] };

export default async function StaffJobsPage() {
  const result = (await getMyDriverAllJobsAction()) as AllJobsResult;

  const today = "error" in result ? [] : result.today;
  const recent = "error" in result ? [] : result.recent;

  return <DriverJobsListPage today={today} recent={recent} />;
}
