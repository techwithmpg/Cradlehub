import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isDevAuthBypassEnabled } from "@/lib/dev-bypass";
import { resolveSuperAdminContext, resolveDevBypassBranchId } from "@/lib/auth/super-admin";

/**
 * Shared manager branch resolver.
 * Returns the assigned branch_id for the current authenticated manager.
 * Redirects to /login if unauthenticated or not assigned to a branch.
 */
export async function getManagerBranchId(): Promise<string> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Super-admin: resolve real branch without requiring a staff record.
  const superAdmin = await resolveSuperAdminContext(user.id);
  if (superAdmin) return superAdmin.branch_id;

  const { data: me } = await supabase
    .from("staff")
    .select("branch_id")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!me && isDevAuthBypassEnabled()) {
    // Dev bypass: resolve first real branch instead of using a fake UUID.
    const branchId = await resolveDevBypassBranchId();
    if (!branchId) redirect("/login");
    return branchId;
  }

  if (!me?.branch_id) redirect("/login");
  return me.branch_id as string;
}

/**
 * Returns both branchId and branchName for the current manager.
 */
export async function getManagerContext(): Promise<{
  branchId: string;
  branchName: string;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Super-admin: resolve real branch and name without requiring a staff record.
  const superAdmin = await resolveSuperAdminContext(user.id);
  if (superAdmin) {
    return {
      branchId: superAdmin.branch_id,
      branchName: superAdmin.branches?.name ?? "Your Branch",
    };
  }

  const { data: me } = await supabase
    .from("staff")
    .select("branch_id, branches(name)")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!me && isDevAuthBypassEnabled()) {
    // Dev bypass: resolve first real branch.
    const branchId = await resolveDevBypassBranchId();
    if (!branchId) redirect("/login");
    return { branchId, branchName: "Dev Branch" };
  }

  if (!me?.branch_id) redirect("/login");

  const branchName =
    (me.branches as { name: string } | { name: string }[] | null)
      ? Array.isArray(me.branches)
        ? me.branches[0]?.name ?? "Your Branch"
        : me.branches?.name ?? "Your Branch"
      : "Your Branch";

  return {
    branchId: me.branch_id as string,
    branchName,
  };
}
