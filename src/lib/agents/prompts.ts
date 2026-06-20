import type { AgentSessionContext, AgentSuggestedAction } from "@/lib/agents/types";
import {
  buildCrmSystemPrompt,
  getCrmSuggestedAction,
  getCrmProactiveGreeting,
} from "@/lib/agents/crm/prompts";
import {
  buildOwnerSystemPrompt,
  getOwnerSuggestedAction,
  getOwnerProactiveGreeting,
} from "@/lib/agents/owner/prompts";

export const SUPPORTED_COACH_WORKSPACES = ["crm", "owner"] as const;

export type SupportedCoachWorkspace = (typeof SUPPORTED_COACH_WORKSPACES)[number];

export function isSupportedCoachWorkspace(workspace: string): workspace is SupportedCoachWorkspace {
  return (SUPPORTED_COACH_WORKSPACES as readonly string[]).includes(workspace);
}

export function buildSystemPrompt(context: AgentSessionContext): string {
  switch (context.workspace) {
    case "owner":
      return buildOwnerSystemPrompt(context);
    case "crm":
    default:
      return buildCrmSystemPrompt(context);
  }
}

export function getSuggestedAction(
  workspace: SupportedCoachWorkspace,
  key: string
): AgentSuggestedAction | undefined {
  switch (workspace) {
    case "owner":
      return getOwnerSuggestedAction(key);
    case "crm":
    default:
      return getCrmSuggestedAction(key);
  }
}

export function getProactiveGreeting(context: AgentSessionContext): string {
  switch (context.workspace) {
    case "owner":
      return getOwnerProactiveGreeting(context);
    case "crm":
    default:
      return getCrmProactiveGreeting(context);
  }
}
