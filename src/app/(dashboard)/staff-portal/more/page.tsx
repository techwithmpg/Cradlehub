import { BasicStaffMoreMenu } from "@/components/features/staff-portal/basic/basic-staff-more-menu";

export default function StaffMorePage() {
  return (
    <>
      {/* Desktop: simple settings list */}
      <div className="hidden md:block">
        <BasicStaffMoreMenu />
      </div>

      {/* Mobile: full-screen more menu with bottom nav */}
      <div className="block md:hidden">
        <BasicStaffMoreMenu />
      </div>
    </>
  );
}
