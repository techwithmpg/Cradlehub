import { NextRequest, NextResponse } from "next/server";

import { canonicalizeSystemRole } from "@/constants/staff";
import { getApiContext } from "@/lib/api/get-api-context";
import { logError, logInfo } from "@/lib/logger";
import { getWorkspacePathPrefix } from "@/lib/notifications/notification-targets";
import { isWebPushConfigured } from "@/lib/notifications/push/config";
import { sendWebPushToSubscription } from "@/lib/notifications/push/delivery";
import {
  isSameOriginPushRequest,
  readLimitedPushJson,
} from "@/lib/notifications/push/request";
import { pushEndpointSchema } from "@/lib/notifications/push/schemas";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";

export const runtime = "nodejs";

function response(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function statusCode(error: unknown) {
  if (!error || typeof error !== "object") return null;
  const value = (error as { statusCode?: unknown }).statusCode;
  return typeof value === "number" ? value : null;
}

export async function POST(request: NextRequest) {
  if (!isSameOriginPushRequest(request)) {
    return response({ error: "Invalid request origin" }, 403);
  }
  const context = await getApiContext();
  if (!context) return response({ error: "Unauthorized" }, 401);
  if (!isWebPushConfigured()) {
    return response({ error: "Browser notifications are not configured" }, 503);
  }

  let parsedBody: unknown;
  try {
    parsedBody = await readLimitedPushJson(request);
  } catch (error) {
    const status =
      error instanceof Error && error.message === "PAYLOAD_TOO_LARGE" ? 413 : 400;
    return response({ error: "Invalid request body" }, status);
  }
  const parsed = pushEndpointSchema.safeParse(parsedBody);
  if (!parsed.success) return response({ error: "Invalid endpoint" }, 400);

  let ownedSubscription:
    | Database["public"]["Tables"]["web_push_subscriptions"]["Row"]
    | null = null;
  try {
    const supabase = await createClient();
    const { data: subscription, error } = await supabase
      .from("web_push_subscriptions")
      .select("*")
      .eq("endpoint", parsed.data.endpoint)
      .eq("is_active", true)
      .maybeSingle();
    if (error || !subscription) {
      return response({ error: "This browser is not subscribed" }, 404);
    }
    ownedSubscription = subscription;

    if (
      subscription.last_success_at &&
      Date.now() - new Date(subscription.last_success_at).getTime() < 15_000
    ) {
      return response({ error: "Wait a moment before sending another test" }, 429);
    }

    const workspace = subscription.workspace as
      | "owner"
      | "crm"
      | "staff"
      | "driver"
      | "utility";
    const result = await sendWebPushToSubscription({
      subscription,
      priority: "normal",
      payload: JSON.stringify({
        notificationId: `test-${crypto.randomUUID()}`,
        title: "CradleHub browser notifications are ready",
        body: "This device can receive operational alerts when CradleHub is hidden or closed.",
        actionHref: getWorkspacePathPrefix(workspace),
        tag: "cradlehub-notification:test",
        priority: "normal",
        icon: "/icon.png",
        badge: "/icon.png",
        test: true,
      }),
    });
    await supabase
      .from("web_push_subscriptions")
      .update({ last_success_at: new Date().toISOString(), failure_count: 0 })
      .eq("id", subscription.id);
    logInfo("notification.push_test_delivered", {
      subscriptionId: subscription.id,
      workspace,
      resultCode: result.statusCode,
      role: canonicalizeSystemRole(context.role),
    });
    return response({ ok: true });
  } catch (error) {
    const code = statusCode(error);
    if (ownedSubscription) {
      const nextFailureCount = ownedSubscription.failure_count + 1;
      const deactivate =
        code === 404 || code === 410 || nextFailureCount >= 5;
      try {
        const supabase = await createClient();
        await supabase
          .from("web_push_subscriptions")
          .update({
            failure_count: nextFailureCount,
            last_failure_at: new Date().toISOString(),
            ...(deactivate ? { is_active: false } : {}),
          })
          .eq("id", ownedSubscription.id);
      } catch {
        // The original delivery failure remains the useful response/log event.
      }
    }
    logError("notification.push_test_failed", {
      userId: context.userId,
      resultCode: code,
      errorName: error instanceof Error ? error.name : "UnknownPushError",
    });
    return response({ error: "Test notification could not be delivered" }, 502);
  }
}
