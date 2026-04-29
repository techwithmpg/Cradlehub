export const APP_NAME = "CradleHub" as const;
export const APP_DESCRIPTION =
  "Spa booking and staff management for Cradle Massage & Wellness Spa" as const;

export const ROUTES = {
  HOME:      "/",
  SERVICES:  "/services",
  BRANCHES:  "/branches",
  ABOUT:     "/about",
  CONTACT:   "/contact",
  BOOK:      "/book",
  LOGIN:     "/login",
  OWNER:     "/owner",
  MANAGER:   "/manager",
  CRM:       "/crm",
  STAFF:     "/staff-portal",
} as const;

export const BOOKING_STATUS_LABELS: Record<string, string> = {
  pending:     "Pending",
  confirmed:   "Confirmed",
  in_progress: "In Progress",
  completed:   "Completed",
  cancelled:   "Cancelled",
  no_show:     "No Show",
};

export const BOOKING_STATUS_COLORS: Record<string, string> = {
  pending:     "bg-yellow-100 text-yellow-800",
  confirmed:   "bg-blue-100 text-blue-800",
  in_progress: "bg-purple-100 text-purple-800",
  completed:   "bg-green-100 text-green-800",
  cancelled:   "bg-gray-100 text-gray-800",
  no_show:     "bg-red-100 text-red-800",
};

export const DAY_NAMES = [
  "Sunday", "Monday", "Tuesday", "Wednesday",
  "Thursday", "Friday", "Saturday",
] as const;

export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
} as const;
