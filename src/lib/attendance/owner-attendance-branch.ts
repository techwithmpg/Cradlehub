import "server-only";

import { getOwnerScopeBranches } from "@/lib/owner/operational-scope-server";
import { ownerScopeSearch, resolveOwnerOperationalScope } from "@/lib/owner/operational-scope";

export type OwnerAttendanceBranch = {
  id: string;
  name: string | null;
};

export type OwnerAttendanceBranchResult = {
  branch: OwnerAttendanceBranch | null;
  warning: string | null;
};

export async function loadOwnerAttendanceBranch(
  requestedBranchId: string | string[] | null
): Promise<OwnerAttendanceBranchResult> {
  const branches = await getOwnerScopeBranches();
  const scope = resolveOwnerOperationalScope({ pathname: "/owner/attendance",
    searchParams: ownerScopeSearch({ branchId: requestedBranchId ?? undefined }), authorizedBranches: branches });
  return {
    branch: scope.kind === "branch" ? branches.find((branch) => branch.id === scope.branchId) ?? null : null,
    warning: requestedBranchId && !branches.some((branch) => branch.id === requestedBranchId)
      ? "The selected branch is not available from this workspace." : null,
  };
}
