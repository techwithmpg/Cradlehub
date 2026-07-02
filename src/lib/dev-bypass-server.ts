import "server-only";

import { getDevBypassLayoutStaff } from "@/lib/dev-bypass";
import { createAdminClient } from "@/lib/supabase/admin";

const ZERO_UUID = "00000000-0000-0000-0000-000000000000";

type BranchRow = {
  id: string;
  name: string | null;
};

export type DevBypassBranchContext = {
  branchId: string;
  branchName: string;
  role: string;
};

async function findBranchById(branchId: string): Promise<BranchRow | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("branches")
    .select("id, name")
    .eq("id", branchId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as BranchRow | null) ?? null;
}

async function findFirstActiveBranch(): Promise<BranchRow | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("branches")
    .select("id, name")
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as BranchRow | null) ?? null;
}

export async function getDevBypassBranchContext(): Promise<DevBypassBranchContext | null> {
  const mock = getDevBypassLayoutStaff();
  const configuredBranchId = process.env.DEV_BYPASS_BRANCH_ID?.trim();
  const branchId =
    configuredBranchId || (mock.branch_id && mock.branch_id !== ZERO_UUID ? mock.branch_id : null);

  const branch = (branchId ? await findBranchById(branchId) : null) ?? (await findFirstActiveBranch());
  if (!branch) return null;

  return {
    branchId: branch.id,
    branchName: branch.name ?? mock.branches.name,
    role: mock.system_role,
  };
}
