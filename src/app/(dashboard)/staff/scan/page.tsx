import Link from "next/link";
import { ArrowLeft, QrCode, ShieldAlert } from "lucide-react";
import { StaffAppShell } from "@/components/features/staff-pwa/app-shell";
import { getMyProfileAction } from "../../staff-portal/actions";
import {
  resolveNavigationProfile,
  resolveStaffOperationalRole,
} from "@/components/features/staff-pwa/role-navigation";
import { StaffRoleResolutionSplash } from "@/components/features/staff-pwa/role-resolution-splash";

export const metadata = {
  title: "Scan Code | CradleHub Staff",
};

export default async function StaffScanPage() {
  const profileResult = await getMyProfileAction().catch(() => null);
  const staff = profileResult && "staff" in profileResult ? profileResult.staff : null;

  if (!staff) {
    return <StaffRoleResolutionSplash />;
  }

  const opRole = resolveStaffOperationalRole({
    system_role: staff.system_role,
    staff_type: staff.staff_type,
  });
  const profile = resolveNavigationProfile(opRole);

  const returnHref =
    profile === "driver"
      ? "/staff/driver"
      : profile === "utility"
        ? "/staff/utility"
        : "/staff";

  return (
    <StaffAppShell
      staff={staff}
      profileOverride={profile}
      pageTitle="Scan Code"
      backHref={returnHref}
      activeNavKey="scan"
      hideNav={false}
    >
      <div className="flex flex-col items-center justify-center py-6 text-center">
        {/* Viewfinder Frame Placeholder */}
        <div className="relative mb-6 flex h-64 w-64 items-center justify-center rounded-3xl border-2 border-dashed border-[#C8A96B] bg-white p-6 shadow-sm">
          {/* Corner Markers */}
          <div className="absolute left-3 top-3 h-5 w-5 border-l-3 border-t-3 border-[#163A2B]" aria-hidden="true" />
          <div className="absolute right-3 top-3 h-5 w-5 border-r-3 border-t-3 border-[#163A2B]" aria-hidden="true" />
          <div className="absolute bottom-3 left-3 h-5 w-5 border-b-3 border-l-3 border-[#163A2B]" aria-hidden="true" />
          <div className="absolute bottom-3 right-3 h-5 w-5 border-b-3 border-r-3 border-[#163A2B]" aria-hidden="true" />

          <div className="flex flex-col items-center gap-3 text-[#163A2B]">
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#163A2B]/10 text-[#163A2B]">
              <QrCode size={36} aria-hidden="true" />
            </span>
            <span className="text-xs font-semibold text-[#1E293B]">
              Camera Scanner Seam
            </span>
          </div>
        </div>

        {/* Stage Boundary Disclosure */}
        <div className="mb-6 w-full max-w-md rounded-2xl border border-[#EAE4DC] bg-white p-5 text-left shadow-xs">
          <div className="flex items-center gap-2 mb-2 text-[#163A2B]">
            <ShieldAlert size={18} className="text-[#C8A96B]" aria-hidden="true" />
            <h2 className="text-sm font-bold text-[#1E293B]">
              PWA-C5 Navigation Seam
            </h2>
          </div>
          <p className="text-xs text-[#475569] leading-relaxed mb-3">
            The shared Staff navigation seam connects to this view. Full camera QR scanning, continuous frame decoding, and attendance/service mutation pipelines are scheduled for <strong>PWA-C6</strong>.
          </p>
          <p className="text-[11px] text-[#64748B]">
            No camera permissions are requested and no operations are mutated in Stage C5.
          </p>
        </div>

        {/* Return Action */}
        <Link
          href={returnHref}
          className="flex h-12 w-full max-w-xs items-center justify-center gap-2 rounded-xl bg-[#163A2B] text-sm font-semibold text-white shadow-xs transition hover:bg-[#10261D] active:scale-95"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          <span>Return to Workspace</span>
        </Link>
      </div>
    </StaffAppShell>
  );
}
