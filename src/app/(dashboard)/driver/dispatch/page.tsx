export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { HomeServiceDispatchWorkspace } from "@/components/features/dispatch/dispatch-workspace";
import { getDispatchData } from "@/lib/queries/dispatch-queries";
import { isDevAuthBypassEnabled } from "@/lib/dev-bypass";
import { logInfo } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Home Service Dispatch - Driver" };

export default async function DriverDispatchPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    if (isDevAuthBypassEnabled()) {
      const empty = { items: [], stats: { totalToday: 0, awaitingDispatch: 0, activeTrips: 0, completedToday: 0, cancelledToday: 0 }, alerts: [], today: new Date().toISOString().split("T")[0]! };
      return <HomeServiceDispatchWorkspace role="driver" data={empty} />;
    }
    redirect("/login");
  }

  const { data: me } = await supabase
    .from("staff")
    .select("id, system_role, staff_type, branch_id")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!me) {
    if (isDevAuthBypassEnabled()) {
      const empty = { items: [], stats: { totalToday: 0, awaitingDispatch: 0, activeTrips: 0, completedToday: 0, cancelledToday: 0 }, alerts: [], today: new Date().toISOString().split("T")[0]! };
      return <HomeServiceDispatchWorkspace role="driver" data={empty} />;
    }
    redirect("/login");
  }

  if (me.system_role !== "owner" && me.system_role !== "driver" && me.staff_type !== "driver") {
    redirect("/staff-portal");
  }

  if (!me.branch_id) redirect("/login");

  const today = new Date().toISOString().split("T")[0]!;
  const data = await getDispatchData({
    branchId: me.branch_id,
    date: today,
    role: "driver",
    staffId: me.id,
  });

  logInfo("dispatch.queue.loaded", {
    role: me.system_role,
    branchId: me.branch_id,
    date: today,
    count: data.items.length,
  });

  return <HomeServiceDispatchWorkspace role="driver" data={data} />;
}
