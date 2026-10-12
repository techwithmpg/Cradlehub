export type RetainedWorkspace = "crm" | "owner";

export type WorkspaceRetentionCost = "low" | "medium" | "high";

export type RetainedModuleId =
  | "crm-work-queue"
  | "crm-bookings"
  | "crm-schedule"
  | "crm-attendance"
  | "crm-customers"
  | "crm-cash-flow"
  | "crm-dispatch"
  | "owner-overview"
  | "owner-reports"
  | "owner-bookings"
  | "owner-schedule"
  | "owner-attendance"
  | "owner-cash-flow";

export type WorkspaceModuleDescriptor = {
  workspace: RetainedWorkspace;
  moduleId: RetainedModuleId;
  normalizedRoute: string;
  stableSearchState: string;
  /**
   * Search state that changes the authoritative operational scope of a module.
   * Unlike ordinary filters, scope state is part of the retained instance key
   * so Owner branch changes can never reveal another branch's retained UI.
   */
  retentionScopeState: string;
  staleTimeMs: number;
  cost: WorkspaceRetentionCost;
};

type ModulePolicy = Omit<
  WorkspaceModuleDescriptor,
  "workspace" | "stableSearchState" | "retentionScopeState"
> & {
  workspace: RetainedWorkspace;
  exact?: boolean;
  stableSearchParams: readonly string[];
  scopeSearchParams?: readonly string[];
};

export const WORKSPACE_RETENTION_LIMITS: Record<RetainedWorkspace, number> = {
  crm: 6,
  owner: 5,
};

const MODULE_POLICIES: readonly ModulePolicy[] = [
  {
    workspace: "crm",
    moduleId: "crm-work-queue",
    normalizedRoute: "/crm/today",
    exact: true,
    stableSearchParams: ["filter"],
    staleTimeMs: 12_000,
    cost: "medium",
  },
  {
    workspace: "crm",
    moduleId: "crm-bookings",
    normalizedRoute: "/crm/bookings",
    exact: true,
    stableSearchParams: [
      "date",
      "status",
      "type",
      "delivery",
      "payment",
      "assignment",
      "search",
      "bookingId",
      "highlight",
      "tab",
    ],
    staleTimeMs: 25_000,
    cost: "medium",
  },
  {
    workspace: "crm",
    moduleId: "crm-schedule",
    normalizedRoute: "/crm/schedule",
    exact: true,
    stableSearchParams: ["date", "tab"],
    staleTimeMs: 45_000,
    cost: "high",
  },
  {
    workspace: "crm",
    moduleId: "crm-attendance",
    normalizedRoute: "/crm/attendance",
    exact: true,
    stableSearchParams: ["tab", "date", "staff", "status", "page"],
    staleTimeMs: 12_000,
    cost: "medium",
  },
  {
    workspace: "crm",
    moduleId: "crm-customers",
    normalizedRoute: "/crm/customers",
    exact: true,
    stableSearchParams: ["tab", "page", "q"],
    staleTimeMs: 120_000,
    cost: "medium",
  },
  {
    workspace: "crm",
    moduleId: "crm-cash-flow",
    normalizedRoute: "/crm/cash-flow",
    exact: true,
    stableSearchParams: [
      "date",
      "tab",
      "search",
      "category",
      "method",
      "status",
      "page",
      "entry",
      "handover",
    ],
    staleTimeMs: 15_000,
    cost: "medium",
  },
  {
    workspace: "crm",
    moduleId: "crm-dispatch",
    normalizedRoute: "/crm/dispatch",
    exact: true,
    stableSearchParams: [],
    staleTimeMs: 10_000,
    cost: "high",
  },
  {
    workspace: "owner",
    moduleId: "owner-overview",
    normalizedRoute: "/owner",
    exact: true,
    stableSearchParams: ["branch", "date"],
    scopeSearchParams: ["branch"],
    staleTimeMs: 45_000,
    cost: "medium",
  },
  {
    workspace: "owner",
    moduleId: "owner-reports",
    normalizedRoute: "/owner/reports",
    exact: true,
    stableSearchParams: ["preset", "from", "to", "branchId", "view"],
    scopeSearchParams: ["branchId"],
    staleTimeMs: 180_000,
    cost: "high",
  },
  {
    workspace: "owner",
    moduleId: "owner-bookings",
    normalizedRoute: "/owner/bookings",
    exact: true,
    stableSearchParams: ["date", "branch", "status", "type", "search", "bookingId"],
    scopeSearchParams: ["branch"],
    staleTimeMs: 25_000,
    cost: "medium",
  },
  {
    workspace: "owner",
    moduleId: "owner-schedule",
    normalizedRoute: "/owner/schedule",
    exact: true,
    stableSearchParams: ["branchId", "date", "tab"],
    scopeSearchParams: ["branchId"],
    staleTimeMs: 30_000,
    cost: "high",
  },
  {
    workspace: "owner",
    moduleId: "owner-attendance",
    normalizedRoute: "/owner/attendance",
    exact: true,
    stableSearchParams: ["branchId", "tab", "date", "staff", "status", "page"],
    scopeSearchParams: ["branchId"],
    staleTimeMs: 12_000,
    cost: "high",
  },
  {
    workspace: "owner",
    moduleId: "owner-cash-flow",
    normalizedRoute: "/owner/cash-flow",
    exact: true,
    stableSearchParams: [
      "branchId",
      "date",
      "tab",
      "search",
      "category",
      "method",
      "status",
      "page",
      "entry",
    ],
    scopeSearchParams: ["branchId"],
    staleTimeMs: 15_000,
    cost: "high",
  },
] as const;

