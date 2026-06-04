"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import {
  Bell,
  CalendarDays,
  ChevronRight,
  Headphones,
  LogOut,
  ShieldCheck,
  UserRoundPen,
} from "lucide-react";
import { driverProfileLogoutAction } from "./driver-profile-actions";

type ActionRow = {
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  href?: string;
  disabled?: boolean;
  danger?: boolean;
  onClick?: () => void;
};

type DriverProfileActionListProps = {
  onEdit: () => void;
  onNavigate: () => void;
};

function buildRows(pathname: string, onEdit: () => void): ActionRow[] {
  const isStandaloneDriver = pathname.startsWith("/driver");

  return [
    {
      label: "Edit Profile",
      description: "Update your name, phone, and photo",
      icon: UserRoundPen,
      onClick: onEdit,
    },
    {
      label: "Notifications",
      description: isStandaloneDriver ? "Coming soon" : "Manage your alerts and preferences",
      icon: Bell,
      href: isStandaloneDriver ? undefined : "/staff-portal/notifications",
      disabled: isStandaloneDriver,
    },
    {
      label: "Schedule",
      description: isStandaloneDriver ? "Coming soon" : "View your working schedule",
      icon: CalendarDays,
      href: isStandaloneDriver ? undefined : "/staff-portal/schedule",
      disabled: isStandaloneDriver,
    },
    {
      label: "Help & Support",
      description: "Coming soon",
      icon: Headphones,
      disabled: true,
    },
    {
      label: "Privacy & Policy",
      description: "Coming soon",
      icon: ShieldCheck,
      disabled: true,
    },
  ];
}

function ActionRowContent({ row }: { row: ActionRow }) {
  const Icon = row.icon;

  return (
    <div className="flex min-h-[68px] items-center gap-4 px-4 py-3 text-left">
      <span
        className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl border ${
          row.danger
            ? "border-red-100 bg-red-50 text-red-600"
            : "border-emerald-100 bg-emerald-50 text-emerald-900"
        }`}
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-base font-black leading-tight ${row.danger ? "text-red-600" : "text-stone-950"}`}>
          {row.label}
        </span>
        <span className={`mt-1 block text-sm font-medium leading-tight ${row.danger ? "text-red-500" : "text-stone-500"}`}>
          {row.description}
        </span>
      </span>
      {!row.disabled && !row.danger ? <ChevronRight className="h-5 w-5 shrink-0 text-stone-500" /> : null}
    </div>
  );
}

function ProfileActionRow({ row, onNavigate }: { row: ActionRow; onNavigate: () => void }) {
  const className = "block w-full rounded-3xl border border-stone-200/90 bg-white/95 shadow-sm transition active:scale-[0.99]";

  if (row.onClick) {
    return (
      <button type="button" onClick={row.onClick} className={className}>
        <ActionRowContent row={row} />
      </button>
    );
  }

  if (row.href && !row.disabled) {
    return (
      <Link href={row.href} onClick={onNavigate} className={className}>
        <ActionRowContent row={row} />
      </Link>
    );
  }

  return (
    <div aria-disabled="true" className={`${className} opacity-55`}>
      <ActionRowContent row={row} />
    </div>
  );
}

export function DriverProfileActionList({ onEdit, onNavigate }: DriverProfileActionListProps) {
  const pathname = usePathname();
  const rows = buildRows(pathname, onEdit);

  return (
    <section className="space-y-2">
      {rows.map((row) => (
        <ProfileActionRow key={row.label} row={row} onNavigate={onNavigate} />
      ))}

      <form action={driverProfileLogoutAction}>
        <button
          type="submit"
          className="block w-full rounded-3xl border border-red-100 bg-red-50/60 shadow-sm transition active:scale-[0.99]"
        >
          <ActionRowContent
            row={{
              label: "Logout",
              description: "Sign out from your account",
              icon: LogOut,
              danger: true,
            }}
          />
        </button>
      </form>
    </section>
  );
}
