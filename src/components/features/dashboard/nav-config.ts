export type NavItem = {
  label: string;
  href: string;
  icon: string; // Lucide icon name
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export type WorkspaceNav = {
  role: string;
  label: string;
  items?: NavItem[];
  groups?: NavGroup[];
};

const OWNER_NAV_ITEMS: NavItem[] = [
  { label: "Overview", href: "/owner", icon: "LayoutDashboard" },
  { label: "Schedule", href: "/owner/schedule", icon: "CalendarDays" },
  { label: "Bookings", href: "/owner/bookings", icon: "CalendarDays" },
  { label: "Reports", href: "/owner/reports", icon: "BarChart2" },
  { label: "Marketing Studio", href: "/owner/marketing", icon: "Sparkles" },
  { label: "Dispatch", href: "/owner/dispatch", icon: "Truck" },
  { label: "Branches", href: "/owner/branches", icon: "Building2" },
  { label: "Spaces & Rules", href: "/owner/spaces-rules", icon: "Building2" },
  { label: "Staff", href: "/owner/staff", icon: "Users" },
  { label: "Payroll", href: "/owner/payroll", icon: "DollarSign" },
  { label: "Services", href: "/owner/services", icon: "Sparkles" },
  { label: "Notifications", href: "/owner/notifications", icon: "Bell" },
  { label: "Dev Panel", href: "/dev", icon: "Wrench" },
];

const MANAGER_NAV_ITEMS: NavItem[] = [
  { label: "Today", href: "/manager", icon: "LayoutDashboard" },
  { label: "Control", href: "/manager/control", icon: "Monitor" },
  { label: "Live Map", href: "/manager/live-operations", icon: "MapPin" },
  { label: "Dispatch", href: "/manager/dispatch", icon: "Truck" },
  { label: "Schedule", href: "/manager/schedule", icon: "CalendarDays" },
  { label: "Bookings", href: "/manager/bookings", icon: "ClipboardList" },
  { label: "Staff", href: "/manager/staff", icon: "Users" },
  { label: "Availability", href: "/manager/staff-availability", icon: "CalendarClock" },
  { label: "Spaces & Rules", href: "/manager/spaces-rules", icon: "Building2" },
  { label: "Services", href: "/manager/services", icon: "Sparkles" },
  { label: "Operations", href: "/manager/operations", icon: "Wrench" },
  { label: "Settings", href: "/manager/settings", icon: "Settings" },
];

// ── CRM / front-desk grouped navigation ──────────────────────────────────────

const CRM_NAV_GROUPS: NavGroup[] = [
  {
    label: "Main Operations",
    items: [
      { label: "Today",          href: "/crm/today",           icon: "LayoutDashboard" },
      { label: "Control Center", href: "/crm/control",         icon: "Monitor" },
      { label: "Bookings",       href: "/crm/bookings",        icon: "ClipboardList" },
      { label: "Dispatch",       href: "/crm/dispatch",        icon: "Truck" },
      { label: "Live Map",       href: "/crm/live-operations", icon: "MapPin" },
      { label: "Schedule",       href: "/crm/schedule",        icon: "CalendarDays" },
    ],
  },
  {
    label: "Daily Readiness",
    items: [
      { label: "Staff Availability", href: "/crm/availability",       icon: "UserCheck" },
      { label: "Schedule Setup",     href: "/crm/staff-availability", icon: "CalendarClock" },
    ],
  },
  {
    label: "Customer Management",
    items: [
      { label: "Customers", href: "/crm/customers", icon: "Users" },
      { label: "Repeats",   href: "/crm/repeats",   icon: "Heart" },
      { label: "Lapsed",    href: "/crm/lapsed",    icon: "ClockAlert" },
      { label: "Waitlist",  href: "/crm/waitlist",  icon: "UserPlus" },
    ],
  },
  {
    label: "Service & Resource Setup",
    items: [
      { label: "Rules & Setup",  href: "/crm/setup",        icon: "Wrench" },
      { label: "Services",       href: "/crm/services",     icon: "Sparkles" },
      { label: "Spaces & Rules", href: "/crm/spaces-rules", icon: "Building2" },
    ],
  },
  {
    label: "Staff & Internal Work",
    items: [
      { label: "Staff Applications", href: "/crm/staff-applications", icon: "ClipboardCheck" },
      { label: "Notifications",      href: "/crm/notifications",      icon: "Bell" },
    ],
  },
  {
    label: "Finance / End-of-day",
    items: [
      { label: "Reconciliation", href: "/crm/reconciliation", icon: "BarChart2" },
    ],
  },
];

// CSR Head and CSR Staff share the same full CRM workspace nav.
// All front-desk roles access all CRM pages — page-level edit permissions
// still restrict specific actions (e.g. owner-only resource editing).
const CSR_HEAD_NAV_GROUPS: NavGroup[] = [...CRM_NAV_GROUPS];
const CSR_STAFF_NAV_GROUPS: NavGroup[] = [...CRM_NAV_GROUPS];

const STAFF_NAV_ITEMS: NavItem[] = [
  { label: "Today", href: "/staff-portal", icon: "LayoutDashboard" },
  { label: "My Schedule", href: "/staff-portal/schedule", icon: "CalendarDays" },
  { label: "My Week", href: "/staff-portal/week", icon: "CalendarDays" },
  { label: "Dispatch", href: "/staff-portal/dispatch", icon: "Truck" },
  { label: "My Stats", href: "/staff-portal/stats", icon: "TrendingUp" },
  { label: "Profile", href: "/staff-portal/profile", icon: "User" },
  { label: "Notifications", href: "/staff-portal/notifications", icon: "Bell" },
];

const DRIVER_NAV_ITEMS: NavItem[] = [
  { label: "Driver Panel", href: "/driver", icon: "Truck" },
  { label: "Dispatch", href: "/driver/dispatch", icon: "MapPin" },
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
    groups: CRM_NAV_GROUPS,
  },
  csr_head: {
    role: "csr_head",
    label: "CSR Head",
    groups: CSR_HEAD_NAV_GROUPS,
  },
  csr_staff: {
    role: "csr_staff",
    label: "CSR Staff",
    groups: CSR_STAFF_NAV_GROUPS,
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
