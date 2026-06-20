import { createAdminClient } from "@/lib/supabase/admin";
import { logError, logBusinessEvent } from "@/lib/logger";
import type { AgentSessionContext, AgentMessage, AgentSuggestedAction } from "@/lib/agents/types";

type JsonValue = string | number | boolean | null | { [key: string]: JsonValue } | JsonValue[];

export type AgentAuditType = "coach_message" | "action_shown" | "action_clicked" | "proactive_nudge";

export type AgentAuditInput = {
  sessionId: string;
  type: AgentAuditType;
  workspace: string;
  userId: string;
  page: string;
  role: string;
  message?: AgentMessage;
  action?: AgentSuggestedAction;
  metadata?: Record<string, JsonValue>;
};

/**
 * Logs every agent interaction to the database for owner review.
 * Failures are logged but never thrown so the user experience is not interrupted.
 */
export async function logAgentInteraction(input: AgentAuditInput): Promise<void> {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("agent_audit_logs").insert({
      session_id: input.sessionId,
      type: input.type,
      workspace: input.workspace,
      user_id: input.userId,
      page: input.page,
      role: input.role,
      message: input.message ?? null,
      action: input.action ?? null,
      metadata: input.metadata ?? {},
    });

    if (error) {
      logError("agent_audit.insert_failed", { error, input: sanitizeForLog(input) });
    }

    logBusinessEvent("agent.interaction", {
      sessionId: input.sessionId,
      type: input.type,
      workspace: input.workspace,
      page: input.page,
    });
  } catch (err) {
    logError("agent_audit.unexpected_error", { error: err, input: sanitizeForLog(input) });
  }
}

export function buildSessionId(context: AgentSessionContext): string {
  const ts = Date.now().toString(36);
  return `${context.workspace}:${context.userId}:${context.page}:${ts}`;
}

function sanitizeForLog(input: AgentAuditInput): Record<string, unknown> {
  // Avoid logging full message payloads; keep it small.
  return {
    sessionId: input.sessionId,
    type: input.type,
    workspace: input.workspace,
    page: input.page,
    role: input.role,
  };
}
