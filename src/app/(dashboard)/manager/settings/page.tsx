import { redirect } from "next/navigation";
import { PageHeader } from "@/components/features/dashboard/page-header";
import { BranchBookingRulesForm } from "@/app/(dashboard)/owner/branches/[branchId]/branch-booking-rules-form";
import { BranchServicesPanel } from "@/app/(dashboard)/owner/branches/[branchId]/branch-services-panel";
import { getMyBranchBookingRulesAction } from "@/app/(dashboard)/owner/branches/actions";
import { createClient } from "@/lib/supabase/server";
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

  return (
    <div>
      <PageHeader
        title="Branch Settings"
        description="Manage booking rules and service availability for your branch"
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "1.5rem",
          alignItems: "start",
        }}
      >
        <BranchBookingRulesForm rules={rules} />

        <BranchServicesPanel
          branchId={branchId}
          services={services as ServiceLite[]}
          allServices={allServices}
          isOwner={false}
        />
      </div>
    </div>
  );
}
