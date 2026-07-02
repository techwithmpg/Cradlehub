import { createClient } from "@/lib/supabase/server";
import { getBranchBookingRulesOrDefault } from "./branch-booking-rules";
import { SERVICE_STAFF_TYPES } from "@/constants/staff-roles";
import { getBranchBusinessDate } from "@/lib/engine/slot-time";

// ── Types ──────────────────────────────────────────────────────────────────────

export type SetupIssue = {
  id: string;
  severity: "error" | "warning" | "info";
  title: string;
  detail: string;
  impact: string;
  fixHref: string;
  fixLabel: string;
};

export type CrmSetupHealthData = {
  /** Staff whose staff_type is service-facing (therapist, nail_tech, etc.) */
  serviceStaffTotal: number;
  /** Service staff with at least one individual schedule row */
  serviceStaffWithSchedule: number;
  /** Active branch services */
  activeServicesTotal: number;
  /** Active branch services that have at least one staff_services record */
  servicesWithStaff: number;
  /** Number of active rooms/resources */
  activeResourcesTotal: number;
  /** Whether booking rules exist (not just defaults) */
  hasCustomRules: boolean;
  /** Whether home service is enabled */
  homeServiceEnabled: boolean;
  /** Number of active driver-type staff */
  driversTotal: number;
  /** Unassigned confirmed bookings for today */
  unassignedTodayCount: number;
  /** Issues derived from the above */
  issues: SetupIssue[];
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function deriveIssues(d: Omit<CrmSetupHealthData, "issues">): SetupIssue[] {
  const issues: SetupIssue[] = [];

  const missingSchedule = d.serviceStaffTotal - d.serviceStaffWithSchedule;
  if (missingSchedule > 0) {
    issues.push({
      id: "no-schedule",
      severity: "warning",
      title: `${missingSchedule} therapist${missingSchedule > 1 ? "s have" : " has"} no schedule set up`,
      detail: `${missingSchedule} of ${d.serviceStaffTotal} service staff members have no weekly schedule rows. They will not appear in the booking engine.`,
      impact: "Customers will see fewer available therapists during online booking.",
      fixHref: "/crm/staff-availability",
      fixLabel: "Set Up Schedules",
    });
  }

  const servicesWithoutStaff = d.activeServicesTotal - d.servicesWithStaff;
  if (servicesWithoutStaff > 0) {
    issues.push({
      id: "no-staff-for-service",
      severity: "error",
      title: `${servicesWithoutStaff} active service${servicesWithoutStaff > 1 ? "s have" : " has"} no assigned therapist`,
      detail: `${servicesWithoutStaff} of ${d.activeServicesTotal} branch services have zero therapist assignments in staff_services. The booking wizard will show an empty therapist list for these services.`,
      impact: "Customers cannot complete bookings for these services online.",
      fixHref: "/crm/services",
      fixLabel: "Assign Therapists",
    });
  }

  if (d.homeServiceEnabled && d.driversTotal === 0) {
    issues.push({
      id: "no-drivers",
      severity: "error",
      title: "Home service is enabled but no drivers are set up",
      detail: "Home service bookings are allowed, but there are no active driver-type staff members at this branch.",
      impact: "Home service bookings cannot be dispatched.",
      fixHref: "/crm/dispatch",
      fixLabel: "Review Dispatch",
    });
  }

  if (d.activeResourcesTotal === 0) {
    issues.push({
      id: "no-resources",
      severity: "warning",
      title: "No rooms or resources configured",
      detail: "This branch has no active rooms or service resources. Resource-based booking rules cannot apply.",
      impact: "In-spa bookings may not be linked to specific rooms.",
      fixHref: "/crm/spaces-rules",
      fixLabel: "Configure Spaces",
    });
  }

  if (!d.hasCustomRules) {
    issues.push({
      id: "default-rules",
      severity: "info",
      title: "Booking rules are using system defaults",
      detail: "No custom booking rules have been saved for this branch. The system defaults are active.",
      impact: "Opening hours, slot intervals, and advance booking windows may not match your branch operations.",
      fixHref: "/crm/spaces-rules",
      fixLabel: "Review Rules",
    });
  }

  if (d.unassignedTodayCount > 0) {
    issues.push({
      id: "unassigned-bookings",
      severity: "error",
      title: `${d.unassignedTodayCount} confirmed booking${d.unassignedTodayCount > 1 ? "s" : ""} today with no therapist assigned`,
      detail: `${d.unassignedTodayCount} confirmed booking${d.unassignedTodayCount > 1 ? "s are" : " is"} missing a staff assignment. These need to be assigned before service can begin.`,
      impact: "Bookings may start without a therapist ready.",
      fixHref: "/crm/today?filter=exceptions",
      fixLabel: "Open Work Queue",
    });
  }

  return issues;
}

// ── Main query ─────────────────────────────────────────────────────────────────

export async function getCrmSetupHealth(branchId: string): Promise<CrmSetupHealthData> {
  const supabase = await createClient();
  const today = getBranchBusinessDate();
  const dayOfWeek = new Date(today + "T00:00:00").getDay();

  const serviceStaffTypes = SERVICE_STAFF_TYPES as readonly string[];

  const [
    staffResult,
    scheduledStaffResult,
    branchServicesResult,
    servicesWithStaffResult,
    resourcesResult,
    rulesRaw,
    driversResult,
    unassignedResult,
  ] = await Promise.all([
    // Total service-providing staff at branch
    supabase
      .from("staff")
      .select("id", { count: "exact", head: true })
      .eq("branch_id", branchId)
      .eq("is_active", true)
      .in("staff_type", serviceStaffTypes),

    // Service staff with at least one individual schedule row
    supabase
      .from("staff_schedules")
      .select("staff_id")
      .eq("is_active", true)
      .eq("day_of_week", dayOfWeek)
      .in(
        "staff_id",
        // Subquery not supported in JS client — we'll handle this by fetching all branch service staff IDs separately
        // For now: select all scheduled staff IDs and cross-reference below
        (
          await supabase
            .from("staff")
            .select("id")
            .eq("branch_id", branchId)
            .eq("is_active", true)
            .in("staff_type", serviceStaffTypes)
        ).data?.map((s) => s.id) ?? []
      ),

    // Total active branch services
    supabase
      .from("branch_services")
      .select("service_id", { count: "exact", head: false })
      .eq("branch_id", branchId)
      .eq("is_active", true),

    // Branch services that have at least one staff_services entry
    supabase
      .from("staff_services")
      .select("service_id")
      .in(
        "service_id",
        (
          await supabase
            .from("branch_services")
            .select("service_id")
            .eq("branch_id", branchId)
            .eq("is_active", true)
        ).data?.map((s) => s.service_id) ?? []
      ),

    // Active rooms/resources
    supabase
      .from("branch_resources")
      .select("id", { count: "exact", head: true })
      .eq("branch_id", branchId)
      .eq("is_active", true),

    // Booking rules
    getBranchBookingRulesOrDefault(branchId).catch(() => null),

    // Active drivers
    supabase
      .from("staff")
      .select("id", { count: "exact", head: true })
      .eq("branch_id", branchId)
      .eq("is_active", true)
      .eq("staff_type", "driver"),

    // Unassigned confirmed bookings today
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("branch_id", branchId)
      .eq("booking_date", today)
      .eq("status", "confirmed")
      .is("staff_id", null),
  ]);

  const serviceStaffTotal = staffResult.count ?? 0;

  // De-duplicate staff IDs from the schedule results
  const scheduledStaffIds = new Set(
    (scheduledStaffResult.data ?? []).map((r) => r.staff_id)
  );
  const serviceStaffWithSchedule = scheduledStaffIds.size;

  const activeServicesTotal = (branchServicesResult.data ?? []).length;

  // Count distinct service_ids that have at least one staff_services row
  const serviceIdsWithStaff = new Set(
    (servicesWithStaffResult.data ?? []).map((r) => r.service_id)
  );
  const servicesWithStaff = serviceIdsWithStaff.size;

  const activeResourcesTotal = resourcesResult.count ?? 0;

  const rules = rulesRaw;
  // Rules are "custom" if they have a database id (not just computed defaults)
  const hasCustomRules = !!(rules?.id);
  const homeServiceEnabled = rules?.homeServiceEnabled ?? false;

  const driversTotal = driversResult.count ?? 0;

  const unassignedTodayCount = unassignedResult.count ?? 0;

  const base = {
    serviceStaffTotal,
    serviceStaffWithSchedule,
    activeServicesTotal,
    servicesWithStaff,
    activeResourcesTotal,
    hasCustomRules,
    homeServiceEnabled,
    driversTotal,
    unassignedTodayCount,
  };

  return { ...base, issues: deriveIssues(base) };
}
