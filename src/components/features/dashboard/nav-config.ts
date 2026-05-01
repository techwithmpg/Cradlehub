export type NavItem = {
  label: string;
  href: string;
  icon: string; // Lucide icon name
};

export type WorkspaceNav = {
  role: string;
  label: string;
  items: NavItem[];
};

export const NAV_CONFIG: Record<string, WorkspaceNav> = {
  owner: {
    role: "owner",
    label: "Owner",
    items: [
      { label: "Overview", href: "/owner", icon: "LayoutDashboard" },
      { label: "Schedule", href: "/owner/schedule", icon: "CalendarDays" },
      { label: "Bookings", href: "/owner/bookings", icon: "CalendarDays" },
      { label: "Branches", href: "/owner/branches", icon: "Building2" },
      { label: "Staff", href: "/owner/staff", icon: "Users" },
      { label: "Services", href: "/owner/services", icon: "Sparkles" },
      { label: "Dev Panel", href: "/dev", icon: "Wrench" },
    ],
  },
  manager: {
    role: "manager",
    label: "Manager",
    items: [
      { label: "Today", href: "/manager", icon: "LayoutDashboard" },
      { label: "Schedule", href: "/manager/schedule", icon: "CalendarDays" },
      { label: "Bookings", href: "/manager/bookings", icon: "ClipboardList" },
      { label: "Staff", href: "/manager/staff", icon: "Users" },
      { label: "Operations", href: "/manager/operations", icon: "Monitor" },
      { label: "Reports", href: "/manager/reports", icon: "BarChart2" },
    ],
  },
  crm: {
    role: "crm",
    label: "CRM",
    items: [
      { label: "Customers", href: "/crm", icon: "Users" },
      { label: "Bookings", href: "/manager/bookings", icon: "ClipboardList" },
      { label: "Repeats", href: "/crm/repeats", icon: "Heart" },
      { label: "Lapsed", href: "/crm/lapsed", icon: "ClockAlert" },
    ],
  },
  staff: {
    role: "staff",
    label: "Staff",
    items: [
      { label: "Today", href: "/staff-portal", icon: "Sun" },
      { label: "My Week", href: "/staff-portal/week", icon: "CalendarDays" },
      { label: "My Stats", href: "/staff-portal/stats", icon: "BarChart2" },
    ],
  },
  driver: {
    role: "driver",
    label: "Driver",
    items: [
      { label: "Driver Panel", href: "/driver", icon: "Truck" },
    ],
  },
  utility: {
    role: "utility",
    label: "Utility",
    items: [
      { label: "Utility Panel", href: "/utility", icon: "Wrench" },
    ],
  },
};

const WORKSPACE_PREFIX_TO_KEY = [
  { prefix: "/owner", key: "owner" },
  { prefix: "/manager", key: "manager" },
  { prefix: "/crm", key: "crm" },
  { prefix: "/staff-portal", key: "staff" },
  { prefix: "/driver", key: "driver" },
  { prefix: "/utility", key: "utility" },
  { prefix: "/dev", key: "dev" },
] as const;

export function resolveWorkspaceKeyFromPath(pathname: string): string | null {
  const matched = WORKSPACE_PREFIX_TO_KEY.find((entry) => pathname.startsWith(entry.prefix));
  return matched?.key ?? null;
}

export function resolveWorkspaceKeyFromRole(role: string): string {
  if (role === "assistant_manager" || role === "store_manager" || role === "csr") {
    return "manager";
  }
  if (role === "owner" || role === "manager" || role === "crm" || role === "staff") {
    return role;
  }
  return "staff";
}
