import { redirect } from "next/navigation";
import { ManagerSettingsWorkspace } from "@/components/features/manager-settings/manager-settings-workspace";
import { getMyBranchBookingRulesAction } from "@/app/(dashboard)/owner/branches/actions";
import { ensureBranchSetupWarningNotifications } from "@/lib/notifications/setup-warnings";
import { getSchedulingRules } from "@/lib/scheduling/rules/get-scheduling-rules";
import { getMasterServiceCatalog } from "@/lib/services/service-catalog";
import type { GlobalService, ServiceLite } from "@/app/(dashboard)/owner/branches/[branchId]/branch-services-panel";

export default async function ManagerSettingsPage() {
  const [result, allServices] = await Promise.all([
    getMyBranchBookingRulesAction(),
    getMasterServiceCatalog() as Promise<GlobalService[]>,
  ]);

  if ("error" in result) redirect("/manager");

  const { branchId, rules, services } = result;
  await ensureBranchSetupWarningNotifications(branchId);

  const schedulingRules = await getSchedulingRules(branchId);

  return (
    <ManagerSettingsWorkspace
      branchId={branchId}
      bookingRules={rules}
      services={services as ServiceLite[]}
      allServices={allServices}
      schedulingRules={schedulingRules}
    />
  );
}
