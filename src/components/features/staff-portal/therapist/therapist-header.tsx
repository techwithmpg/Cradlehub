"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Leaf } from "lucide-react";
import { UserAvatar } from "@/components/shared/user-avatar";
import { getStaffDisplayName } from "@/lib/staff/display-name";
import { STAFF_TYPE_LABELS } from "@/constants/staff";
import type { StaffPortalStaff } from "@/components/features/staff-portal/types";

type TherapistHeaderProps = {
  staff: StaffPortalStaff;
};

export function TherapistHeader({ staff }: TherapistHeaderProps) {
  const pathname = usePathname();
  const isCanonical = pathname?.startsWith("/staff") ?? false;
  const notificationsHref = isCanonical
    ? "/staff/notices"
    : "/staff-portal/notifications";
  const profileHref = isCanonical ? "/staff/more" : "/staff-portal/profile";

  const typeLabel =
    STAFF_TYPE_LABELS[
      staff.staff_type as keyof typeof STAFF_TYPE_LABELS
    ] ?? "Therapist";

  const displayName = getStaffDisplayName(staff);

  return (
    <header className="sticky top-0 z-30 border-b border-[#EEE8DF] bg-[#FBFAF6]/95 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[480px] items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="grid size-9 place-items-center rounded-xl bg-[#EAF5ED] text-[#0D5C43]">
            <Leaf size={21} strokeWidth={2.2} />
          </div>

          <div>
            <div className="text-[17px] font-bold leading-none tracking-[-0.025em] text-[#102A26]">
              CradleHub
            </div>
            <div className="mt-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-[#8D7563]">
              Staff · {typeLabel}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={notificationsHref}
            aria-label="Notifications"
            className="grid size-10 place-items-center rounded-full text-[#26384A] transition hover:bg-[#F2EEE8] active:scale-95"
          >
            <Bell size={19} strokeWidth={1.9} />
          </Link>

          <Link
            href={profileHref}
            aria-label="Profile"
            className="rounded-full active:scale-95"
          >
            <UserAvatar
              name={displayName}
              imageUrl={staff.avatar_url}
              size="sm"
              className="size-10 border-2 border-white shadow-sm ring-1 ring-[#E4DED5]"
            />
          </Link>
        </div>
      </div>
    </header>
  );
}