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
  /** When true, this workspace is hidden from the nav/switcher during MVP. */
  mvpHidden?: boolean;
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

// ── CRM / front-desk navigation ───────────────────────────────────────────────
// 7 top-level items only. Related pages become tabs inside each section.
// Routes removed from nav are NOT deleted — they stay live and will be
// redirected to tab URLs in Phase 3:
//   /crm/control           → /crm/today?tab=control
//   /crm/reconciliation    → /crm/today?panel=reconciliation
//   /crm/waitlist          → /crm/bookings?tab=waitlist
//   /crm/availability      → /crm/schedule?tab=availability
//   /crm/staff-availability → /crm/schedule?tab=setup
//   /crm/repeats           → /crm/customers?tab=repeats
//   /crm/lapsed            → /crm/customers?tab=lapsed
//   /crm/services          → /crm/setup?tab=services
//   /crm/spaces-rules      → /crm/setup?tab=spaces-rules
//   /crm/live-operations   → /crm/dispatch?tab=live-map
//   /crm/notifications     → header bell / action center

const CRM_NAV_ITEMS: NavItem[] = [
  { label: "Today",        href: "/crm/today",              icon: "LayoutDashboard" },
  { label: "Bookings",     href: "/crm/bookings",           icon: "ClipboardList"   },
  { label: "Schedule",     href: "/crm/schedule",           icon: "CalendarDays"    },
  { label: "Customers",    href: "/crm/customers",          icon: "Users"           },
  { label: "Setup Center", href: "/crm/setup",              icon: "Wrench"          },
  { label: "Staff",        href: "/crm/staff",              icon: "UserCheck"       },
  { label: "Dispatch",     href: "/crm/dispatch",           icon: "Truck"           },
];

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
    // MVP: manager workspace is soft-paused; manager users are routed to CRM.
    mvpHidden: true,
  },
  crm: {
    role: "crm",
    label: "CRM",
    items: CRM_NAV_ITEMS,
  },
  csr_head: {
    role: "csr_head",
    label: "CSR Head",
    items: CRM_NAV_ITEMS,
  },
  csr_staff: {
    role: "csr_staff",
    label: "CSR Staff",
    items: CRM_NAV_ITEMS,
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
  if (role === "owner") {
    return "owner";
  }

  // MVP: management roles use the CRM workspace nav while Manager remains soft-paused.
  if (
    role === "manager" ||
    role === "assistant_manager" ||
    role === "store_manager"
  ) {
    return "crm";
  }
  if (role === "csr_head") {
    return "csr_head";
  }
  if (role === "csr_staff" || role === "csr") {
    return "csr_staff";
  }
  if (
    role === "crm" ||
    role === "staff" ||
    role === "driver" ||
    role === "utility"
  ) {
    return role;
  }
  return "staff";
}
