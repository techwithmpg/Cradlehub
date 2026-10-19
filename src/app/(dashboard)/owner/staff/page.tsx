import { OwnerStaffManagement } from "@/components/features/staff/owner-staff-management";
import type { StaffMember, StaffTab } from "@/components/features/staff/staff-management-utils";
import { getAllStaff, getPendingStaff } from "@/lib/queries/staff";

export default async function OwnerStaffPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const initialTab: StaffTab = resolvedSearchParams.tab === "pending" ? "pending" : "active";

  const [allStaff, pendingStaff] = await Promise.all([getAllStaff(), getPendingStaff()]);

  return (
    <OwnerStaffManagement
      allStaff={allStaff as StaffMember[]}
      pendingStaff={pendingStaff as StaffMember[]}
      initialTab={initialTab}
    />
  );
}
