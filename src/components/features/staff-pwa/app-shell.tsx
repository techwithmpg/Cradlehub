"use client";

import type { ReactNode } from "react";
import { StaffTopBar } from "./top-bar";
import { StaffBottomNav } from "./bottom-nav";
import { StaffConnectivityBanner } from "./connectivity-banner";
import { StaffInstallPrompt } from "./install-prompt";
import type { NavigationProfile, StaffNavItem, StaffOperationalRole } from "./types";
import {
  getNavigationItemsForProfile,
  resolveNavigationProfile,
  resolveStaffOperationalRole,
} from "./role-navigation";

type StaffAppShellProps = {
  children: ReactNode;
  staff?: {
    system_role: string;
    staff_type?: string | null;
    full_name?: string | null;
    nickname?: string | null;
    avatar_url?: string | null;
    branch_name?: string | null;
  } | null;
  roleOverride?: StaffOperationalRole;
  profileOverride?: NavigationProfile;
  customNavItems?: StaffNavItem[];
  activeNavKey?: string;
  isToday?: boolean;
  pageTitle?: string;
  backHref?: string;
  onBack?: () => void;
  onScanClick?: () => void;
  businessDateLabel?: string | null;
  unreadNoticeCount?: number;
  hideNav?: boolean;
  hideTopBar?: boolean;
};

export function StaffAppShell({
  children,
  staff,
  roleOverride,
  profileOverride,
  customNavItems,
  activeNavKey,
  isToday = false,
  pageTitle,
  backHref,
  onBack,
  onScanClick,
  businessDateLabel,
  unreadNoticeCount = 0,
  hideNav = false,
  hideTopBar = false,
}: StaffAppShellProps) {
  // Resolve role and profile
  const operationalRole =
    roleOverride ??
    (staff
      ? resolveStaffOperationalRole({
          system_role: staff.system_role,
          staff_type: staff.staff_type,
        })
      : "therapist");

  const navProfile = profileOverride ?? resolveNavigationProfile(operationalRole);
  const navItems = customNavItems ?? getNavigationItemsForProfile(navProfile);

  const displayName = staff?.nickname || staff?.full_name || "Staff";
  const roleLabel =
    operationalRole === "therapist"
      ? "Therapist"
      : operationalRole === "nail_tech"
        ? "Nail Tech"
        : operationalRole === "aesthetician"
          ? "Aesthetician"
          : operationalRole === "salon_head"
            ? "Salon Head"
            : operationalRole === "driver"
              ? "Driver"
              : operationalRole === "utility"
                ? "Utility"
                : "Staff";

  return (
    <div
      className="min-h-dvh w-full bg-[#F7F3EB] text-[#1E293B] antialiased"
      style={{
        // Define scoped CSS variables for child components
        ["--pwa-bg" as string]: "#F7F3EB",
        ["--pwa-forest" as string]: "#163A2B",
        ["--pwa-gold" as string]: "#C8A96B",
        ["--pwa-text" as string]: "#1E293B",
      }}
    >
      {/* Top Bar */}
      {!hideTopBar ? (
        <StaffTopBar
          isToday={isToday}
          title={pageTitle}
          backHref={backHref}
          onBack={onBack}
          userName={displayName}
          userAvatarUrl={staff?.avatar_url}
          roleChipLabel={roleLabel}
          branchName={staff?.branch_name}
          businessDateLabel={businessDateLabel}
          unreadNoticeCount={unreadNoticeCount}
        />
      ) : null}

      {/* Connectivity Banner */}
      <StaffConnectivityBanner />

      {/* Optional Install Promotion on Today surface */}
      {isToday ? <StaffInstallPrompt /> : null}

      {/* Main Content Region */}
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto w-full max-w-md px-4 py-3 focus:outline-none"
        style={{
          paddingBottom: hideNav
            ? "calc(1.5rem + env(safe-area-inset-bottom, 0px))"
            : "calc(5.5rem + env(safe-area-inset-bottom, 0px))",
        }}
      >
        {children}
      </main>

      {/* Bottom Navigation */}
      {!hideNav ? (
        <StaffBottomNav
          items={navItems}
          activeKey={activeNavKey}
          onScanClick={onScanClick}
        />
      ) : null}
    </div>
  );
}
