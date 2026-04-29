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
      { label: "Bookings", href: "/owner/bookings", icon: "CalendarDays" },
      { label: "Branches", href: "/owner/branches", icon: "Building2" },
      { label: "Staff", href: "/owner/staff", icon: "Users" },
      { label: "Services", href: "/owner/services", icon: "Sparkles" },
    ],
  },
  manager: {
    role: "manager",
    label: "Manager",
    items: [
      { label: "Schedule", href: "/manager", icon: "CalendarDays" },
      { label: "Walk-in", href: "/manager/walkin", icon: "UserPlus" },
      { label: "Bookings", href: "/manager/bookings", icon: "ClipboardList" },
      { label: "Staff", href: "/manager/staff", icon: "Users" },
    ],
  },
  crm: {
    role: "crm",
    label: "CRM",
    items: [
      { label: "Customers", href: "/crm", icon: "Users" },
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
};
