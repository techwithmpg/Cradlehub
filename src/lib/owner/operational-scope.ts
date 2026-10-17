/** These identities are runtime partitions, never authorization grants. */
export type OwnerOperationalScope =
  | { kind: "branch"; branchId: string }
  | { kind: "all-branches" }
  | { kind: "global" }
  | { kind: "unavailable" };

export type OwnerScopeBranch = { id: string; name: string | null; is_active?: boolean; sort_order?: number | null };
type Search = Pick<URLSearchParams, "getAll">;

export function ownerScopeSearch(params: Record<string, string | string[] | undefined>): URLSearchParams {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    for (const part of Array.isArray(value) ? value : value === undefined ? [] : [value]) search.append(key, part);
  }
  return search;
}

/** authorizedBranches must come from the authenticated server's active, RLS-visible list,
 * ordered by name (the established Schedule/Cash Flow default). */
export function resolveOwnerOperationalScope({ pathname, searchParams, authorizedBranches, dispatchBranchId }: {
  pathname: string;
  searchParams: Search;
  authorizedBranches: readonly OwnerScopeBranch[];
  dispatchBranchId?: string | null;
}): OwnerOperationalScope {
  const branches = authorizedBranches.filter((branch) => branch.is_active !== false);
  const branchScope = (id: string | undefined | null): OwnerOperationalScope =>
    id && branches.some((branch) => branch.id === id) ? { kind: "branch", branchId: id } : { kind: "unavailable" };
  if (pathname === "/owner" || pathname === "/owner/notifications") return { kind: "all-branches" };
  if (pathname === "/owner/dispatch") return branchScope(dispatchBranchId);
  const optional = pathname === "/owner/bookings" || pathname === "/owner/reports";
  const concrete = ["/owner/schedule", "/owner/attendance", "/owner/cash-flow", "/owner/spaces-rules"].includes(pathname);
  if (!optional && !concrete) return { kind: "global" };
  const values = searchParams.getAll(pathname === "/owner/bookings" ? "branch" : "branchId");
  const requested = values.length > 1 ? "invalid-multiple-values" : values[0];
  if (optional) {
    if (!requested || (pathname === "/owner/reports" && requested === "all")) return { kind: "all-branches" };
    return branchScope(requested);
  }
  if (branches.some((branch) => branch.id === requested)) return branchScope(requested);
  // Attendance's existing fallback is sort_order, then name, with null sort orders last.
  const fallback = pathname === "/owner/attendance"
    ? [...branches].sort((a, b) => (a.sort_order ?? Infinity) - (b.sort_order ?? Infinity))[0]
    : branches[0];
  return branchScope(fallback?.id);
}

export function ownerOperationalScopeKey(scope: OwnerOperationalScope): string {
  return scope.kind === "branch" ? `owner:branch:${scope.branchId}` : `owner:${scope.kind}`;
}

export type OwnerEventScope = { scope: OwnerOperationalScope; authorizedBranchIds: readonly string[] };
export function ownerScopeAcceptsBranchEvent({ scope, authorizedBranchIds }: OwnerEventScope, branchId: string): boolean {
  if (!authorizedBranchIds.includes(branchId) || scope.kind === "unavailable") return false;
  // Aggregates include branch data; global catalog offerings also depend on branch rules.
  // The semantic dependency map still selects only relevant modules in either partition.
  return scope.kind !== "branch" || scope.branchId === branchId;
}
