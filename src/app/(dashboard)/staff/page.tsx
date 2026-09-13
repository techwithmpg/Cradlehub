import { redirect } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { getMyProfileAction } from "../staff-portal/actions";
import { getPureAttendanceSnapshot } from "@/lib/staff-portal/attendance";
import {
  resolveStaffOperationalRole,
  resolveNavigationProfile,
} from "@/components/features/staff-pwa/role-navigation";
import { GeneralStaffMobileHome } from "@/components/features/staff-portal/basic/general-staff-mobile-home";
import { TherapistMobileHome } from "@/components/features/staff-portal/therapist/therapist-mobile-home";
import { TherapistHeader } from "@/components/features/staff-portal/therapist/therapist-header";
import { getProviderWorkspaceRuntime } from "@/lib/staff-pwa/provider-runtime";
import StaffTodayPage from "../staff-portal/page";

export default async function StaffPage() {
  const profileResult =
    await getMyProfileAction().catch(() => null);

  const staff =
    profileResult && "staff" in profileResult
      ? profileResult.staff
      : null;

  if (staff) {
    const opRole = resolveStaffOperationalRole({
      system_role: staff.system_role,
      staff_type: staff.staff_type,
    });

    const profile = resolveNavigationProfile(opRole);

    if (profile === "driver") {
      redirect("/staff/driver");
    }

    if (profile === "utility") {
      redirect("/staff/utility");
    }

    if (profile === "provider") {
      const runtimeResult = await getProviderWorkspaceRuntime().catch(() => null);

      if (runtimeResult && runtimeResult.ok) {
        return <TherapistMobileHome runtime={runtimeResult.runtime} />;
      }

      if (runtimeResult && !runtimeResult.ok && runtimeResult.code === "UNAUTHORIZED") {
        redirect("/login");
      }

      return (
        <div className="min-h-dvh bg-[#F7F3EB] text-[#142334]">
          <TherapistHeader staff={staff} />
          <main className="mx-auto flex w-full max-w-[480px] flex-col gap-3 px-3.5 pb-5 pt-3">
            <section className="rounded-[22px] border border-[#F1D2CE] bg-[#FFF8F7] px-4 py-5 shadow-[0_6px_24px_rgba(180,35,24,0.05)]">
              <div className="flex items-center gap-3">
                <div className="grid size-10 shrink-0 place-items-center rounded-full bg-[#FCE8E6] text-[#B42318]">
                  <AlertCircle size={20} className="text-[#B42318]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-medium text-[#7D241E]">
                    Provider Workspace
                  </div>
                  <div className="mt-0.5 text-[16px] font-bold text-[#912018]">
                    Workspace unavailable
                  </div>
                  <div className="mt-1 text-[12px] text-[#A6372E]">
                    {runtimeResult && !runtimeResult.ok
                      ? runtimeResult.error
                      : "Could not load provider operational data."}
                  </div>
                </div>
              </div>
            </section>
          </main>
        </div>
      );
    }

    if (profile === "crm_general") {
      const attendanceData =
        await getPureAttendanceSnapshot(30).catch(() => null);

      return (
        <GeneralStaffMobileHome
          staff={staff}
          profile="crm_general"
          attendanceData={attendanceData}
        />
      );
    }
  }

  return <StaffTodayPage />;
}