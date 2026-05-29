import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { isDevAuthBypassEnabled } from "@/lib/dev-bypass";
import { resolveSuperAdminContext } from "@/lib/auth/super-admin";

const CRM_ROLES = ["owner", "manager", "assistant_manager", "store_manager", "crm", "csr", "csr_head", "csr_staff"];

export const getCrmContext = cache(async function getCrmContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Super-admin: grant owner-level CRM access.
  const superAdmin = await resolveSuperAdminContext(user.id);
  if (superAdmin) {
    return { role: "owner" as string, branchId: null as string | null };
  }

  if (isDevAuthBypassEnabled()) {
    return { role: "owner" as string, branchId: null as string | null };
  }

  const { data: me } = await supabase
    .from("staff")
    .select("branch_id, system_role")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!me || !CRM_ROLES.includes(me.system_role)) redirect("/login");

  return {
    role: me.system_role,
    branchId: me.system_role === "owner" ? null : me.branch_id,
  };
});
