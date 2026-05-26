import type { Database } from "@/types/supabase";
import type { BranchBookingRules } from "@/lib/validations/booking-rules";

export type ResourceRow = Database["public"]["Tables"]["branch_resources"]["Row"];

export type ConflictBooking = {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  type: string;
  resource_id: string | null;
  staff_id: string | null;
  service_id: string | null;
  customer_name: string | null;
  service_name: string | null;
  staff_name: string | null;
};

export type ResourceConflict =
  | {
      id: string;
      type: "missing_assignment";
      severity: "warning";
      bookingId: string;
      description: string;
    }
  | {
      id: string;
      type: "overlap";
      severity: "critical";
      resourceId: string;
      resourceName: string;
      bookingA: string;
      bookingB: string;
      description: string;
    }
  | {
      id: string;
      type: "capacity_overflow";
      severity: "critical";
      resourceId: string;
      resourceName: string;
      description: string;
    };

export type SpacesRulesTab = "overview" | "spaces" | "rules" | "conflicts";
export type CrmSpacesTab = "overview" | "spaces" | "conflicts";

export function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function rangesOverlap(
  s1: number,
  e1: number,
  s2: number,
  e2: number
): boolean {
  return s1 < e2 && s2 < e1;
}

export function computeResourceConflicts(
  bookings: ConflictBooking[],
  resources: ResourceRow[]
): ResourceConflict[] {
  const conflicts: ResourceConflict[] = [];
  const activeBookings = bookings.filter(
    (b) => b.status !== "cancelled" && b.status !== "no_show"
  );

  // 1. Missing assignments
  for (const b of activeBookings) {
    if (b.type !== "home_service" && !b.resource_id) {
      conflicts.push({
        id: `missing-${b.id}`,
        type: "missing_assignment",
        severity: "warning",
        bookingId: b.id,
        description: `${b.service_name ?? "Booking"} — ${b.customer_name ?? "Customer"} has no room assigned`,
      });
    }
  }

  // 2. Overlaps and capacity
  const byResource = new Map<string, ConflictBooking[]>();
  for (const b of activeBookings) {
    if (!b.resource_id) continue;
    const list = byResource.get(b.resource_id) ?? [];
    list.push(b);
    byResource.set(b.resource_id, list);
  }

  for (const [resourceId, list] of byResource) {
    const resource = resources.find((r) => r.id === resourceId);
    if (!resource) continue;

    // Check pairwise overlaps
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i]!;
        const b = list[j]!;
        const aStart = timeToMinutes(a.start_time);
        const aEnd = timeToMinutes(a.end_time);
        const bStart = timeToMinutes(b.start_time);
        const bEnd = timeToMinutes(b.end_time);

        if (rangesOverlap(aStart, aEnd, bStart, bEnd)) {
          conflicts.push({
            id: `overlap-${a.id}-${b.id}`,
            type: "overlap",
            severity: "critical",
            resourceId,
            resourceName: resource.name,
            bookingA: a.id,
            bookingB: b.id,
            description: `Overlapping bookings on ${resource.name}`,
          });
        }
      }
    }

    // Capacity overflow check
    if (resource.capacity > 1) {
      for (let i = 0; i < list.length; i++) {
        const a = list[i]!;
        const aStart = timeToMinutes(a.start_time);
        const aEnd = timeToMinutes(a.end_time);
        let overlapCount = 0;
        for (let j = 0; j < list.length; j++) {
          if (i === j) continue;
          const b = list[j]!;
          const bStart = timeToMinutes(b.start_time);
          const bEnd = timeToMinutes(b.end_time);
          if (rangesOverlap(aStart, aEnd, bStart, bEnd)) {
            overlapCount++;
          }
        }
        if (overlapCount >= resource.capacity) {
          const alreadyAdded = conflicts.some(
            (c) =>
              c.type === "capacity_overflow" && c.resourceId === resourceId
          );
          if (!alreadyAdded) {
            conflicts.push({
              id: `capacity-${resourceId}`,
              type: "capacity_overflow",
              severity: "critical",
              resourceId,
              resourceName: resource.name,
              description: `${resource.name} is over capacity (${resource.capacity} max)`,
            });
          }
          break;
        }
      }
    }
  }

  return conflicts;
}

export function getResourceIcon(type: string): string {
  switch (type) {
    case "room":
      return "🚪";
    case "bed":
      return "🛌";
    case "chair":
      return "🪑";
    case "equipment":
      return "⚙️";
    case "home_service_unit":
      return "🚗";
    case "shared_area":
      return "👥";
    default:
      return "📦";
  }
}

