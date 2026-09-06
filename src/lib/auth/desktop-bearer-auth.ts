import "server-only";

import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { canonicalizeSystemRole } from "@/constants/staff";
import { canAccessCrmWorkspace } from "@/lib/auth/crm-permissions";
import type { InhouseBookingOperator } from "@/lib/bookings/inhouse-booking-engine";

export type DesktopBearerAuthResult =
  | {
      ok: true;
      operator: InhouseBookingOperator;
      user: { id: string; email?: string | null };
      client: SupabaseClient<Database>;
    }
  | {
      ok: false;
      status: number;
      code: string;
      message: string;
    };

export async function verifyDesktopBearerAuth(request: Request): Promise<DesktopBearerAuthResult> {
  const authHeader = request.headers.get("authorization") ?? request.headers.get("Authorization");

  if (!authHeader) {
    return {
      ok: false,
      status: 401,
      code: "UNAUTHORIZED",
      message: "Authorization header is required.",
    };
  }

  const trimmedHeader = authHeader.trim();
  const match = /^Bearer(?:\s+(.*))?$/i.exec(trimmedHeader);
  if (!match) {
    return {
      ok: false,
      status: 401,
      code: "UNAUTHORIZED",
      message: "Malformed Authorization header. Expected Bearer scheme.",
    };
  }

  const token = match[1]?.trim();
  if (!token) {
    return {
      ok: false,
      status: 401,
      code: "UNAUTHORIZED",
      message: "Bearer token is missing or empty.",
    };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      ok: false,
      status: 500,
      code: "SERVER_CONFIG_ERROR",
      message: "Supabase configuration is missing.",
    };
  }

  // Create a server-side client with the user's bearer token
  const client = createSupabaseClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser(token);

  if (authError || !user) {
    return {
      ok: false,
      status: 401,
      code: "UNAUTHORIZED",
      message: "Invalid or expired access token.",
    };
  }

  // Query active staff record linked to auth_user_id
  const { data: me, error: staffError } = await client
    .from("staff")
    .select("id, branch_id, system_role")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (staffError || !me) {
    return {
      ok: false,
      status: 403,
      code: "STAFF_NOT_FOUND",
      message: "No active staff profile found for this authenticated user.",
    };
  }

  const staffRole = canonicalizeSystemRole(me.system_role);
  if (!canAccessCrmWorkspace(staffRole)) {
    return {
      ok: false,
      status: 403,
      code: "CRM_PERMISSION_DENIED",
      message: "You do not have permission to access the CRM booking workspace.",
    };
  }

  const operator: InhouseBookingOperator = {
    authUserId: user.id,
    staff: {
      id: me.id,
      branch_id: me.branch_id,
      system_role: me.system_role,
    },
    staffRole,
    isDevBypass: false,
  };

  return {
    ok: true,
    operator,
    user: { id: user.id, email: user.email },
    client,
  };
}
