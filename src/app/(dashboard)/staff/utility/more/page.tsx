import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Bell,
  ChevronRight,
  ClipboardList,
  DoorOpen,
  LogOut,
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
import { getUtilityStaffIdentity } from "@/lib/staff-pwa/utility-runtime";

export const metadata = { title: "More | CradleHub Utility" };

async function utilityLogoutAction() {
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
  { label: "Turnover tasks", href: "/staff/utility/work", icon: ClipboardList },
  { label: "Rooms", href: "/staff/utility/rooms", icon: DoorOpen },
  { label: "My profile", href: "/staff/profile", icon: UserRound },
  { label: "Attendance", href: "/staff/attendance", icon: CalendarCheck2 },
  { label: "Notices", href: "/staff/utility/notices", icon: Bell },
] as const;

export default async function StaffUtilityMorePage() {
  const staff = await getUtilityStaffIdentity();
  if (!staff) redirect("/staff/");
  const name = staff.nickname?.trim() || staff.full_name?.trim() || "Utility staff";

  return (
    <StaffScreen>
      <StaffScreenHeader title="More" subtitle="Utility workspace and account" />
      <StaffCard className="flex items-center gap-4 p-4">
        <UserAvatar
          name={name}
          imageUrl={staff.avatar_url}
          size="sm"
          className="size-14 border-2 border-[#c8a96b]"
        />
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold text-[#163a2b]">{name}</h2>
          <p className="text-xs text-[#65746b]">Utility / Housekeeping</p>
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
      <form action={utilityLogoutAction} className="mt-5">
        <StaffButton type="submit" variant="secondary" className="w-full">
          <LogOut size={17} aria-hidden="true" /> Sign out
        </StaffButton>
      </form>
    </StaffScreen>
  );
}
