import { redirect } from "next/navigation";
import { resolveStaffPwaOperationalGroup } from "@/lib/auth/workspace-access";
import { UtilityMobileHome } from "@/components/features/staff-pwa/utility/utility-mobile-home";

export function canAccessCanonicalUtility(
  role: string | null | undefined,
  staffType?: string | null | undefined
): boolean {
  return (
    resolveStaffPwaOperationalGroup(
      role,
      staffType
    ) === "utility"
  );
}

const UTILITY_DESTINATIONS = [
  "/staff/utility/work",
  "/staff/scan",
  "/staff/utility/notices",
  "/staff/utility/more",
] as const;

export default async function CanonicalUtilityPage() {
  void UTILITY_DESTINATIONS;

  const {
    getUtilityWorkspaceRuntime,
  } = await import(
    "@/lib/staff-pwa/utility-runtime"
  );

  const today =
    new Date().toISOString().slice(0, 10);

  const runtime =
    await getUtilityWorkspaceRuntime(today);

  if (!runtime) {
    redirect("/staff");
  }

  if (
    !canAccessCanonicalUtility(
      runtime.staff.system_role,
      runtime.staff.staff_type
    )
  ) {
    redirect("/staff");
  }

  return (
    <UtilityMobileHome runtime={runtime} />
  );
}