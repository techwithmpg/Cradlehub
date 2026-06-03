import { getMyDriverJobsAction } from "../actions";
import { DriverRouteMapPage } from "@/components/features/staff-portal/driver/driver-route-map-page";
import type { RealDispatchItem } from "@/lib/queries/dispatch-queries";

type JobsResult = { error: string } | { items: RealDispatchItem[] };

export default async function StaffMapPage() {
  const today = new Date().toISOString().split("T")[0]!;
  const result = (await getMyDriverJobsAction(today)) as JobsResult;

  const items = "error" in result ? [] : result.items;

  return <DriverRouteMapPage items={items} />;
}
