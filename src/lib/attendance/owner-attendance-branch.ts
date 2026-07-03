import "server-only";

import { redirect } from "next/navigation";
import { getCurrentUserWorkspaceAccess } from "@/lib/auth/get-user-workspace-access";
import {
  getWorkspaceSwitchDestination,
  hasWorkspaceAccess,
} from "@/lib/auth/workspace-access";
import { createClient } from "@/lib/supabase/server";

export type OwnerAttendanceBranch = {
  id: string;
  name: string | null;
};

export type OwnerAttendanceBranchResult = {
  branch: OwnerAttendanceBranch | null;
  warning: string | null;
};

async function requireOwnerAccess() {
  const access = await getCurrentUserWorkspaceAccess();
  if (!access) redirect("/login");
  if (!hasWorkspaceAccess(access.workspaces, "owner")) {
    redirect(getWorkspaceSwitchDestination(access.workspaces));
  }
}

async function loadFirstActiveBranch(): Promise<OwnerAttendanceBranch | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("branches")
    .select("id, name")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function loadOwnerAttendanceBranch(
  requestedBranchId: string | null
): Promise<OwnerAttendanceBranchResult> {
  await requireOwnerAccess();
  if (!requestedBranchId) {
    return { branch: await loadFirstActiveBranch(), warning: null };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("branches")
    .select("id, name")
    .eq("is_active", true)
    .eq("id", requestedBranchId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data) return { branch: data, warning: null };

  return {
    branch: await loadFirstActiveBranch(),
    warning: "The selected branch is not available from this workspace.",
  };
}
