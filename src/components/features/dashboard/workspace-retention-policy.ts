export type RetainedWorkspace = "crm" | "owner";

export type WorkspaceRetentionCost = "low" | "medium" | "high";

export type RetainedModuleId =
  | "crm-work-queue"
  | "crm-bookings"
  | "crm-schedule"
  | "crm-attendance"
  | "crm-customers"
  | "owner-overview"
  | "owner-reports"
  | "owner-bookings";

export type WorkspaceModuleDescriptor = {
  workspace: RetainedWorkspace;
  moduleId: RetainedModuleId;
  normalizedRoute: string;
  stableSearchState: string;
  staleTimeMs: number;
  cost: WorkspaceRetentionCost;
};

type ModulePolicy = Omit<WorkspaceModuleDescriptor, "workspace" | "stableSearchState"> & {
  workspace: RetainedWorkspace;
  exact?: boolean;
  stableSearchParams: readonly string[];
};

export const WORKSPACE_RETENTION_LIMITS: Record<RetainedWorkspace, number> = {
  crm: 4,
  owner: 3,
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
    workspace: "owner",
    moduleId: "owner-overview",
    normalizedRoute: "/owner",
    exact: true,
    stableSearchParams: ["branch", "date"],
    staleTimeMs: 45_000,
    cost: "medium",
  },
  {
    workspace: "owner",
    moduleId: "owner-reports",
    normalizedRoute: "/owner/reports",
    exact: true,
    stableSearchParams: ["preset", "from", "to"],
    staleTimeMs: 180_000,
    cost: "high",
  },
  {
    workspace: "owner",
    moduleId: "owner-bookings",
    normalizedRoute: "/owner/bookings",
    exact: true,
    stableSearchParams: ["date", "branch", "status", "type", "search", "bookingId"],
    staleTimeMs: 25_000,
    cost: "medium",
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
    staleTimeMs: policy.staleTimeMs,
    cost: policy.cost,
  };
}

export function retainedModuleKey(scopeKey: string, descriptor: WorkspaceModuleDescriptor): string {
  // Search state is restoration metadata, not a second mounted copy. Keeping
  // one instance per module prevents high-frequency filters from consuming LRU slots.
  return `${scopeKey}:${descriptor.workspace}:${descriptor.moduleId}`;
}

export function affectedModulesForBookingChange(workspace: RetainedWorkspace): RetainedModuleId[] {
  return workspace === "crm"
    ? ["crm-work-queue", "crm-bookings", "crm-schedule"]
    : ["owner-overview", "owner-reports", "owner-bookings"];
}
