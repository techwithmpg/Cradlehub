/**
 * API route auth helper.
 *
 * Unlike getManagerContext() (which calls redirect()), this returns null when
 * the user is unauthenticated so API routes can return a proper 401 response.
 */

import { createClient } from "@/lib/supabase/server";
import { isDevAuthBypassEnabled, getDevBypassLayoutStaff } from "@/lib/dev-bypass";
import { resolveSuperAdminContext } from "@/lib/auth/super-admin";
import { canonicalizeSystemRole } from "@/constants/staff";
import {
  getCrmApiAccessForRole,
  type CrmApiAccessDenied,
} from "@/lib/auth/crm-api-access";

export type ApiUserContext = {
  userId: string;
  branchId: string;
  branchName: string;
  role: string;
};

export type ApiAccessDenied = CrmApiAccessDenied;

export type CrmApiContextResult =
  | { ok: true; context: ApiUserContext }
  | ApiAccessDenied;

export { getCrmApiAccessForRole };

export async function getApiContext(): Promise<ApiUserContext | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) return null;

    // Super-admin shortcut
    const superAdmin = await resolveSuperAdminContext(user.id);
    if (superAdmin) {
      return {
        userId: user.id,
        branchId: superAdmin.branch_id,
        branchName: superAdmin.branches?.name ?? "Your Branch",
        role: "owner",
      };
    }

    const { data: me } = await supabase
      .from("staff")
      .select("branch_id, branches(name), system_role")
      .eq("auth_user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    // Dev bypass
    if (!me && isDevAuthBypassEnabled()) {
      const mock = getDevBypassLayoutStaff();
      return {
        userId: user.id,
        branchId: mock.branch_id,
        branchName: (mock.branches as { name: string }).name,
        role: canonicalizeSystemRole(mock.system_role),
      };
    }

    if (!me?.branch_id) return null;

    return {
      userId: user.id,
      branchId: me.branch_id as string,
      branchName:
        (me.branches as { name: string } | null)?.name ?? "Your Branch",
      role: canonicalizeSystemRole(me.system_role),
    };
  } catch {
    return null;
  }
}

export async function getCrmApiContext(): Promise<CrmApiContextResult> {
  const context = await getApiContext();
  if (!context) return { ok: false, status: 401, error: "Unauthorized" };

  const denied = getCrmApiAccessForRole(context.role);
  if (denied) return denied.status === 401 ? denied : { ...denied, status: 403 };

  return {
    ok: true,
    context: {
      ...context,
      role: canonicalizeSystemRole(context.role),
    },
  };
}
