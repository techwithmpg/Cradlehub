import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { resolveStaffPwaOperationalGroup } from "@/lib/auth/workspace-access";

// Request-scoped only: never share an authenticated staff identity across requests.
export const getStaffPwaContext = cache(async () => {
  const db = await createClient();
  const { data: { user }, error: authError } = await db.auth.getUser();
  if (authError || !user) throw new Error("Unauthorized");
  const { data: staff, error } = await db.from("staff")
    .select("id, branch_id, system_role, staff_type, is_active")
    .eq("auth_user_id", user.id).eq("is_active", true).maybeSingle();
  if (error) throw new Error("Staff identity unavailable.");
  if (!staff || !staff.is_active) throw new Error("Unauthorized");
  const group = resolveStaffPwaOperationalGroup(staff.system_role, staff.staff_type);
  if (!group || !staff.branch_id) throw new Error("Staff workspace unavailable.");
  return { db, staff, group };
});
