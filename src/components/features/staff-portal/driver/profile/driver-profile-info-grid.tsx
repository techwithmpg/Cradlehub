import { Building2, IdCard, Phone, ShieldCheck } from "lucide-react";
import type { ComponentType } from "react";
import type { StaffPortalStaff } from "@/components/features/staff-portal/types";
import {
  formatDriverPhone,
  getDriverBranchLabel,
  getDriverStaffTypeLabel,
} from "./driver-profile-utils";

type InfoItem = {
  label: string;
  value: string;
  icon: ComponentType<{ className?: string }>;
};

type DriverProfileInfoGridProps = {
  staff: StaffPortalStaff;
};

export function DriverProfileInfoGrid({ staff }: DriverProfileInfoGridProps) {
  const items: InfoItem[] = [
    { label: "Phone", value: formatDriverPhone(staff.phone), icon: Phone },
    { label: "Branch", value: getDriverBranchLabel(staff), icon: Building2 },
    { label: "Staff Type", value: getDriverStaffTypeLabel(staff), icon: IdCard },
    { label: "Access", value: "Driver Portal", icon: ShieldCheck },
  ];

  return (
    <section className="grid grid-cols-4 overflow-hidden rounded-3xl border border-stone-200/90 bg-white/95 shadow-sm">
      {items.map((item) => {
        const Icon = item.icon;

        return (
          <div
            key={item.label}
            className="min-w-0 border-stone-200/80 px-2 py-4 text-center [&:not(:first-child)]:border-l"
          >
            <Icon className="mx-auto h-7 w-7 text-emerald-900" />
            <p className="mt-2 text-[11px] font-semibold leading-tight text-stone-500">{item.label}</p>
            <p className="mt-1 break-words text-xs font-black leading-tight text-stone-950">
              {item.value}
            </p>
          </div>
        );
      })}
    </section>
  );
}
