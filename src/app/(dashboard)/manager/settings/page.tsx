import { redirect } from "next/navigation";
import { ManagerSettingsWorkspace } from "@/components/features/manager-settings/manager-settings-workspace";
import { getMyBranchBookingRulesAction } from "@/app/(dashboard)/owner/branches/actions";
import { createClient } from "@/lib/supabase/server";
import { ensureBranchSetupWarningNotifications } from "@/lib/notifications/setup-warnings";
import { getSchedulingRules } from "@/lib/scheduling/rules/get-scheduling-rules";
import type { GlobalService, ServiceLite } from "@/app/(dashboard)/owner/branches/[branchId]/branch-services-panel";

async function getAllActiveServices(): Promise<GlobalService[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("services")
    .select("id, name, duration_minutes, price")
    .eq("is_active", true)
    .order("name");
  return (data ?? []) as GlobalService[];
}

export default async function ManagerSettingsPage() {
  const [result, allServices] = await Promise.all([
    getMyBranchBookingRulesAction(),
    getAllActiveServices(),
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
