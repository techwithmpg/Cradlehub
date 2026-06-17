import { createHash } from "node:crypto";
import { logError } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/supabase";

const RECOVERY_RATE_LIMIT_MINUTES = 10;
const RECOVERY_EVENT_TYPES = [
  "self_password_reset_requested",
  "owner_password_recovery_sent",
] as const;

export type StaffAccountAccessEventType =
  | "self_password_reset_requested"
  | "owner_password_recovery_sent"
  | "owner_account_diagnostic_viewed"
  | "password_updated";

export type StaffAccountAccessOutcome =
  | "success"
  | "error"
  | "rate_limited"
  | "not_available";

type HeadersLike = {
  get(name: string): string | null;
};

export type StaffAccountAccessRequestContext = {
  ipHash: string | null;
  userAgent: string | null;
};

export function normalizeAuditEmail(email: string | null | undefined): string | null {
  const normalized = email?.trim().toLowerCase();
  return normalized || null;
}

export function getEmailDomain(email: string | null | undefined): string | null {
  const normalized = normalizeAuditEmail(email);
  return normalized?.split("@")[1] ?? null;
}

function hashAuditValue(value: string): string {
  const salt =
    process.env.AUTH_AUDIT_HASH_SALT ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    "cradlehub-auth-audit";
  return createHash("sha256").update(`${salt}:${value}`).digest("hex");
}

export function getStaffAccountAccessRequestContext(
  headers: HeadersLike
): StaffAccountAccessRequestContext {
  const forwardedFor = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = headers.get("x-real-ip")?.trim();
  const ip = forwardedFor || realIp || null;
  const userAgent = headers.get("user-agent")?.slice(0, 240) ?? null;

  return {
    ipHash: ip ? hashAuditValue(ip) : null,
    userAgent,
  };
}

export async function hasRecentAccountRecoveryEvent(
  email: string,
  windowMinutes = RECOVERY_RATE_LIMIT_MINUTES
): Promise<boolean> {
  const targetEmail = normalizeAuditEmail(email);
  if (!targetEmail) return false;

  const admin = createAdminClient();
  const since = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
  const { data, error } = await admin
    .from("staff_account_access_events")
    .select("id")
    .eq("target_email", targetEmail)
    .in("event_type", [...RECOVERY_EVENT_TYPES])
    .eq("outcome", "success")
    .gte("created_at", since)
    .limit(1);

  if (error) {
    logError("auth.account_access_rate_limit_check_failed", {
      error,
      targetEmailDomain: getEmailDomain(targetEmail),
    });
    return false;
  }

  return (data?.length ?? 0) > 0;
}

export async function recordStaffAccountAccessEvent(input: {
  eventType: StaffAccountAccessEventType;
  outcome: StaffAccountAccessOutcome;
  actorStaffId?: string | null;
  targetStaffId?: string | null;
  targetAuthUserId?: string | null;
  targetEmail?: string | null;
  requestContext?: StaffAccountAccessRequestContext | null;
  metadata?: Json;
}): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("staff_account_access_events").insert({
    actor_staff_id: input.actorStaffId ?? null,
    target_staff_id: input.targetStaffId ?? null,
    target_auth_user_id: input.targetAuthUserId ?? null,
    target_email: normalizeAuditEmail(input.targetEmail),
    event_type: input.eventType,
    outcome: input.outcome,
    ip_hash: input.requestContext?.ipHash ?? null,
    user_agent: input.requestContext?.userAgent ?? null,
    metadata: input.metadata ?? {},
  });

  if (error) {
    logError("auth.account_access_event_insert_failed", {
      error,
      eventType: input.eventType,
      outcome: input.outcome,
      targetEmailDomain: getEmailDomain(input.targetEmail),
    });
  }
}
