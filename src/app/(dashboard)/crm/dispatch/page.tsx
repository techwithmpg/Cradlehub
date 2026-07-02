export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { HomeServiceDispatchWorkspace } from "@/components/features/dispatch/dispatch-workspace";
import { getDispatchData } from "@/lib/queries/dispatch-queries";
import { logInfo } from "@/lib/logger";
import { CrmTabNav, DISPATCH_TABS } from "@/components/features/crm/crm-tab-nav";
import { getFrontDeskContext } from "@/lib/queries/crm-context";
import { getBranchBusinessDate } from "@/lib/engine/slot-time";

export const metadata: Metadata = { title: "Home Service Dispatch — CRM" };

export default async function CrmDispatchPage() {
  const { role, branchId } = await getFrontDeskContext();
  const today = getBranchBusinessDate();
  const data = await getDispatchData({ branchId, date: today });

  logInfo("dispatch.queue.loaded", {
    role,
    branchId,
    date: today,
    count: data.items.length,
  });

  return (
    <>
      <CrmTabNav tabs={DISPATCH_TABS} activeHref="/crm/dispatch" />
      <HomeServiceDispatchWorkspace role="crm" data={data} />
    </>
  );
}
