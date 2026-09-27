import "server-only";
import { NextResponse } from "next/server";
import { verifyDesktopBearerAuth } from "@/lib/auth/desktop-bearer-auth";
import type { InhouseBookingOperator } from "@/lib/bookings/inhouse-booking-engine";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { canonicalizeSystemRole, isSystemRole, type SystemRole } from "@/constants/staff";
import { logError } from "@/lib/logger";

export type DesktopStaffActor = {
  staffId: string;
  authUserId: string;
  systemRole: SystemRole;
  branchId: string | null;
};

export function desktopStaffJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export function desktopStaffFailure(code: string, message: string, status: number) {
  return desktopStaffJson({ ok: false, code, message }, status);
}

export function mapServiceCodeToHttpStatus(code: string): number {
  switch (code) {
    case "UNAUTHENTICATED":
      return 401;
    case "FORBIDDEN":
    case "BRANCH_MISMATCH":
      return 403;
    case "NOT_FOUND":
      return 404;
    case "INVALID_STATE":
      return 409;
    case "SAVE_FAILED":
      return 500;
    case "INVALID_INPUT":
    default:
      return 400;
  }
}

export async function withDesktopStaffContext(
  request: Request,
  run: (ctx: {
    operator: InhouseBookingOperator;
    actor: DesktopStaffActor;
    user: { id: string; email?: string | null };
    client: SupabaseClient<Database>;
  }) => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    const auth = await verifyDesktopBearerAuth(request);
    if (!auth.ok) {
      return desktopStaffFailure(auth.code, auth.message, auth.status);
    }
    if (!auth.operator.staff) {
      return desktopStaffFailure("FORBIDDEN", "Active staff profile required.", 403);
    }
    const canonicalRole = canonicalizeSystemRole(auth.operator.staff.system_role);
    if (!isSystemRole(canonicalRole)) {
      return desktopStaffFailure("FORBIDDEN", "Invalid or unrecognized staff system role.", 403);
    }
    const actor: DesktopStaffActor = {
      staffId: auth.operator.staff.id,
      authUserId: auth.operator.authUserId,
      systemRole: canonicalRole,
      branchId: auth.operator.staff.branch_id,
    };
    return await run({
      operator: auth.operator,
      actor,
      user: auth.user,
      client: auth.client,
    });
  } catch (error) {
    logError("api.desktop.v1.staff.unhandled_error", { error });
    return desktopStaffFailure("SERVER_ERROR", "An unexpected server error occurred.", 500);
  }
}
