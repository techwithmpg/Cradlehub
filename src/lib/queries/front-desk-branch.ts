import "server-only";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export const OWNER_FRONT_DESK_BRANCH_COOKIE = "owner_front_desk_branch";

export type FrontDeskBranch = { id: string; name: string };

export async function getOwnerFrontDeskBranches(): Promise<FrontDeskBranch[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("branches")
    .select("id, name")
    .eq("is_active", true)
    .order("name");
  if (error) throw new Error("Front Desk branches could not be loaded.");
  return data ?? [];
}

export async function resolveOwnerFrontDeskBranch(
  userId: string,
  assignedBranchId: string | null
): Promise<FrontDeskBranch | null> {
  const branches = await getOwnerFrontDeskBranches();
  const saved = (await cookies()).get(OWNER_FRONT_DESK_BRANCH_COOKIE)?.value;
  const selectedId = saved?.startsWith(`${userId}:`) ? saved.slice(userId.length + 1) : null;
  return branches.find((branch) => branch.id === selectedId)
    ?? branches.find((branch) => branch.id === assignedBranchId)
    ?? branches[0]
    ?? null;
}
