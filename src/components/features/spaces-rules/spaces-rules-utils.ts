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
    // For each booking, count how many others overlap with it
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
          // Only add one capacity conflict per resource
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
    activeRules: rules.id ? 1 : 0, // 1 if persisted, 0 if default
    conflicts: conflicts.filter((c) => c.severity === "critical").length,
    missingAssignments,
  };
}
