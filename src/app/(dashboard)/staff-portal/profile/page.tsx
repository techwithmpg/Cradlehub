import { PageHeader } from "@/components/features/dashboard/page-header";
import { getMyProfileAction } from "../actions";
import { StaffProfilePhotoUploader } from "@/components/features/staff-portal/staff-profile-photo-uploader";
import { STAFF_TYPE_LABELS } from "@/constants/staff";

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
  const roleLabel = STAFF_TYPE_LABELS[staff.staff_type as keyof typeof STAFF_TYPE_LABELS] ?? "Staff";

  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader
        title="Profile Settings"
        description="Manage your personal information and profile photo."
        icon="👤"
      />

      <div className="mt-8 space-y-8">
        <section>
          <StaffProfilePhotoUploader
            staffId={staff.id}
            fullName={staff.full_name}
            initialAvatarUrl={staff.avatar_url}
          />
        </section>

        <section className="cs-card p-6 space-y-4">
          <h3 className="text-lg font-semibold text-text">Account Details</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-xs font-medium text-text-muted uppercase tracking-wider">Full Name</label>
              <div className="mt-1 text-sm font-medium text-text">{staff.full_name}</div>
            </div>

            <div>
              <label className="text-xs font-medium text-text-muted uppercase tracking-wider">Role</label>
              <div className="mt-1 text-sm font-medium text-text">{roleLabel}</div>
            </div>

            <div>
              <label className="text-xs font-medium text-text-muted uppercase tracking-wider">Tier</label>
              <div className="mt-1 text-sm font-medium text-text capitalize">{staff.tier ?? "N/A"}</div>
            </div>

            <div>
              <label className="text-xs font-medium text-text-muted uppercase tracking-wider">System Role</label>
              <div className="mt-1 text-sm font-medium text-text capitalize">{staff.system_role}</div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
