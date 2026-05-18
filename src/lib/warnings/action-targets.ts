/**
 * Pre-built ActionableWarningTarget factories for every known warning context
 * in CradleHub. Import what you need; tree-shaking removes the rest.
 *
 * Usage:
 *   import { warningTargets } from "@/lib/warnings/action-targets";
 *   target: warningTargets.staffServiceEditor()
 */

import type { ActionableWarningTarget } from "@/types/warnings";

export const warningTargets = {
  // ── Staff — Manager workspace ──────────────────────────────────────────────

  /** Open the service capability editor sheet on the staff approval page. */
  staffServiceEditor: (): ActionableWarningTarget => ({
    type: "open-panel",
    panelId: "service-editor",
  }),

  /** Focus a specific field on the staff information card. */
  staffField: (fieldId: string): ActionableWarningTarget => ({
    type: "focus",
    fieldId,
  }),

  /** Navigate to the manager's staff list. */
  managerStaffList: (): ActionableWarningTarget => ({
    type: "navigate",
    href: "/manager/staff",
  }),

  /** Navigate to a specific staff member edit page (manager context). */
  managerStaffDetail: (staffId: string): ActionableWarningTarget => ({
    type: "navigate",
    href: `/manager/staff/${staffId}`,
  }),

  /** Navigate to staff applications / pending approvals (CRM view). */
  crmStaffApplications: (): ActionableWarningTarget => ({
    type: "navigate",
    href: "/crm/staff-applications",
  }),

  // ── Staff — Owner workspace ────────────────────────────────────────────────

  /** Navigate to the owner's staff list. */
  ownerStaffList: (): ActionableWarningTarget => ({
    type: "navigate",
    href: "/owner/staff",
  }),

  /** Navigate to a specific staff member edit page (owner context). */
  ownerStaffDetail: (staffId: string): ActionableWarningTarget => ({
    type: "navigate",
    href: `/owner/staff/${staffId}`,
  }),

  // ── Scheduling ─────────────────────────────────────────────────────────────

  /** Navigate to manager scheduling rules. */
  schedulingRules: (): ActionableWarningTarget => ({
    type: "navigate",
    href: "/manager/settings",
    tab: "scheduling",
  }),

  /** Navigate to the manager schedule view, optionally pre-set to a date. */
  scheduleView: (date?: string): ActionableWarningTarget => ({
    type: "navigate",
    href: "/manager/schedule",
    query: date ? { date } : undefined,
  }),

  /** Navigate to the scheduling suggestions review panel. */
  schedulingSuggestions: (): ActionableWarningTarget => ({
    type: "navigate",
    href: "/manager/scheduling",
  }),

  // ── Branches ───────────────────────────────────────────────────────────────

  /** Navigate to the owner branch list. */
  ownerBranchList: (): ActionableWarningTarget => ({
    type: "navigate",
    href: "/owner/branches",
  }),

  /** Navigate to a branch edit page. */
  branchSettings: (branchId: string): ActionableWarningTarget => ({
    type: "navigate",
    href: `/owner/branches/${branchId}`,
  }),

  /** Navigate to a branch's booking rules tab. */
  branchBookingRules: (branchId: string): ActionableWarningTarget => ({
    type: "navigate",
    href: `/owner/branches/${branchId}`,
    tab: "booking-rules",
  }),

  /** Navigate to a branch's services tab. */
  branchServices: (branchId: string): ActionableWarningTarget => ({
    type: "navigate",
    href: `/owner/branches/${branchId}`,
    tab: "services",
  }),

  /** Navigate to the manager's spaces & rules page. */
  managerSpacesRules: (): ActionableWarningTarget => ({
    type: "navigate",
    href: "/manager/spaces-rules",
  }),

  /** Navigate to the manager's resources page. */
  managerResources: (): ActionableWarningTarget => ({
    type: "navigate",
    href: "/manager/resources",
  }),

  // ── Services ───────────────────────────────────────────────────────────────

  /** Navigate to the owner services catalog. */
  ownerServicesList: (): ActionableWarningTarget => ({
    type: "navigate",
    href: "/owner/services",
  }),

  /** Navigate to a specific service edit page. */
  ownerServiceDetail: (serviceId: string): ActionableWarningTarget => ({
    type: "navigate",
    href: `/owner/services/${serviceId}`,
  }),

  /** Navigate to the manager's services offered page. */
  managerServices: (): ActionableWarningTarget => ({
    type: "navigate",
    href: "/manager/services",
  }),

  // ── Bookings ───────────────────────────────────────────────────────────────

  /** Navigate to the CRM bookings page. */
  crmBookings: (): ActionableWarningTarget => ({
    type: "navigate",
    href: "/crm/bookings",
  }),

  /** Navigate to create a new booking in CRM. */
  crmNewBooking: (): ActionableWarningTarget => ({
    type: "navigate",
    href: "/crm/bookings/new",
  }),

  /** Navigate to the manager bookings page. */
  managerBookings: (): ActionableWarningTarget => ({
    type: "navigate",
    href: "/manager/bookings",
  }),

  /** Navigate to the live operations view. */
  liveOperations: (workspace: "crm" | "manager" = "manager"): ActionableWarningTarget => ({
    type: "navigate",
    href: `/${workspace}/live-operations`,
  }),

  // ── Dispatch ───────────────────────────────────────────────────────────────

  /** Navigate to the CRM dispatch page. */
  crmDispatch: (): ActionableWarningTarget => ({
    type: "navigate",
    href: "/crm/dispatch",
  }),

  /** Navigate to the manager dispatch page. */
  managerDispatch: (): ActionableWarningTarget => ({
    type: "navigate",
    href: "/manager/dispatch",
  }),

  // ── Notifications / Action center ─────────────────────────────────────────

  /** Navigate to the manager notifications page. */
  managerNotifications: (): ActionableWarningTarget => ({
    type: "navigate",
    href: "/manager/notifications",
  }),

  /** Navigate to the CRM notifications page. */
  crmNotifications: (): ActionableWarningTarget => ({
    type: "navigate",
    href: "/crm/notifications",
  }),

  // ── Settings ───────────────────────────────────────────────────────────────

  /** Navigate to the manager settings page with an optional tab. */
  managerSettings: (tab?: string): ActionableWarningTarget => ({
    type: "navigate",
    href: "/manager/settings",
    tab,
  }),

  // ── Scroll / Focus on current page ────────────────────────────────────────

  /** Smooth-scroll to any element by id on the current page. */
  scrollTo: (sectionId: string): ActionableWarningTarget => ({
    type: "scroll",
    sectionId,
  }),

  /** Focus any form field by id on the current page. */
  focusField: (fieldId: string): ActionableWarningTarget => ({
    type: "focus",
    fieldId,
  }),

  // ── Generic custom action ─────────────────────────────────────────────────

  /**
   * A caller-defined action. The component will call onAction(warning).
   * Use when none of the above targets applies.
   * panelId is optional metadata for the caller to identify what to open.
   */
  custom: (panelId?: string): ActionableWarningTarget => ({
    type: "custom",
    panelId,
  }),
} as const;
