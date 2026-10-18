import { redirect } from "next/navigation";
import { canAccessCanonicalUtility } from "@/lib/auth/workspace-access";
import { UtilityMobileHome } from "@/components/features/staff-pwa/utility/utility-mobile-home";



const UTILITY_DESTINATIONS = [
  "/staff/utility/work",
  "/staff/utility/rooms",
  "/staff/scan",
  "/staff/utility/notices",
  "/staff/utility/more",
] as const;

export default async function CanonicalUtilityPage() {
  void UTILITY_DESTINATIONS;

  const { getUtilityWorkspaceRuntime } = await import("@/lib/staff-pwa/utility-runtime");

  const runtime = await getUtilityWorkspaceRuntime({ includeAttendance: true });

  if (!runtime) {
    redirect("/staff");
  }

  if (!canAccessCanonicalUtility(runtime.staff.system_role, runtime.staff.staff_type)) {
    redirect("/staff");
  }

  return <UtilityMobileHome runtime={runtime} />;
}
