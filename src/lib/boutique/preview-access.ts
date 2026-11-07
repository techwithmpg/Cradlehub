import { canonicalizeSystemRole } from "@/constants/staff-roles";

export type BoutiquePreviewWorkspace = "owner" | "crm";

/**
 * Route-level B1 preview policy. It authorizes only a visible, non-mutating demo.
 * Later catalogue, inventory and financial actions need separate server/RLS authority.
 */
export function canViewBoutiquePreviewWorkspace(
  role: string | null | undefined,
  workspace: BoutiquePreviewWorkspace,
  branchId: string | null | undefined,
): boolean {
  if (!role) return false;
  const canonical = canonicalizeSystemRole(role);
  if (workspace === "owner") return canonical === "owner";
  return canonical === "crm" && typeof branchId === "string" && branchId.trim().length > 0;
}

export function isBoutiqueB1PreviewEnabled(): boolean {
  return process.env.NEXT_PUBLIC_CRADLEHUB_BOUTIQUE_B1_PREVIEW === "true";
}
