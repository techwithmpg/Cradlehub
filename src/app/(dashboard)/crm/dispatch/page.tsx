export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { CrmOperationalPageShell } from "@/components/features/crm/operational/crm-operational-page-shell";
import { HomeServiceDispatchWorkspace } from "@/components/features/dispatch/dispatch-workspace";
import { getDispatchData } from "@/lib/queries/dispatch-queries";
import { logInfo } from "@/lib/logger";
import { getFrontDeskContext } from "@/lib/queries/crm-context";
import { getBranchBusinessDate } from "@/lib/engine/slot-time";

export const metadata: Metadata = { title: "Home Service Operations — CRM" };

export default async function CrmDispatchPage() {
  const { role, branchId, branchName } = await getFrontDeskContext();
  const today = getBranchBusinessDate();
  const data = await getDispatchData({ branchId, date: today });

  logInfo("dispatch.queue.loaded", {
    role,
    branchId,
    date: today,
    count: data.items.length,
  });

  return (
    <CrmOperationalPageShell
      title="Home Service Operations"
      description="Monitor home-service bookings, assignments, customer locations, and travel progress."
      context={`${branchName} · ${today} · ${role} view`}
    >
      <HomeServiceDispatchWorkspace role="crm" data={data} showHeader={false} />
    </CrmOperationalPageShell>
  );
}
