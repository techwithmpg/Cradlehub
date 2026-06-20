import { NextRequest, NextResponse } from "next/server";

import { logError, logInfo } from "@/lib/logger";
import {
  runFollowUpRules,
  logFollowUpRun,
  type FollowUpContext,
} from "@/lib/agents/follow-up";
import { DEFAULT_FOLLOW_UP_RULES } from "@/lib/agents/follow-up-rules";

function getBearerToken(req: NextRequest): string | null {
  const auth = req.headers.get("authorization") ?? "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

function authorize(req: NextRequest): boolean {
  if (process.env.NODE_ENV !== "production") return true;

  const secret = process.env.CRON_SECRET;
  if (!secret) {
    logError("agent.follow_up.missing_cron_secret");
    return false;
  }

  return getBearerToken(req) === secret;
}

export async function POST(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ctx: FollowUpContext = {
    now: new Date(),
    timezone: process.env.BRANCH_TIMEZONE ?? "Asia/Manila",
  };

  try {
    const results = await runFollowUpRules(DEFAULT_FOLLOW_UP_RULES, ctx);
    await logFollowUpRun(results, ctx);

    const totalTriggered = results.reduce((sum, r) => sum + r.triggered, 0);
    logInfo("agent.follow_up.completed", {
      totalTriggered,
      results: results.map((r) => ({ ruleId: r.ruleId, triggered: r.triggered })),
    });

    return NextResponse.json({ ok: true, results }, { status: 200 });
  } catch (err) {
    logError("agent.follow_up.failed", { error: err });
    return NextResponse.json({ ok: false, error: "Follow-up run failed" }, { status: 500 });
  }
}

// Allow GET for Vercel Cron integrations.
export async function GET(req: NextRequest) {
  return POST(req);
}
