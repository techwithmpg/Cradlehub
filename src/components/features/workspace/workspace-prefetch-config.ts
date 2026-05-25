/**
 * Workspace Route Prefetch Configuration
 *
 * Defines which routes should be prefetched for each workspace.
 *
 * Priority tiers:
 *   - immediate: prefetched as soon as the workspace loads (on mount).
 *   - idle:      prefetched via requestIdleCallback (or setTimeout fallback).
 *   - hover:     prefetched on mouseEnter of the sidebar link (handled by NavLink).
 *
 * Heavy routes (reports, analytics, large tables, map bundles) are NEVER
 * auto-prefetched — they wait for hover or explicit user intent.
 */

export type PrefetchTier = "immediate" | "idle" | "hover";

export type WorkspacePrefetchConfig = {
  /** Routes to warm up immediately after the workspace shell mounts. */
  immediate: string[];
  /** Routes to warm up when the browser is idle. */
  idle: string[];
  /** Routes that are considered heavy and should only prefetch on hover. */
  hover: string[];
};

// ── CRM ───────────────────────────────────────────────────────────────────────

export const CRM_PREFETCH: WorkspacePrefetchConfig = {
  immediate: [
    "/crm",
    "/crm/today",
    "/crm/control",
    "/crm/bookings",
    "/crm/dispatch",
  ],
  idle: [
    "/crm/availability",
    "/crm/staff-availability",
    "/crm/customers",
    "/crm/schedule",
    "/crm/services",
    "/crm/setup",
    "/crm/spaces-rules",
  ],
  hover: [
    "/crm/live-operations",
    "/crm/reconciliation",
    "/crm/repeats",
    "/crm/lapsed",
    "/crm/waitlist",
    "/crm/notifications",
    "/crm/staff-applications",
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
  hover: [
    "/manager/live-operations",
    "/manager/resources",
    "/manager/reports",
    "/manager/today",
  ],
};

// ── Owner ─────────────────────────────────────────────────────────────────────

export const OWNER_PREFETCH: WorkspacePrefetchConfig = {
  immediate: [
    "/owner",
    "/owner/bookings",
    "/owner/branches",
    "/owner/staff",
    "/owner/services",
  ],
  idle: [
    "/owner/schedule",
    "/owner/spaces-rules",
    "/owner/dispatch",
    "/owner/notifications",
    "/owner/settings",
  ],
  hover: [
    "/owner/reports",
    "/owner/marketing",
    "/owner/payroll",
    "/dev",
  ],
};

// ── Staff Portal ──────────────────────────────────────────────────────────────

export const STAFF_PORTAL_PREFETCH: WorkspacePrefetchConfig = {
  immediate: ["/staff-portal", "/staff-portal/schedule", "/staff-portal/today"],
  idle: ["/staff-portal/week", "/staff-portal/profile", "/staff-portal/notifications"],
  hover: ["/staff-portal/dispatch", "/staff-portal/stats"],
};

// ── Driver ────────────────────────────────────────────────────────────────────

export const DRIVER_PREFETCH: WorkspacePrefetchConfig = {
  immediate: ["/driver", "/driver/dispatch"],
  idle: [],
  hover: [],
};

// ── Config registry ───────────────────────────────────────────────────────────

export const WORKSPACE_PREFETCH_CONFIGS: Record<string, WorkspacePrefetchConfig> = {
  crm: CRM_PREFETCH,
  csr_head: CRM_PREFETCH,
  csr_staff: CRM_PREFETCH,
  manager: MANAGER_PREFETCH,
  owner: OWNER_PREFETCH,
  staff: STAFF_PORTAL_PREFETCH,
  driver: DRIVER_PREFETCH,
};
