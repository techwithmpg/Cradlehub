import { invalidateCrmWorkspace, invalidateManagerWorkspace } from "@/lib/cache/cache-tags";

export function revalidateCrmBookingSurfaces(branchId?: string | null): void {
  if (branchId) {
    invalidateCrmWorkspace(branchId);
  }
}

export function revalidateOperationalBookingSurfaces(branchId?: string | null): void {
  if (branchId) {
    invalidateCrmWorkspace(branchId);
    invalidateManagerWorkspace(branchId);
  }
}
