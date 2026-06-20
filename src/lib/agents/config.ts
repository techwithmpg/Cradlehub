import type { AgentWorkspace } from "@/lib/agents/types";

export function isAgentCoachEnabled(): boolean {
  const key = process.env.ANTHROPIC_API_KEY;
  return Boolean(key && key.startsWith("sk-ant-api"));
}

export function getEnabledWorkspaces(): AgentWorkspace[] {
  const raw = process.env.AGENT_COACH_WORKSPACES ?? "crm";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is AgentWorkspace =>
      ["crm", "owner", "manager", "staff-portal"].includes(s)
    );
}

export function isWorkspaceEnabled(workspace: AgentWorkspace): boolean {
  return getEnabledWorkspaces().includes(workspace);
}
