import { getFrontDeskContext } from "@/lib/queries/crm-context";
import { getActiveTripsForOpsMap } from "@/lib/actions/live-ops-actions";
import { LiveOpsPage } from "@/components/features/ops-map/live-ops-page";
import { CrmTabNav, DISPATCH_TABS } from "@/components/features/crm/crm-tab-nav";
import { getBranchBusinessDate } from "@/lib/engine/slot-time";

export const dynamic = "force-dynamic";

export default async function CrmLiveOperationsPage() {
  const { branchName } = await getFrontDeskContext();
  const initialTrips = await getActiveTripsForOpsMap();

  const businessDate = getBranchBusinessDate();
  const todayLabel = new Date(`${businessDate}T00:00:00`).toLocaleDateString("en-PH", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <>
      <CrmTabNav tabs={DISPATCH_TABS} activeHref="/crm/live-operations" />
      <LiveOpsPage
        branchName={branchName}
        todayLabel={todayLabel}
        initialTrips={initialTrips}
        controlPath="/crm/today?filter=exceptions"
      />
    </>
  );
}
