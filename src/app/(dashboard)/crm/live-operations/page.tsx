import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isDevAuthBypassEnabled, getDevBypassLayoutStaff } from "@/lib/dev-bypass";
import { getActiveTripsForOpsMap } from "@/lib/actions/live-ops-actions";
import { LiveOpsPage } from "@/components/features/ops-map/live-ops-page";
import { CrmTabNav, DISPATCH_TABS } from "@/components/features/crm/crm-tab-nav";

export const dynamic = "force-dynamic";

async function getCrmContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("staff")
    .select("branch_id, branches(name), system_role")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  const allowedRoles = [
    "owner",
    "manager",
    "assistant_manager",
    "store_manager",
    "crm",
    "csr",
    "csr_head",
    "csr_staff",
  ];

  if (!me && isDevAuthBypassEnabled()) {
    const mock = getDevBypassLayoutStaff();
    return { branchName: mock.branches.name };
  }

  if (!me || !me.branch_id || !allowedRoles.includes(me.system_role)) redirect("/login");

  return {
    branchName: (me.branches as { name: string } | null)?.name ?? "Your Branch",
  };
}

export default async function CrmLiveOperationsPage() {
  const { branchName } = await getCrmContext();
  const initialTrips = await getActiveTripsForOpsMap();

  const todayLabel = new Date().toLocaleDateString("en-PH", {
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
        controlPath="/crm/control"
      />
    </>
  );
}
