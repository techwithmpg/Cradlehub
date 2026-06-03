import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { isDevAuthBypassEnabled, getDevBypassLayoutStaff } from "@/lib/dev-bypass";
import { logError } from "@/lib/logger";
import { resolveSuperAdminContext } from "./super-admin";
import {
  buildWorkspaceAccessFromStaffProfile,
  type WorkspaceAccess,
  type WorkspaceStaffProfile,
} from "./workspace-access";

type CurrentWorkspaceAccess =
  | {
      user: { id: string };
      workspaces: WorkspaceAccess[];
    }
  | null;

type StaffAccessRow = WorkspaceStaffProfile;

export async function getUserWorkspaceAccess(userId: string): Promise<WorkspaceAccess[]> {
  const superAdmin = await resolveSuperAdminContext(userId);
  if (superAdmin) {
    return buildWorkspaceAccessFromStaffProfile({
      id: userId,
      full_name: superAdmin.full_name,
      system_role: "owner",
      staff_type: "managerial",
      branch_id: superAdmin.branch_id,
      branches: superAdmin.branches,
    });
  }

  const supabase = await createClient();
  const { data: staffRecord, error } = await supabase
    .from("staff")
    .select("id, full_name, system_role, staff_type, branch_id, branches(name)")
    .eq("auth_user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    logError("workspace_access.staff_lookup_failed", { userId, error });
    throw new Error("Workspace access lookup failed.");
  }

  if (!staffRecord && isDevAuthBypassEnabled()) {
    const mock = getDevBypassLayoutStaff();
    return buildWorkspaceAccessFromStaffProfile({
      id: userId,
      full_name: mock.full_name,
      system_role: mock.system_role,
      staff_type: "managerial",
      branch_id: mock.branch_id,
      branches: mock.branches,
    });
  }

  return buildWorkspaceAccessFromStaffProfile((staffRecord as StaffAccessRow | null) ?? null);
}

export const getCurrentUserWorkspaceAccess = cache(async (): Promise<CurrentWorkspaceAccess> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  return {
    user: { id: user.id },
    workspaces: await getUserWorkspaceAccess(user.id),
  };
});
