import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/logger";
import { resolveSuperAdminContext } from "@/lib/auth/super-admin";

export type LayoutStaffContext = {
  user: { id: string };
  me: {
    full_name: string;
    nickname: string | null;
    system_role: string;
    branch_id: string;
    avatar_url: string | null;
    branches: { name: string } | { name: string }[] | null;
  } | null;
};

/**
 * React cache()-wrapped staff context for the dashboard layout.
 * Deduplicates the auth + staff DB call within a single request render tree.
 * Do NOT use this for page-level authorization — pages must do their own role checks.
 */
export const getLayoutStaffContext = cache(async (): Promise<LayoutStaffContext | null> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Super-admin: grant owner-level layout access with a real branch.
  const superAdmin = await resolveSuperAdminContext(user.id);
  if (superAdmin) {
    return {
      user: { id: user.id },
      me: {
        full_name: superAdmin.full_name,
        nickname: null,
        system_role: "owner",
        branch_id: superAdmin.branch_id,
        avatar_url: null,
        branches: superAdmin.branches,
      },
    };
  }

  const { data: me, error } = await supabase
    .from("staff")
    .select("full_name, nickname, system_role, branch_id, avatar_url, branches(name)")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    logError("staff_context.lookup_failed", { error });
  }

  return { user: { id: user.id }, me: me ?? null };
});
