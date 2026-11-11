import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/logger";
import { resolveSuperAdminContext } from "@/lib/auth/super-admin";

export type SharedStaffProfileRow = {
  id: string;
  full_name: string;
  nickname: string | null;
  system_role: string;
  staff_type: string | null;
  branch_id: string;
  avatar_url: string | null;
  branches: { name: string } | { name: string }[] | null;
};

export type LayoutStaffContext = {
  user: { id: string };
  me: SharedStaffProfileRow | null;
};

/**
 * Canonical request-scoped auth + staff profile resolver wrapped in React cache().
 * Shared across DashboardLayout, CrmLayout, OwnerLayout, getUserWorkspaceAccess,
 * getCrmContext, and getFrontDeskContext so auth.getUser() and the staff table
 * are only queried ONCE per HTTP request render pass.
 */
export const getLayoutStaffContext = cache(async (): Promise<LayoutStaffContext | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Super-admin: grant owner-level layout access with a real branch.
  const superAdmin = await resolveSuperAdminContext(user.id);
  if (superAdmin) {
    return {
      user: { id: user.id },
      me: {
        id: user.id,
        full_name: superAdmin.full_name,
        nickname: null,
        system_role: "owner",
        staff_type: "managerial",
        branch_id: superAdmin.branch_id,
        avatar_url: null,
        branches: superAdmin.branches,
      },
    };
  }

  const { data: me, error } = await supabase
    .from("staff")
    .select("id, full_name, nickname, system_role, staff_type, branch_id, avatar_url, branches(name)")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    logError("staff_context.lookup_failed", { error });
  }

  return { user: { id: user.id }, me: (me as SharedStaffProfileRow | null) ?? null };
});
