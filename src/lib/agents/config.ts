import { canonicalizeSystemRole } from "@/constants/staff-roles";
import type { AgentWorkspace } from "@/lib/agents/types";

export type AgentCoachEnvironment = {
  ANTHROPIC_API_KEY?: string;
  AGENT_COACH_WORKSPACES?: string;
};

export type AgentCoachAvailability = {
  available: boolean;
  reason: "available" | "provider_unconfigured" | "workspace_disabled" | "role_not_allowed";
};

const CRM_COACH_ROLES = new Set([
  "owner",
  "manager",
  "assistant_manager",
  "store_manager",
  "crm",
]);

function hasValidProviderConfiguration(env: AgentCoachEnvironment): boolean {
  const key = env.ANTHROPIC_API_KEY?.trim();
  return Boolean(key && key.startsWith("sk-ant-api") && key.length >= 24);
}

export function isAgentCoachEnabled(
  env: AgentCoachEnvironment = process.env as AgentCoachEnvironment
): boolean {
  return hasValidProviderConfiguration(env);
}

export function getEnabledWorkspaces(
  env: AgentCoachEnvironment = process.env as AgentCoachEnvironment
): AgentWorkspace[] {
  const raw = env.AGENT_COACH_WORKSPACES ?? "";
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter((value): value is AgentWorkspace =>
      ["crm", "owner", "manager", "staff-portal"].includes(value)
    );
}

export function isWorkspaceEnabled(
  workspace: AgentWorkspace,
  env: AgentCoachEnvironment = process.env as AgentCoachEnvironment
): boolean {
  return getEnabledWorkspaces(env).includes(workspace);
}

export function getAgentCoachAvailability(params: {
  workspace: AgentWorkspace;
  role: string | null | undefined;
  env?: AgentCoachEnvironment;
}): AgentCoachAvailability {
  const env = params.env ?? process.env as AgentCoachEnvironment;
  if (!hasValidProviderConfiguration(env)) {
    return { available: false, reason: "provider_unconfigured" };
  }
  if (!isWorkspaceEnabled(params.workspace, env)) {
    return { available: false, reason: "workspace_disabled" };
  }

  const role = canonicalizeSystemRole(params.role ?? "");
  const roleAllowed = params.workspace === "owner"
    ? role === "owner"
    : params.workspace === "crm" && CRM_COACH_ROLES.has(role);
  if (!roleAllowed) {
    return { available: false, reason: "role_not_allowed" };
  }

  return { available: true, reason: "available" };
}
