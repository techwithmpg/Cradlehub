import type { ComponentType, ReactNode } from "react";

export type StaffOperationalRole =
  | "therapist"
  | "nail_tech"
  | "aesthetician"
  | "salon_head"
  | "crm_general"
  | "utility"
  | "driver";

export type NavigationProfile =
  | "provider"
  | "crm_general"
  | "utility"
  | "driver";

export type ConnectivityState =
  | "ONLINE"
  | "OFFLINE"
  | "RECONNECTING"
  | "REQUEST_FAILED"
  | "NOT_RECORDED";

export type StaffNavItem = {
  key: string;
  label: string;
  href: string;
  icon: ComponentType<{ className?: string; size?: number; "aria-hidden"?: boolean | "true" | "false" }>;
  badgeCount?: number;
  isScan?: boolean;
  disabled?: boolean;
  blockedNotice?: string;
};

export type StaffTopBarProps = {
  title?: string;
  brandTitle?: string;
  isToday?: boolean;
  onBack?: () => void;
  backHref?: string;
  backLabel?: string;
  unreadNoticeCount?: number;
  onNoticeClick?: () => void;
  noticeHref?: string;
  userAvatarUrl?: string | null;
  userName?: string | null;
  roleChipLabel?: string | null;
  branchName?: string | null;
  businessDateLabel?: string | null;
  rightAction?: ReactNode;
};

export type StaffBottomNavProps = {
  items: StaffNavItem[];
  activeKey?: string;
  onScanClick?: () => void;
  ariaLabel?: string;
};

export type StatusChipVariant =
  | "confirmed"
  | "pending"
  | "stale"
  | "offline"
  | "blocked"
  | "info";

export type ActionButtonVariant =
  | "primary"
  | "secondary"
  | "destructive"
  | "outline"
  | "ghost";
