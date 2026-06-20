import { createAdminClient } from "@/lib/supabase/admin";
import { BRANCH_TIMEZONE } from "@/lib/engine/slot-time";
import { logError, logInfo } from "@/lib/logger";

export type FollowUpRuleResult = {
  ruleId: string;
  triggered: number;
  errors: number;
};

export type FollowUpContext = {
  now: Date;
  timezone: string;
};

export type FollowUpRule = {
  id: string;
  name: string;
  run: (ctx: FollowUpContext) => Promise<FollowUpRuleResult>;
};

export function getBranchDateParts(now: Date, timezone = BRANCH_TIMEZONE) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).formatToParts(now);

    const get = (type: string) =>
      parts.find((p) => p.type === type)?.value ?? "00";

    const h = parseInt(get("hour"), 10) % 24;
    const m = parseInt(get("minute"), 10);
    const s = parseInt(get("second"), 10);

    return {
      ymd: `${get("year")}-${get("month")}-${get("day")}`,
      minutesIntoDay: h * 60 + m + s / 60,
    };
  } catch {
    return {
      ymd: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`,
      minutesIntoDay: now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60,
    };
  }
}

export function minutesFromNow(now: Date, minutes: number): string {
  return new Date(now.getTime() - minutes * 60_000).toISOString();
}

export function hoursFromNow(now: Date, hours: number): string {
  return minutesFromNow(now, hours * 60);
}

export function bookingDateTimeToIso(bookingDate: string, startTime: string): string {
  const [hours = 0, minutes = 0] = startTime.split(":").map(Number);
  const date = new Date(`${bookingDate}T00:00:00+08:00`);
  date.setHours(hours, minutes, 0, 0);
  return date.toISOString();
}

export async function runFollowUpRules(
  rules: FollowUpRule[],
  ctx: FollowUpContext
): Promise<FollowUpRuleResult[]> {
  const results: FollowUpRuleResult[] = [];
  for (const rule of rules) {
    try {
      const result = await rule.run(ctx);
      results.push(result);
      if (result.triggered > 0 || result.errors > 0) {
        logInfo("agent.follow_up.rule_completed", {
          ruleId: rule.id,
          triggered: result.triggered,
          errors: result.errors,
        });
      }
    } catch (err) {
      logError("agent.follow_up.rule_failed", { ruleId: rule.id, error: err });
      results.push({ ruleId: rule.id, triggered: 0, errors: 1 });
    }
  }
  return results;
}

export async function logFollowUpRun(
  results: FollowUpRuleResult[],
  ctx: FollowUpContext
): Promise<void> {
  const supabase = createAdminClient();
  const totalTriggered = results.reduce((sum, r) => sum + r.triggered, 0);
  const totalErrors = results.reduce((sum, r) => sum + r.errors, 0);

  const { error } = await supabase.from("agent_audit_logs").insert({
    session_id: `follow-up:${Date.now()}`,
    type: "proactive_nudge",
    workspace: "crm",
    user_id: "00000000-0000-0000-0000-000000000000",
    page: "/agent/follow-up",
    role: "system",
    message: null,
    action: null,
    metadata: {
      branch_timezone: ctx.timezone,
      branch_time: getBranchDateParts(ctx.now, ctx.timezone),
      results,
      total_triggered: totalTriggered,
      total_errors: totalErrors,
    },
  });

  if (error) {
    logError("agent.follow_up.audit_failed", { error });
  }
}
