import { NextRequest, NextResponse } from "next/server";

import { canonicalizeSystemRole } from "@/constants/staff";
import { getApiContext } from "@/lib/api/get-api-context";
import { isWebPushConfigured } from "@/lib/notifications/push/config";
import {
  isSameOriginPushRequest,
  readLimitedPushJson,
} from "@/lib/notifications/push/request";
import {
  pushEndpointSchema,
  pushSubscriptionSchema,
} from "@/lib/notifications/push/schemas";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function workspaceForRole(role: string) {
  const canonicalRole = canonicalizeSystemRole(role);
  if (
    canonicalRole === "owner" ||
    canonicalRole === "crm" ||
    canonicalRole === "staff" ||
    canonicalRole === "driver" ||
    canonicalRole === "utility"
  ) {
    return canonicalRole;
  }
  return null;
}

function noStoreJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function GET() {
  const context = await getApiContext();
  if (!context) return noStoreJson({ error: "Unauthorized" }, 401);
  const workspace = workspaceForRole(context.role);
  if (!workspace) return noStoreJson({ error: "Unsupported workspace" }, 403);

  const supabase = await createClient();
  const { count, error } = await supabase
    .from("web_push_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true);
  if (error) return noStoreJson({ error: "Could not load notification status" }, 500);

  return noStoreJson({
    configured: isWebPushConfigured(),
    activeSubscriptionCount: count ?? 0,
    workspace,
  });
}

export async function POST(request: NextRequest) {
  if (!isSameOriginPushRequest(request)) {
    return noStoreJson({ error: "Invalid request origin" }, 403);
  }
  const context = await getApiContext();
  if (!context) return noStoreJson({ error: "Unauthorized" }, 401);
  const workspace = workspaceForRole(context.role);
  if (!workspace) return noStoreJson({ error: "Unsupported workspace" }, 403);
  if (!isWebPushConfigured()) {
    return noStoreJson({ error: "Browser notifications are not configured" }, 503);
  }

  try {
    const parsed = pushSubscriptionSchema.safeParse(
      await readLimitedPushJson(request)
    );
    if (!parsed.success) {
      return noStoreJson({ error: "Invalid push subscription" }, 400);
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("web_push_subscriptions")
      .upsert(
        {
          auth_user_id: context.userId,
          staff_id: context.staffId,
          branch_id: workspace === "owner" ? null : context.branchId,
          workspace,
          endpoint: parsed.data.endpoint,
          p256dh: parsed.data.keys.p256dh,
          auth_secret: parsed.data.keys.auth,
          user_agent: request.headers.get("user-agent")?.slice(0, 1024) ?? null,
          device_label: parsed.data.deviceLabel ?? null,
          is_active: true,
          failure_count: 0,
          last_failure_at: null,
        },
        { onConflict: "endpoint" }
      )
      .select("id, is_active")
      .single();

    if (error || !data) {
      return noStoreJson({ error: "Could not save this browser subscription" }, 409);
    }
    return noStoreJson({ ok: true, subscriptionId: data.id, active: data.is_active });
  } catch (error) {
    const status =
      error instanceof Error && error.message === "PAYLOAD_TOO_LARGE" ? 413 : 400;
    return noStoreJson({ error: "Invalid request body" }, status);
  }
}

export async function DELETE(request: NextRequest) {
  if (!isSameOriginPushRequest(request)) {
    return noStoreJson({ error: "Invalid request origin" }, 403);
  }
  const context = await getApiContext();
  if (!context) return noStoreJson({ error: "Unauthorized" }, 401);

  try {
    const parsed = pushEndpointSchema.safeParse(await readLimitedPushJson(request));
    if (!parsed.success) return noStoreJson({ error: "Invalid endpoint" }, 400);
    const supabase = await createClient();
    const { error } = await supabase
      .from("web_push_subscriptions")
      .update({ is_active: false })
      .eq("endpoint", parsed.data.endpoint);
    if (error) return noStoreJson({ error: "Could not disable notifications" }, 500);
    return noStoreJson({ ok: true });
  } catch (error) {
    const status =
      error instanceof Error && error.message === "PAYLOAD_TOO_LARGE" ? 413 : 400;
    return noStoreJson({ error: "Invalid request body" }, status);
  }
}