function stableSearchState(
  search: URLSearchParams,
  allowedParams: readonly string[]
): string {
  const stable = new URLSearchParams();
  for (const key of [...allowedParams].sort()) {
    for (const value of search.getAll(key)) stable.append(key, value);
  }
  stable.sort();
  return stable.toString();
}

export function resolveWorkspaceModule(
  workspace: RetainedWorkspace,
  pathname: string,
  search: URLSearchParams | string = ""
): WorkspaceModuleDescriptor | null {
  const policy = MODULE_POLICIES.find((candidate) => {
    if (candidate.workspace !== workspace) return false;
    return candidate.exact
      ? pathname === candidate.normalizedRoute
      : pathname === candidate.normalizedRoute || pathname.startsWith(`${candidate.normalizedRoute}/`);
  });
  if (!policy) return null;

  const params = typeof search === "string" ? new URLSearchParams(search) : search;
  return {
    workspace: policy.workspace,
    moduleId: policy.moduleId,
    normalizedRoute: policy.normalizedRoute,
    stableSearchState: stableSearchState(params, policy.stableSearchParams),
    retentionScopeState: stableSearchState(params, policy.scopeSearchParams ?? []),
    staleTimeMs: policy.staleTimeMs,
    cost: policy.cost,
  };
}

export function retainedModuleKey(scopeKey: string, descriptor: WorkspaceModuleDescriptor): string {
  const base = `${scopeKey}:${descriptor.workspace}:${descriptor.moduleId}`;
  // Ordinary filters are restoration metadata, not a second mounted copy.
  // Operational scope (currently Owner branch selection) must be isolated.
  return descriptor.retentionScopeState
    ? `${base}:${descriptor.retentionScopeState}`
    : base;
}

export function affectedModulesForBookingChange(workspace: RetainedWorkspace): RetainedModuleId[] {
  return workspace === "crm"
    ? ["crm-work-queue", "crm-bookings", "crm-schedule", "crm-cash-flow", "crm-dispatch"]
    : ["owner-overview", "owner-reports", "owner-bookings", "owner-schedule", "owner-cash-flow"];
}
