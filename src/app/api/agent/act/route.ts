import { NextRequest, NextResponse } from "next/server";

import { getApiContext } from "@/lib/api/get-api-context";
import { logError } from "@/lib/logger";
import { isAgentCoachEnabled, isWorkspaceEnabled } from "@/lib/agents/config";
import { executeAgentTool, isSupportedTool } from "@/lib/agents/tools";
import { logAgentInteraction } from "@/lib/agents/audit";
import type { AgentSessionContext } from "@/lib/agents/types";

export async function POST(req: NextRequest) {
  if (!isAgentCoachEnabled()) {
    return NextResponse.json({ error: "Agent coach is not configured" }, { status: 503 });
  }

  const ctx = await getApiContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { tool?: string; params?: Record<string, unknown>; context?: AgentSessionContext };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { tool, params = {}, context } = body;

  if (!tool || !isSupportedTool(tool)) {
    return NextResponse.json({ error: "Unsupported or missing tool" }, { status: 400 });
  }

  if (!context || !isWorkspaceEnabled(context.workspace)) {
    return NextResponse.json({ error: "Unsupported or disabled workspace" }, { status: 400 });
  }

  // Enforce the user can only act within their own branch.
  if (context.branchId !== ctx.branchId || context.userId !== ctx.userId) {
    return NextResponse.json({ error: "Context mismatch" }, { status: 403 });
  }

  try {
    const result = await executeAgentTool({ tool, params, context });

    await logAgentInteraction({
      sessionId: context.sessionId ?? `${context.workspace}:${context.userId}:${Date.now()}`,
      type: "action_clicked",
      workspace: context.workspace,
      userId: context.userId,
      page: context.page,
      role: context.role,
      action: { id: tool, label: tool, payload: params as Record<string, string | number | boolean | null> },
      metadata: { resultOk: result.ok },
    });

    return NextResponse.json(result, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (err) {
    logError("agent.act.failed", {
      error: err,
      tool,
      userId: ctx.userId,
      page: context.page,
    });

    return NextResponse.json(
      { ok: false, message: "Action could not be completed." },
      { status: 500 }
    );
  }
}
