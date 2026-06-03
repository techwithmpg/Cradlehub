import { revalidatePath } from "next/cache";
import { invalidateCrmWorkspace, invalidateManagerWorkspace } from "@/lib/cache/cache-tags";

const CRM_BOOKING_SURFACE_PATHS = [
  "/crm",
  "/crm/today",
  "/crm/bookings",
  "/crm/bookings/new",
  "/crm/control",
] as const;

const MANAGER_BOOKING_SURFACE_PATHS = [
  "/manager",
  "/manager/bookings",
] as const;

export function revalidateCrmBookingSurfaces(branchId?: string | null): void {
  for (const path of CRM_BOOKING_SURFACE_PATHS) {
    revalidatePath(path);
  }

  if (branchId) {
    invalidateCrmWorkspace(branchId);
  }
}

export function revalidateOperationalBookingSurfaces(branchId?: string | null): void {
  revalidateCrmBookingSurfaces(branchId);

  for (const path of MANAGER_BOOKING_SURFACE_PATHS) {
    revalidatePath(path);
  }

  if (branchId) {
    invalidateManagerWorkspace(branchId);
  }
}
