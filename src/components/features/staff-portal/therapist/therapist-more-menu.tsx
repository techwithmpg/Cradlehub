import Link from "next/link";
import { redirect } from "next/navigation";
import type { ElementType } from "react";
import {
  Bell,
  BookOpen,
  CalendarDays,
  ChevronRight,
  ClipboardCheck,
  Clock,
  HelpCircle,
  History,
  Info,
  LogOut,
  MapPin,
  QrCode,
  Settings,
  Shield,
  User,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { UserAvatar } from "@/components/shared/user-avatar";
import { getStaffDisplayName } from "@/lib/staff/display-name";
import { STAFF_TYPE_LABELS } from "@/constants/staff";
import type { StaffPortalStaff } from "@/components/features/staff-portal/types";

async function therapistLogoutAction() {
  "use server";

  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

type TherapistMoreMenuProps = {
  isCanonical?: boolean;
  staff?: StaffPortalStaff | null;
};

type MenuItem = {
  label: string;
  description: string;
  href?: string;
  icon: ElementType;
  status?: string;
  disabled?: boolean;
};


type TherapistMoreLinkRow = {
  kind: "link";
  label: string;
  description: string;
  href: string;
  icon: ElementType;
  disabled?: boolean;
};

type TherapistMoreLogoutRow = {
  kind: "logout";
  label: string;
  description: string;
  icon: ElementType;
};

type TherapistMoreSectionItem =
  | TherapistMoreLinkRow
  | TherapistMoreLogoutRow;

type TherapistMoreSection = {
  title: string;
  items: TherapistMoreSectionItem[];
};

/**
 * Preserved C6 compatibility contract.
 *
 * Canonical Provider destinations remain inside /staff/*.
 * The redesigned More UI does not have to render this structure directly,
 * but accepted PWA foundation consumers/tests still rely on the contract.
 */
export function getTherapistMoreSections(
  isCanonical: boolean
): TherapistMoreSection[] {
  return [
    {
      title: "Account",
      items: [
        {
          kind: "link",
          label: "Profile",
          description: "View and edit your profile",
          href: isCanonical ? "/staff/profile" : "/staff-portal/profile",
          icon: User,
        },
        {
          kind: "link",
          label: "Notifications",
          description: "Manage your notifications",
          href: isCanonical ? "/staff/notices" : "/staff-portal/notifications",
          icon: Bell,
        },
        {
          kind: "link",
          label: "Settings",
          description: "App preferences",
          href: isCanonical ? "/staff/notices" : "/staff-portal/notifications",
          icon: Settings,
          disabled: true,
        },
      ],
    },
    {
      title: "Work",
      items: [
        {
          kind: "link",
          label: "My Attendance",
          description: "View clock history and review status",
          href: isCanonical ? "/staff/attendance" : "/staff-portal/attendance",
          icon: ClipboardCheck,
        },
        {
          kind: "link",
          label: "My Week",
          description: "Weekly schedule overview",
          href: isCanonical ? "/staff/schedule" : "/staff-portal/week",
          icon: Clock,
        },
        {
          kind: "link",
          label: "Dispatch & Home Service",
          description: "Home service assignments",
          href: isCanonical ? "/staff/schedule" : "/staff-portal/dispatch",
          icon: MapPin,
        },
        {
          kind: "link",
          label: "Service History",
          description: "Past completed services",
          href: isCanonical ? "/staff/progress" : "/staff-portal/service-progress",
          icon: BookOpen,
        },
      ],
    },
    {
      title: "Support",
      items: [
        {
          kind: "link",
          label: "Help & Support",
          description: "Get help and contact support",
          href: isCanonical ? "/staff/notices" : "/staff-portal/notifications",
          icon: HelpCircle,
          disabled: true,
        },
        {
          kind: "link",
          label: "Privacy Policy",
          description: "Read our privacy policy",
          href: isCanonical ? "/staff/notices" : "/staff-portal/notifications",
          icon: Shield,
          disabled: true,
        },
        {
          kind: "logout",
          label: "Logout",
          description: "Sign out from your account",
          icon: LogOut,
        },
      ],
    },
  ];
}

export function TherapistMoreMenu({
  isCanonical = false,
  staff = null,
}: TherapistMoreMenuProps) {
  const displayName = staff ? getStaffDisplayName(staff) : "Staff Member";

  const roleLabel =
    staff?.staff_type
      ? STAFF_TYPE_LABELS[
          staff.staff_type as keyof typeof STAFF_TYPE_LABELS
        ] ?? "Therapist"
      : "Therapist";

  const items: MenuItem[] = [
    {
      label: "My Profile",
      description: "Personal information",
      href: isCanonical ? "/staff/profile" : "/staff-portal/profile",
      icon: User,
    },
    {
      label: "Attendance",
      description: "Clock history and review status",
      href: isCanonical ? "/staff/attendance" : "/staff-portal/attendance",
      icon: ClipboardCheck,
    },
    {
      label: "My Schedule",
      description: "Shifts and assigned services",
      href: isCanonical ? "/staff/schedule" : "/staff-portal/schedule",
      icon: CalendarDays,
    },
    {
      label: "Service History",
      description: "Completed service records",
      href: isCanonical ? "/staff/progress" : "/staff-portal/service-progress",
      icon: History,
    },
    {
      label: "Device / Scan Status",
      description: "Device and scanner information",
      icon: QrCode,
      disabled: true,
      status: "Managed",
    },
    {
      label: "Help & Support",
      description: "Support resources",
      icon: HelpCircle,
      disabled: true,
      status: "Soon",
    },
    {
      label: "About CradleHub",
      description: "Staff workspace information",
      icon: Info,
      disabled: true,
      status: "Soon",
    },
  ];

  return (
    <div className="min-h-dvh bg-[#F7F3EB]">
      <main className="mx-auto max-w-[480px] px-4 pb-6 pt-4">
        <h1 className="mb-4 text-[25px] font-bold tracking-[-0.035em] text-[#14283A]">
          More
        </h1>

        <section className="relative overflow-hidden rounded-[22px] bg-[linear-gradient(135deg,#1A7056_0%,#0D4D3A_100%)] px-4 py-4 text-white shadow-[0_10px_28px_rgba(13,77,58,0.18)]">
          <div className="absolute -right-8 -top-10 size-36 rounded-full bg-white/5" />
          <div className="absolute -bottom-12 right-8 size-28 rounded-full bg-white/5" />

          <div className="relative flex items-center gap-4">
            <UserAvatar
              name={displayName}
              imageUrl={staff?.avatar_url}
              size="sm"
              className="size-16 border-2 border-white/80 shadow-md"
            />

            <div className="min-w-0">
              <div className="truncate text-[20px] font-bold tracking-[-0.02em]">
                {displayName}
              </div>
              <div className="mt-0.5 text-[13px] text-white/80">
                {roleLabel}
              </div>
              <span className="mt-2 inline-flex rounded-full bg-white/12 px-2.5 py-1 text-[10px] font-semibold text-white/90">
                Staff Workspace
              </span>
            </div>
          </div>
        </section>

        <section className="mt-4 overflow-hidden rounded-[20px] border border-[#E9E4DC] bg-white shadow-[0_5px_20px_rgba(30,41,59,0.045)]">
          {items.map((item, index) => {
            const Icon = item.icon;

            const content = (
              <div
                className={
                  item.disabled
                    ? "flex min-h-[65px] items-center gap-3 px-4 opacity-55"
                    : "flex min-h-[65px] items-center gap-3 px-4 transition active:bg-[#FAF8F4]"
                }
              >
                <div className="grid size-9 shrink-0 place-items-center rounded-[11px] bg-[#F5F3EF] text-[#1F394A]">
                  <Icon size={17} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-semibold text-[#223548]">
                    {item.label}
                  </div>
                  <div className="mt-0.5 truncate text-[10.5px] text-[#7C8794]">
                    {item.description}
                  </div>
                </div>

                {item.status ? (
                  <span className="rounded-full bg-[#E8F6EB] px-2 py-1 text-[9.5px] font-bold text-[#18704D]">
                    {item.status}
                  </span>
                ) : null}

                {!item.disabled ? (
                  <ChevronRight size={17} className="shrink-0 text-[#758190]" />
                ) : null}
              </div>
            );

            return (
              <div key={item.label}>
                {index > 0 ? (
                  <div className="ml-16 h-px bg-[#EEEAE4]" />
                ) : null}

                {item.href && !item.disabled ? (
                  <Link href={item.href} className="block">
                    {content}
                  </Link>
                ) : (
                  <div aria-disabled={item.disabled}>{content}</div>
                )}
              </div>
            );
          })}
        </section>

        <form action={therapistLogoutAction} className="mt-4">
          <button
            type="submit"
            className="flex min-h-14 w-full items-center justify-center gap-2 rounded-[18px] border border-[#F3CACA] bg-[#FFF1F1] text-[14px] font-bold text-[#D63737] transition active:scale-[0.99]"
          >
            <LogOut size={18} />
            Logout
          </button>
        </form>

        <div className="mt-4 rounded-[18px] bg-[#EEF5E9] px-4 py-4 text-center">
          <div className="text-[13px] font-semibold text-[#315B45]">
            Care people. Better days.
          </div>
          <div className="mt-1 text-[10px] text-[#718075]">
            Simple tools for a focused workday.
          </div>
        </div>
      </main>
    </div>
  );
}