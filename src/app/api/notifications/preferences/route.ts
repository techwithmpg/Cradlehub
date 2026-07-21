import { NextRequest, NextResponse } from "next/server";

import { canonicalizeSystemRole } from "@/constants/staff";
import { getApiContext } from "@/lib/api/get-api-context";
import {
  isSameOriginPushRequest,
  readLimitedPushJson,
} from "@/lib/notifications/push/request";
import { notificationPreferencePatchSchema } from "@/lib/notifications/push/schemas";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const DEFAULT_OWNER_PREFERENCE = "home_service_and_urgent" as const;

function response(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function GET() {
  const context = await getApiContext();
  if (!context) return response({ error: "Unauthorized" }, 401);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notification_delivery_preferences")
    .select("owner_booking_preference")
    .maybeSingle();
  if (error) return response({ error: "Could not load preferences" }, 500);
  return response({
    ownerBookingPreference:
      data?.owner_booking_preference ?? DEFAULT_OWNER_PREFERENCE,
  });
}

export async function PATCH(request: NextRequest) {
  if (!isSameOriginPushRequest(request)) {
    return response({ error: "Invalid request origin" }, 403);
  }
  const context = await getApiContext();
  if (!context) return response({ error: "Unauthorized" }, 401);
  if (canonicalizeSystemRole(context.role) !== "owner") {
    return response({ error: "Only Owner can change this preference" }, 403);
  }

  try {
    const parsed = notificationPreferencePatchSchema.safeParse(
      await readLimitedPushJson(request)
    );
    if (!parsed.success) return response({ error: "Invalid preference" }, 400);
    const supabase = await createClient();
    const { error } = await supabase
      .from("notification_delivery_preferences")
      .upsert(
        {
          auth_user_id: context.userId,
          owner_booking_preference: parsed.data.ownerBookingPreference,
        },
        { onConflict: "auth_user_id" }
      );
    if (error) return response({ error: "Could not save preference" }, 500);
    return response({ ok: true, ...parsed.data });
  } catch (error) {
    const status =
      error instanceof Error && error.message === "PAYLOAD_TOO_LARGE" ? 413 : 400;
    return response({ error: "Invalid request body" }, status);
  }
}
