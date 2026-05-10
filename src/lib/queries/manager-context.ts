import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isDevAuthBypassEnabled, getDevBypassLayoutStaff } from "@/lib/dev-bypass";

/**
 * Shared manager branch resolver.
 * Returns the assigned branch_id for the current authenticated manager.
 * Redirects to /login if unauthenticated or not assigned to a branch.
 */
export async function getManagerBranchId(): Promise<string> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("staff")
    .select("branch_id")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!me && isDevAuthBypassEnabled()) {
    const mock = getDevBypassLayoutStaff();
    return mock.branch_id;
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

  const { data: me } = await supabase
    .from("staff")
    .select("branch_id, branches(name)")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!me && isDevAuthBypassEnabled()) {
    const mock = getDevBypassLayoutStaff();
    return {
      branchId: mock.branch_id,
      branchName: mock.branches.name,
    };
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
