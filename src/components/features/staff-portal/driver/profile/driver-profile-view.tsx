import type { StaffPortalStaff } from "@/components/features/staff-portal/types";
import { DriverProfileActionList } from "./driver-profile-action-list";
import { DriverProfileHeaderCard } from "./driver-profile-header-card";
import { DriverProfileInfoGrid } from "./driver-profile-info-grid";
import { DriverProfileReadinessCard } from "./driver-profile-readiness-card";

type DriverProfileViewProps = {
  staff: StaffPortalStaff;
  onEdit: () => void;
  onNavigate: () => void;
};

export function DriverProfileView({ staff, onEdit, onNavigate }: DriverProfileViewProps) {
  return (
    <div className="space-y-3">
      <DriverProfileHeaderCard staff={staff} />
      <DriverProfileInfoGrid staff={staff} />
      <DriverProfileReadinessCard staff={staff} />
      <DriverProfileActionList onEdit={onEdit} onNavigate={onNavigate} />

      <footer className="pb-2 pt-4 text-center text-sm font-semibold text-stone-500">
        <p>CradleHub Driver Portal</p>
        <p className="mt-1">Version 1.0.0</p>
      </footer>
    </div>
  );
}
