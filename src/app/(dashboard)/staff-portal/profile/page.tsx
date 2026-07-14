import { PageHeader } from "@/components/features/dashboard/page-header";
import { getMyProfileAction } from "../actions";
import { StaffProfileDetailsForm } from "@/components/features/staff-portal/staff-profile-details-form";
import { StaffProfilePhotoUploader } from "@/components/features/staff-portal/staff-profile-photo-uploader";
import { getStaffDisplayName, getStaffNickname } from "@/lib/staff/display-name";
import { cookies } from "next/headers";
import { AttendancePhoneCard } from "@/components/features/staff-portal/attendance-phone-card";
import { getOwnAttendancePhoneState } from "@/lib/attendance/device-registration";
import { ATTENDANCE_REGISTRATION_COOKIE_NAME } from "@/lib/attendance/scan-continuation";
import { DEVICE_COOKIE_NAME } from "@/lib/attendance/tokens";

function formatToken(value: string | null | undefined, fallback: string): string {
  if (!value) return fallback;
  if (value === "n/a") return "N/A";
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default async function StaffProfilePage() {
  const result = await getMyProfileAction();

  if ("error" in result) {
    return (
      <div className="p-8 text-center text-text-muted">
        {result.error}
      </div>
    );
  }

  const { staff } = result;
  const nickname = getStaffNickname(staff);
  const displayName = getStaffDisplayName(staff);
  const tierLabel = formatToken(staff.tier, "N/A");
  const cookieStore = await cookies();
  const phoneState = await getOwnAttendancePhoneState(
    cookieStore.get(DEVICE_COOKIE_NAME)?.value ??
      cookieStore.get(ATTENDANCE_REGISTRATION_COOKIE_NAME)?.value ??
      null
  );

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 sm:px-0 sm:pb-0">
      <PageHeader
        title="Profile Settings"
        description="Manage your personal information and profile photo."
        icon="👤"
      />

      <div className="mt-8 space-y-8">
        <section>
          <StaffProfilePhotoUploader
            staffId={staff.id}
            fullName={displayName}
            initialAvatarUrl={staff.avatar_url}
          />
        </section>

        <StaffProfileDetailsForm
          fullName={staff.full_name}
          nickname={nickname}
          systemRole={staff.system_role}
          staffType={staff.staff_type}
          tierLabel={tierLabel}
        />

        {phoneState ? <AttendancePhoneCard state={phoneState} /> : null}
      </div>
    </div>
  );
}
