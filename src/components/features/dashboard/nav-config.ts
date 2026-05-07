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

const OWNER_NAV_ITEMS: NavItem[] = [
  { label: "Overview", href: "/owner", icon: "LayoutDashboard" },
  { label: "Schedule", href: "/owner/schedule", icon: "CalendarDays" },
  { label: "Bookings", href: "/owner/bookings", icon: "CalendarDays" },
  { label: "Reports", href: "/owner/reports", icon: "BarChart2" },
  { label: "Branches", href: "/owner/branches", icon: "Building2" },
  { label: "Staff", href: "/owner/staff", icon: "Users" },
  { label: "Services", href: "/owner/services", icon: "Sparkles" },
  { label: "Dev Panel", href: "/dev", icon: "Wrench" },
];

const MANAGER_NAV_ITEMS: NavItem[] = [
  { label: "Today", href: "/manager", icon: "LayoutDashboard" },
  { label: "Schedule", href: "/manager/schedule", icon: "CalendarDays" },
  { label: "Bookings", href: "/manager/bookings", icon: "ClipboardList" },
  { label: "Staff", href: "/manager/staff", icon: "Users" },
  { label: "Spaces", href: "/manager/resources", icon: "Activity" },
  { label: "Operations", href: "/manager/operations", icon: "Monitor" },
  { label: "Reports", href: "/manager/reports", icon: "BarChart2" },
];

const CRM_NAV_ITEMS: NavItem[] = [
  { label: "Today", href: "/crm/today", icon: "LayoutDashboard" },
  { label: "Customers", href: "/crm/customers", icon: "Users" },
  { label: "Bookings", href: "/crm/bookings", icon: "ClipboardList" },
  { label: "Schedule", href: "/crm/schedule", icon: "CalendarDays" },
  { label: "Repeats", href: "/crm/repeats", icon: "Heart" },
  { label: "Lapsed", href: "/crm/lapsed", icon: "ClockAlert" },
  { label: "Waitlist", href: "/crm/waitlist", icon: "UserPlus" },
  { label: "Reconciliation", href: "/crm/reconciliation", icon: "BarChart2" },
];

const CSR_HEAD_NAV_ITEMS: NavItem[] = [
  { label: "Today", href: "/crm/today", icon: "LayoutDashboard" },
  { label: "Bookings", href: "/crm/bookings", icon: "ClipboardList" },
  { label: "Customers", href: "/crm/customers", icon: "Users" },
  { label: "Schedule", href: "/crm/schedule", icon: "CalendarDays" },
  { label: "Waitlist", href: "/crm/waitlist", icon: "UserPlus" },
  { label: "Reconciliation", href: "/crm/reconciliation", icon: "BarChart2" },
];

const CSR_STAFF_NAV_ITEMS: NavItem[] = [
  { label: "Today", href: "/crm/today", icon: "LayoutDashboard" },
  { label: "Bookings", href: "/crm/bookings", icon: "ClipboardList" },
  { label: "Customers", href: "/crm/customers", icon: "Users" },
  { label: "Schedule", href: "/crm/schedule", icon: "CalendarDays" },
  { label: "Reconciliation", href: "/crm/reconciliation", icon: "BarChart2" },
];

const STAFF_NAV_ITEMS: NavItem[] = [
  { label: "Today", href: "/staff-portal", icon: "LayoutDashboard" },
  { label: "My Week", href: "/staff-portal/week", icon: "CalendarDays" },
  { label: "My Stats", href: "/staff-portal/stats", icon: "TrendingUp" },
  { label: "Profile", href: "/staff-portal/profile", icon: "User" },
];

const DRIVER_NAV_ITEMS: NavItem[] = [
  { label: "Driver Panel", href: "/driver", icon: "Truck" },
];

const UTILITY_NAV_ITEMS: NavItem[] = [
  { label: "Utility Panel", href: "/utility", icon: "Wrench" },
];

export const NAV_CONFIG: Record<string, WorkspaceNav> = {
  owner: {
    role: "owner",
    label: "Owner",
    items: OWNER_NAV_ITEMS,
  },
  manager: {
    role: "manager",
    label: "Manager",
    items: MANAGER_NAV_ITEMS,
  },
  crm: {
    role: "crm",
    label: "CRM",
    items: CRM_NAV_ITEMS,
  },
  csr_head: {
    role: "csr_head",
    label: "CSR Head",
    items: CSR_HEAD_NAV_ITEMS,
  },
  csr_staff: {
    role: "csr_staff",
    label: "CSR Staff",
    items: CSR_STAFF_NAV_ITEMS,
  },
  staff: {
    role: "staff",
    label: "Staff",
    items: STAFF_NAV_ITEMS,
  },
  driver: {
    role: "driver",
    label: "Driver",
    items: DRIVER_NAV_ITEMS,
  },
  utility: {
    role: "utility",
    label: "Utility",
    items: UTILITY_NAV_ITEMS,
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
  if (role === "csr_head") {
    return "csr_head";
  }
  if (role === "csr_staff" || role === "csr") {
    return "csr_staff";
  }
  if (
    role === "owner" ||
    role === "manager" ||
    role === "crm" ||
    role === "staff" ||
    role === "driver" ||
    role === "utility"
  ) {
    return role;
  }
  return "staff";
}
