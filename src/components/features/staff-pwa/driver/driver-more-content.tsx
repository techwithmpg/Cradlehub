import Link from "next/link";
import {
  Bell,
  CalendarCheck2,
  ClipboardList,
  ChevronRight,
  LogOut,
  QrCode,
  Smartphone,
  UserRound,
} from "lucide-react";
import {
  StaffScreen,
  StaffScreenHeader,
  StaffCard,
  StaffButton,
} from "@/components/features/staff-pwa/native-foundation";
import { DriverNativeStatus } from "./driver-native-status";
import type { StaffPortalStaff } from "@/components/features/staff-portal/types";
const links = [
  { label: "Attendance and shift", href: "/staff/attendance", icon: CalendarCheck2 },
  { label: "Trip history", href: "/staff/driver/trips", icon: ClipboardList },
  { label: "Notifications", href: "/staff/notices", icon: Bell },
  { label: "Driver profile", href: "/staff/driver/profile", icon: UserRound },
  { label: "Scan attendance QR", href: "/staff/scan", icon: QrCode },
  { label: "Download Driver App", href: "/staff/driver/app", icon: Smartphone },
];
export function DriverMoreContent({
  staff,
  logoutAction,
}: {
  staff: StaffPortalStaff;
  logoutAction: () => Promise<void>;
}) {
  const name = staff.nickname?.trim() || staff.full_name?.trim() || "Driver";
  return (
    <StaffScreen>
      <StaffScreenHeader title="More" subtitle="Your shift, account and help" />
      <StaffCard className="p-4">
        <h2 className="font-semibold text-[#163a2b]">{name}</h2>
        <p className="mt-1 text-xs text-[#65746b]">Driver · CradleHub</p>
      </StaffCard>
      <StaffCard className="mt-4 overflow-hidden">
        {links.map(({ label, href, icon: Icon }) => {
          const ItemLink = href === "/staff/scan" ? "a" : Link;
          return (
            <ItemLink
              key={href}
              href={href}
              className="flex min-h-14 items-center gap-3 border-b border-[#eee8dd] px-4 last:border-0 focus-visible:outline-2 focus-visible:outline-[#c8a96b]"
            >
              <Icon size={19} className="text-[#19563c]" aria-hidden="true" />
              <span className="flex-1 text-sm font-medium">{label}</span>
              <ChevronRight size={17} aria-hidden="true" />
            </ItemLink>
          );
        })}
      </StaffCard>
      <DriverNativeStatus />
      <StaffCard className="mt-4 p-4">
        <h2 className="text-sm font-semibold">Connection and help</h2>
        <p className="mt-2 text-xs leading-5 text-[#65746b]">
          If a trip or collection cannot be confirmed, reconnect and refresh before acting. Your
          branch CRM handles assignment changes. Live voice guidance runs in the Android app;
          attendance remains separate.
        </p>
      </StaffCard>
      <form action={logoutAction} className="mt-4">
        <StaffButton type="submit" variant="secondary" className="w-full">
          <LogOut size={17} aria-hidden="true" />
          Sign out
        </StaffButton>
      </form>
    </StaffScreen>
  );
}
