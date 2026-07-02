import { canonicalizeSystemRole } from "@/constants/staff";
import { canAccessCrmWorkspace } from "@/lib/auth/crm-permissions";

export type CrmApiAccessDenied = {
  ok: false;
  status: 401 | 403;
  error: "Unauthorized" | "Forbidden";
};

export function getCrmApiAccessForRole(
  role: string | null | undefined
): CrmApiAccessDenied | null {
  if (!role) return { ok: false, status: 401, error: "Unauthorized" };
  return canAccessCrmWorkspace(canonicalizeSystemRole(role))
    ? null
    : { ok: false, status: 403, error: "Forbidden" };
}
