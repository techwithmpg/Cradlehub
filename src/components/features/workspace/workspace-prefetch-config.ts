export type PrefetchTier = "immediate" | "idle" | "hover";

export type WorkspacePrefetchConfig = {
  immediate: string[];
  idle: string[];
  hover: string[];
};

// ── CRM ───────────────────────────────────────────────────────────────────────

export const CRM_PREFETCH: WorkspacePrefetchConfig = {
  immediate: ["/crm/today", "/crm/bookings", "/crm/schedule"],
  idle: [
    "/crm/customers",
    "/crm/cash-flow",
    "/crm/attendance",
    "/crm/dispatch",
    "/crm/staff",
  ],
  hover: [
    "/crm/live-operations",
    "/crm/setup",
    "/crm/staff-applications",
    "/crm/schedule?tab=setup",
    "/crm/services",
    "/crm/spaces-rules",
    "/crm/repeats",
    "/crm/lapsed",
    "/crm/waitlist",
    "/crm/notifications",
    "/crm/reconciliation",
  ],
};

// ── Manager ───────────────────────────────────────────────────────────────────

export const MANAGER_PREFETCH: WorkspacePrefetchConfig = {
  immediate: [
    "/manager",
    "/manager/control",
    "/manager/bookings",
    "/manager/dispatch",
    "/manager/schedule",
  ],
  idle: [
    "/manager/staff-availability",
    "/manager/spaces-rules",
    "/manager/services",
    "/manager/staff",
    "/manager/operations",
    "/manager/settings",
  ],
  hover: ["/manager/live-operations", "/manager/resources", "/manager/reports", "/manager/today"],
};

// ── Owner ─────────────────────────────────────────────────────────────────────

export const OWNER_PREFETCH: WorkspacePrefetchConfig = {
  immediate: ["/owner", "/owner/bookings", "/owner/reports"],
  idle: [
    "/owner/cash-flow",
    "/owner/schedule",
    "/owner/attendance",
    "/owner/payroll",
    "/owner/staff",
    "/owner/branches",
  ],
  hover: [
    "/owner/marketing",
    "/owner/services",
    "/owner/spaces-rules",
    "/owner/dispatch",
    "/owner/notifications",
  ],
};

// ── Marketing ────────────────────────────────────────────────────────────────

export const MARKETING_PREFETCH: WorkspacePrefetchConfig = {
  immediate: [],
  idle: ["/marketing", "/marketing/media"],
  hover: [],
};

// ── Staff Portal ──────────────────────────────────────────────────────────────

export const STAFF_PORTAL_PREFETCH: WorkspacePrefetchConfig = {
  immediate: ["/staff-portal", "/staff-portal/schedule", "/staff-portal/today"],
  idle: [
    "/staff-portal/week",
    "/staff-portal/profile",
    "/staff-portal/attendance",
    "/staff-portal/notifications",
  ],
  hover: ["/staff-portal/dispatch", "/staff-portal/stats"],
};

export const STAFF_PWA_PROVIDER_PREFETCH: WorkspacePrefetchConfig = {
  immediate: [],
  idle: ["/staff/schedule", "/staff/progress", "/staff/more"],
  hover: [],
};

export const STAFF_PWA_DRIVER_PREFETCH: WorkspacePrefetchConfig = {
  immediate: [],
  idle: ["/staff/driver/trips", "/staff/driver/map", "/staff/driver/more"],
  hover: [],
};

export const STAFF_PWA_UTILITY_PREFETCH: WorkspacePrefetchConfig = {
  immediate: [],
  idle: ["/staff/utility/work", "/staff/utility/rooms", "/staff/utility/more"],
  hover: [],
};

export const STAFF_PWA_CRM_GENERAL_PREFETCH: WorkspacePrefetchConfig = {
  immediate: [],
  idle: ["/staff/work", "/staff/notices", "/staff/more"],
  hover: [],
};

// ── Driver ────────────────────────────────────────────────────────────────────

export const DRIVER_PREFETCH: WorkspacePrefetchConfig = {
  immediate: ["/driver", "/driver/dispatch"],
  idle: [],
  hover: [],
};

export const WORKSPACE_PREFETCH_CONFIGS: Record<string, WorkspacePrefetchConfig> = {
  crm: CRM_PREFETCH,
  manager: MANAGER_PREFETCH,
  owner: OWNER_PREFETCH,
  marketing: MARKETING_PREFETCH,
  staff: STAFF_PORTAL_PREFETCH,
  driver: DRIVER_PREFETCH,
};
