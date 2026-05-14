import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type LayoutStaffContext = {
  user: { id: string };
  me: {
    full_name: string;
    system_role: string;
    branch_id: string;
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

  const { data: me, error } = await supabase
    .from("staff")
    .select("full_name, system_role, branch_id, branches(name)")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    console.error("[staff-context] staff lookup error", {
      message: error.message,
      code: error.code,
    });
  }

  return { user: { id: user.id }, me: me ?? null };
});