export function getResourceTypeLabel(type: string): string {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function computeResourceInventory(
  resources: ResourceRow[]
): { type: string; total: number; active: number }[] {
  const map = new Map<string, { total: number; active: number }>();
  for (const r of resources) {
    const current = map.get(r.type) ?? { total: 0, active: 0 };
    current.total++;
    if (r.is_active) current.active++;
    map.set(r.type, current);
  }
  return Array.from(map.entries()).map(([type, counts]) => ({
    type,
    ...counts,
  }));
}

export function computeKpiData(
  resources: ResourceRow[],
  rules: BranchBookingRules,
  conflicts: ResourceConflict[]
) {
  const activeResources = resources.filter((r) => r.is_active);
  const missingAssignments = conflicts.filter(
    (c) => c.type === "missing_assignment"
  ).length;

  return {
    totalSpaces: resources.length,
    activeSpaces: activeResources.length,
    activeRules: rules.id ? 1 : 0,
    conflicts: conflicts.filter((c) => c.severity === "critical").length,
    missingAssignments,
  };
}

// ── CRM Operational KPI ────────────────────────────────────────────────────────

export type CrmOperationalKpiData = {
  totalSpaces: number;
  availableToday: number;
  occupiedNow: number;
  conflicts: number;
  missingAssignments: number;
  blocked: number;
};

/**
 * Computes operational KPIs for CRM front-desk view.
 * - availableToday: active resources not currently in use
 * - occupiedNow: resources with active bookings (checked_in, confirmed, in_progress)
 * - blocked: inactive resources
 */
export function computeCrmOperationalKpi(
  resources: ResourceRow[],
  bookings: ConflictBooking[],
  conflicts: ResourceConflict[]
): CrmOperationalKpiData {
  const activeResources = resources.filter((r) => r.is_active);
  const inactiveResources = resources.filter((r) => !r.is_active);

  // Get resources currently in use (have active bookings)
  const activeBookings = bookings.filter(
    (b) =>
      b.status === "confirmed" ||
      b.status === "checked_in" ||
      b.status === "in_progress"
  );

  const occupiedResourceIds = new Set(
    activeBookings.filter((b) => b.resource_id).map((b) => b.resource_id)
  );

  const occupiedCount = activeResources.filter((r) =>
    occupiedResourceIds.has(r.id)
  ).length;

  const availableCount = activeResources.length - occupiedCount;

  const criticalConflicts = conflicts.filter(
    (c) => c.severity === "critical"
  ).length;

  const missingAssignments = conflicts.filter(
    (c) => c.type === "missing_assignment"
  ).length;

  return {
    totalSpaces: resources.length,
    availableToday: availableCount,
    occupiedNow: occupiedCount,
    conflicts: criticalConflicts,
    missingAssignments,
    blocked: inactiveResources.length,
  };
}

// ── Resource Status Helpers ────────────────────────────────────────────────────

export type ResourceStatus =
  | "available"
  | "in_use"
  | "blocked"
  | "inactive"
  | "needs_setup"
  | "conflict";

export function getResourceStatus(
  resource: ResourceRow,
  bookings: ConflictBooking[],
  conflicts: ResourceConflict[]
): ResourceStatus {
  if (!resource.is_active) return "inactive";

  // Check for conflicts on this resource
  const hasConflict = conflicts.some(
    (c) =>
      (c.type === "overlap" || c.type === "capacity_overflow") &&
      c.resourceId === resource.id
  );
  if (hasConflict) return "conflict";

  // Check if resource is currently in use
  const activeBookings = bookings.filter(
    (b) =>
      b.resource_id === resource.id &&
      (b.status === "confirmed" ||
        b.status === "checked_in" ||
        b.status === "in_progress")
  );
  if (activeBookings.length > 0) return "in_use";

  return "available";
}

export function getResourceStatusLabel(status: ResourceStatus): string {
  switch (status) {
    case "available":
      return "Available";
    case "in_use":
      return "In Use";
    case "blocked":
      return "Blocked";
    case "inactive":
      return "Inactive";
    case "needs_setup":
      return "Needs Setup";
    case "conflict":
      return "Conflict";
    default:
      return "Unknown";
  }
}

export function getResourceStatusColor(status: ResourceStatus): string {
  switch (status) {
    case "available":
      return "#4A7C59"; // Forest green
    case "in_use":
      return "#B08850"; // Warm gold
    case "blocked":
      return "#8A8078"; // Neutral gray
    case "inactive":
      return "var(--cs-text-muted)";
    case "needs_setup":
      return "#D97706"; // Soft orange
    case "conflict":
      return "#DC2626"; // Red
    default:
      return "var(--cs-text-muted)";
  }
}
