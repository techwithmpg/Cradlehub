import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Bell,
  ChevronRight,
  ClipboardList,
  LogOut,
  MapPinned,
  UserRound,
  CalendarCheck2,
} from "lucide-react";
import { UserAvatar } from "@/components/shared/user-avatar";
import {
  StaffButton,
  StaffCard,
  StaffScreen,
  StaffScreenHeader,
} from "@/components/features/staff-pwa/native-foundation";
import { getMyProfileAction } from "@/app/(dashboard)/staff-portal/actions";
import { resolveStaffPwaOperationalGroup } from "@/lib/auth/workspace-access";

export const metadata = { title: "More | CradleHub Driver" };

async function driverLogoutAction() {
  "use server";
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) await supabase.auth.signOut();
  redirect("/staff/login");
}

const links = [
  { label: "Trips", href: "/staff/driver/trips", icon: ClipboardList },
  { label: "Map", href: "/staff/driver/map", icon: MapPinned },
  { label: "My profile", href: "/staff/driver/profile", icon: UserRound },
  { label: "Attendance", href: "/staff/attendance", icon: CalendarCheck2 },
  { label: "Notices", href: "/staff/notices", icon: Bell },
] as const;

export default async function StaffDriverMorePage() {
  const result = await getMyProfileAction();
  if (
    !("staff" in result) ||
    !result.staff ||
    resolveStaffPwaOperationalGroup(result.staff.system_role, result.staff.staff_type) !== "driver"
  ) {
    redirect("/staff/");
  }
  const staff = result.staff;
  const name = staff.nickname?.trim() || staff.full_name?.trim() || "Driver";

  return (
    <StaffScreen>
      <StaffScreenHeader title="More" subtitle="Driver workspace and account" />
      <StaffCard className="flex items-center gap-4 p-4">
        <UserAvatar
          name={name}
          imageUrl={staff.avatar_url}
          size="sm"
          className="size-14 border-2 border-[#c8a96b]"
        />
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold text-[#163a2b]">{name}</h2>
          <p className="text-xs text-[#65746b]">Driver</p>
        </div>
      </StaffCard>
      <StaffCard className="mt-5 overflow-hidden">
        {links.map(({ label, href, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex min-h-14 items-center gap-3 border-b border-[#eee8dd] px-4 last:border-0 focus-visible:outline-2 focus-visible:outline-[#c8a96b]"
          >
            <Icon size={19} className="text-[#19563c]" aria-hidden="true" />
            <span className="flex-1 text-sm font-medium">{label}</span>
            <ChevronRight size={17} className="text-[#65746b]" aria-hidden="true" />
          </Link>
        ))}
      </StaffCard>
      <p className="mt-5 text-center text-xs text-[#65746b]">CradleHub Staff PWA</p>
      <form action={driverLogoutAction} className="mt-5">
        <StaffButton type="submit" variant="secondary" className="w-full">
          <LogOut size={17} aria-hidden="true" /> Sign out
        </StaffButton>
      </form>
    </StaffScreen>
  );
}
