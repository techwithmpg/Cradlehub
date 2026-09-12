"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import { UserAvatar } from "@/components/shared/user-avatar";
import { getStaffDisplayName } from "@/lib/staff/display-name";
import { STAFF_TYPE_LABELS } from "@/constants/staff";
import type { StaffPortalStaff } from "@/components/features/staff-portal/types";

type BasicStaffHeaderProps = {
  staff: StaffPortalStaff;
};

export function BasicStaffHeader({ staff }: BasicStaffHeaderProps) {
  const pathname = usePathname();
  const isCanonical = pathname?.startsWith("/staff");
  const noticesHref = isCanonical ? "/staff/notices" : "/staff-portal/notifications";
  const profileHref = isCanonical ? "/staff/profile" : "/staff-portal/profile";

  const typeLabel =
    STAFF_TYPE_LABELS[staff.staff_type as keyof typeof STAFF_TYPE_LABELS] ?? "Staff";
  const displayName = getStaffDisplayName(staff);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0.75rem 1rem",
        backgroundColor: "#fff",
        borderBottom: "1px solid var(--cs-border-soft)",
        position: "sticky",
        top: 0,
        zIndex: 40,
      }}
    >
      {/* Left: logo + role label */}
      <div>
        <div
          style={{
            fontSize: 16,
            fontWeight: 800,
            color: "var(--cs-text)",
            letterSpacing: "-0.01em",
            lineHeight: 1,
          }}
        >
          CradleHub
        </div>
        <div
          style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--cs-staff-accent)",
            marginTop: 1,
          }}
        >
          Staff · {typeLabel}
        </div>
      </div>

      {/* Right: notification bell + avatar */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
        <Link
          href={noticesHref}
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            backgroundColor: "var(--cs-surface-warm)",
            border: "1px solid var(--cs-border-soft)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--cs-text-muted)",
            textDecoration: "none",
          }}
          aria-label="Notifications"
        >
          <Bell size={17} />
        </Link>

        <Link
          href={profileHref}
          style={{ textDecoration: "none" }}
          aria-label="Profile"
        >
          <UserAvatar
            name={displayName}
            imageUrl={staff.avatar_url}
            size="sm"
            className="size-9 border border-[--cs-border-soft] shadow-xs"
          />
        </Link>
      </div>
    </div>
  );
}
