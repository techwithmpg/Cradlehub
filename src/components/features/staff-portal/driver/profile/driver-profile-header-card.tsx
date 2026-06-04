import { MapPin } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { StaffPortalStaff } from "@/components/features/staff-portal/types";
import {
  getDriverBranchLabel,
  getDriverFullName,
  getDriverInitials,
} from "./driver-profile-utils";

type DriverProfileHeaderCardProps = {
  staff: StaffPortalStaff;
};

export function DriverProfileHeaderCard({ staff }: DriverProfileHeaderCardProps) {
  const fullName = getDriverFullName(staff);
  const nickname = staff.nickname?.trim();
  const isOnDuty = staff.is_active !== false;

  return (
    <section className="rounded-3xl border border-stone-200/90 bg-white/95 p-4 shadow-sm">
      <div className="flex items-center gap-4">
        <div className="relative h-24 w-24 shrink-0">
          <Avatar className="h-24 w-24 border-4 border-[#f2eee7] bg-emerald-950 text-3xl font-black text-white shadow-sm">
            {staff.avatar_url ? <AvatarImage src={staff.avatar_url} alt={`${fullName} profile photo`} /> : null}
            <AvatarFallback className="bg-emerald-950 text-3xl font-black text-white">
              {getDriverInitials(staff)}
            </AvatarFallback>
          </Avatar>
          <span className="absolute bottom-2 right-2 h-5 w-5 rounded-full border-4 border-white bg-emerald-500" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-[26px] font-black leading-tight text-stone-950">
                {fullName}
              </h2>
              {nickname ? (
                <p className="mt-1 truncate text-sm font-semibold text-emerald-800">
                  Known as {nickname}
                </p>
              ) : null}
              <p className="mt-1 text-lg font-bold text-emerald-900">Driver</p>
            </div>

            <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
              {isOnDuty ? "On Duty" : "Off Duty"}
            </span>
          </div>

          <div className="mt-4 flex min-w-0 items-center gap-2 text-sm font-semibold text-stone-500">
            <MapPin className="h-4 w-4 shrink-0 text-amber-700" />
            <span className="truncate">{getDriverBranchLabel(staff)}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
