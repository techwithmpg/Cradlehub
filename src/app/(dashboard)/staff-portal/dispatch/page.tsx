export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { HomeServiceDispatchWorkspace } from "@/components/features/dispatch/dispatch-workspace";
import { DriverTripsPage } from "@/components/features/staff-portal/driver/trips/driver-trips-page";
import { getDispatchData } from "@/lib/queries/dispatch-queries";
import { isDevAuthBypassEnabled } from "@/lib/dev-bypass";
import { logInfo } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import { getMyDriverAllJobsAction } from "../actions";

export const metadata: Metadata = { title: "Trips - Staff Portal" };

const DRIVER_ROLES = ["driver"];
const SERVICE_ROLES = ["owner", "manager", "service_head", "service_staff", "staff"];

async function getRecentDriverTrips() {
  const result = await getMyDriverAllJobsAction().catch(() => null);
  return result && "recent" in result ? result.recent : [];
}

export default async function StaffDispatchPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const emptyData = {
    items: [],
    stats: { totalToday: 0, awaitingDispatch: 0, activeTrips: 0, completedToday: 0, cancelledToday: 0 },
    alerts: [],
    today: new Date().toISOString().split("T")[0]!,
  };

  if (!user) {
    if (isDevAuthBypassEnabled()) {
      return <HomeServiceDispatchWorkspace role="therapist" data={emptyData} />;
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
      return <HomeServiceDispatchWorkspace role="therapist" data={emptyData} />;
    }
    redirect("/login");
  }

  if (!me.branch_id) redirect("/login");

  const staffType = (me as { staff_type?: string | null }).staff_type ?? null;
  const isDriver = me.system_role === "driver" || staffType === "driver";
  const today = new Date().toISOString().split("T")[0]!;

  if (isDriver) {
    // Driver: show driver-specific dispatch page
    const data = await getDispatchData({
      branchId: me.branch_id,
      date: today,
      role: "driver",
      staffId: me.id,
    });

    logInfo("dispatch.driver.loaded", { staffId: me.id, branchId: me.branch_id, date: today, count: data.items.length });
    const history = await getRecentDriverTrips();

    return (
      <>
        {/* Mobile: driver trips UI */}
        <div className="block md:hidden">
          <DriverTripsPage todayItems={data.items} historyItems={history} />
        </div>
        {/* Desktop: existing workspace */}
        <div className="hidden md:block">
          <HomeServiceDispatchWorkspace role="therapist" data={data} />
        </div>
      </>
    );
  }

  // Non-driver (therapist/manager): use existing dispatch workspace
  if (!SERVICE_ROLES.includes(me.system_role) && !DRIVER_ROLES.includes(me.system_role)) {
    redirect("/driver");
  }

  const data = await getDispatchData({
    branchId: me.branch_id,
    date: today,
    role: "therapist",
    staffId: me.id,
  });

  logInfo("dispatch.queue.loaded", { role: me.system_role, branchId: me.branch_id, date: today, count: data.items.length });

  return <HomeServiceDispatchWorkspace role="therapist" data={data} />;
}
