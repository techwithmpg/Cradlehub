import { NextRequest, NextResponse } from "next/server";
import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";

import { getApiContext } from "@/lib/api/get-api-context";
import { logError } from "@/lib/logger";
import { isAgentCoachEnabled, isWorkspaceEnabled } from "@/lib/agents/config";
import { buildCrmSystemPrompt, getCrmSuggestedAction } from "@/lib/agents/crm/prompts";
import { getCrmProactiveGreeting } from "@/lib/agents/crm/prompts";
import { logAgentInteraction, buildSessionId } from "@/lib/agents/audit";
import type { CoachRequestBody, CoachResponse, AgentMessage } from "@/lib/agents/types";

const primitivePayloadSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const coachResponseSchema = z.object({
  content: z.string().describe("Friendly, concise reply to the CRM user. 1-3 sentences."),
  actions: z
    .array(
      z.object({
        id: z.string(),
        label: z.string(),
        href: z.string().optional(),
        action: z.string().optional(),
        payload: z.record(z.string(), primitivePayloadSchema).optional(),
      })
    )
    .max(3)
    .describe("Up to 3 suggested one-click actions the user can take.")
    .default([]),
});

export async function POST(req: NextRequest) {
  if (!isAgentCoachEnabled()) {
    return NextResponse.json({ error: "Agent coach is not configured" }, { status: 503 });
  }

  const ctx = await getApiContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: CoachRequestBody;
  try {
    body = (await req.json()) as CoachRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { context, message, history } = body;

  if (!context || context.workspace !== "crm") {
    return NextResponse.json(
      { error: "Unsupported workspace. CRM coach is the only workspace enabled." },
      { status: 400 }
    );
  }

  if (!isWorkspaceEnabled(context.workspace)) {
    return NextResponse.json({ error: "Workspace not enabled for coach" }, { status: 403 });
  }

  const sessionId = context.sessionId ?? buildSessionId(context);

  try {
    const system = buildCrmSystemPrompt(context);
    const proactiveGreeting = getCrmProactiveGreeting(context);

    const messages = [
      ...(history ?? []).map((m) => ({
        role: m.role,
        content: m.content,
      })),
      {
        role: "user" as const,
        content: message?.trim() ? message.trim() : proactiveGreeting,
      },
    ];

    const { object } = await generateObject({
      model: anthropic("claude-3-5-sonnet-20241022"),
      system,
      messages,
      schema: coachResponseSchema,
      schemaName: "CoachResponse",
      schemaDescription: "A helpful CRM coach reply with up to 3 suggested actions.",
      temperature: 0.7,
    });

    // Enforce only known CRM action keys for safety.
    const safeActions = object.actions
      .map((a) => {
        const known = a.action ? getCrmSuggestedAction(a.action) : undefined;
        if (!known) {
          return {
            ...a,
            action: undefined,
            payload: undefined,
          };
        }
        return {
          ...known,
          payload: a.payload ?? known.payload,
        };
      })
      .slice(0, 3);

    const reply: AgentMessage = {
      role: "assistant",
      content: object.content,
      actions: safeActions.length > 0 ? safeActions : undefined,
    };

    await logAgentInteraction({
      sessionId,
      type: message?.trim() ? "coach_message" : "proactive_nudge",
      workspace: context.workspace,
      userId: context.userId,
      page: context.page,
      role: context.role,
      message: reply,
      metadata: {
        hasUserMessage: Boolean(message?.trim()),
        actionCount: safeActions.length,
      },
    });

    const response: CoachResponse = { reply, sessionId };
    return NextResponse.json(response, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (err) {
    logError("agent.coach.failed", {
      error: err,
      workspace: context.workspace,
      page: context.page,
      userId: context.userId,
    });

    return NextResponse.json(
      {
        reply: {
          role: "assistant" as const,
          content: "I'm having trouble thinking right now. Please try again in a moment.",
        },
        sessionId,
      },
      { status: 200 }
    );
  }
}
