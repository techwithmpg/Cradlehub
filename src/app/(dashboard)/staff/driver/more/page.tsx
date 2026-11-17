import { redirect } from "next/navigation";
import { DriverMoreContent } from "@/components/features/staff-pwa/driver/driver-more-content";
import { getMyProfileAction } from "@/app/(dashboard)/staff-portal/actions";
import { resolveStaffPwaOperationalGroup } from "@/lib/auth/workspace-access";

export const metadata = { title: "More | CradleHub Driver" };

async function driverLogoutAction() {
  "use server";
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    if (process.env.CRADLEHUB_DRIVER_JOURNEYS_ENABLED === "true") {
      try {
        await supabase.rpc("driver_native_revoke_session" as never);
      } catch {
        /* Auth sign-out still revokes the server session. */
      }
    }
    await supabase.auth.signOut();
  }
  redirect("/staff/login");
}

export default async function StaffDriverMorePage() {
  const result = await getMyProfileAction();
  if (
    !("staff" in result) ||
    !result.staff ||
    resolveStaffPwaOperationalGroup(result.staff.system_role, result.staff.staff_type) !== "driver"
  ) {
    redirect("/staff/");
  }
  return <DriverMoreContent staff={result.staff} logoutAction={driverLogoutAction} />;
}
