import { NextRequest, NextResponse } from "next/server";
import { verifyDesktopBearerAuth } from "@/lib/auth/desktop-bearer-auth";
import {
  replaceStaffWeeklySchedule,
  replaceStaffWeeklyWindowSchedule,
  upsertScheduleOverride,
  deleteScheduleOverride,
  createBlockedTime,
  deleteBlockedTime,
  type ScheduleMutationActor,
  type ScheduleMutationFailure,
} from "@/lib/schedule/schedule-mutations";
import { logError } from "@/lib/logger";

/**
 * POST /api/desktop/v1/schedule/mutations
 *
 * Dispatches schedule mutation actions using the shared server-only mutation
 * module. All authority checks (role, branch) are applied inside the shared
 * functions — this route only handles auth, routing, and HTTP status mapping.
 *
 * Request body shape:
 * {
 *   action: "replace_weekly_schedule"
 *         | "replace_weekly_window_schedule"
 *         | "upsert_override"
 *         | "delete_override"
 *         | "create_blocked_time"
 *         | "delete_blocked_time";
 *   payload: <action-specific object>;
 * }
 *
 * Auth: Bearer <Supabase access_token>
 * Branch: NOT trusted from payload — enforced via actor.branchId derived
 *         from the authenticated staff record.
 *
 * RLS: All writes flow through the user's bearer-auth Supabase client, which
 *      means Postgres RLS policies on staff_schedules, schedule_overrides,
 *      and blocked_times enforce branch-scoped write access.
 *
 * Roles: canAdjustStaffSchedule is authoritative. Management roles and
 *        canonical CRM/front-desk roles retain the current hosted behavior.
 */

type ScheduleMutationAction =
  | "replace_weekly_schedule"
  | "replace_weekly_window_schedule"
  | "upsert_override"
  | "delete_override"
  | "create_blocked_time"
  | "delete_blocked_time";

const VALID_ACTIONS = new Set<string>([
  "replace_weekly_schedule",
  "replace_weekly_window_schedule",
  "upsert_override",
  "delete_override",
  "create_blocked_time",
  "delete_blocked_time",
]);

function domainCodeToHttpStatus(code: string): number {
  switch (code) {
    case "UNAUTHORIZED":
    case "BRANCH_MISMATCH":
      return 403;
    case "INVALID_INPUT":
    case "INVALID_SHIFT_TYPE":
    case "INVALID_OVERNIGHT_WINDOW":
    case "OVERLAPPING_WINDOWS":
      return 400;
    case "NOT_FOUND":
      return 404;
    case "MIGRATION_REQUIRED":
      return 503;
    case "RLS_DENIED":
      return 403;
    case "DATABASE_CONSTRAINT":
    case "SAVE_FAILED":
      return 422;
    default:
      return 500;
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // 1. Verify bearer auth and load operator context
  const authResult = await verifyDesktopBearerAuth(req);
  if (!authResult.ok) {
    return NextResponse.json(
      { ok: false, code: authResult.code, message: authResult.message },
      { status: authResult.status, headers: { "Cache-Control": "no-store" } }
    );
  }

  const { operator, client } = authResult;
  const staff = operator.staff;
  const staffRole = operator.staffRole;

  if (!staff || !staffRole) {
    return NextResponse.json(
      {
        ok: false,
        code: "CRM_PERMISSION_DENIED",
        message: "Schedule access is unavailable for this account.",
      },
      { status: 403, headers: { "Cache-Control": "no-store" } }
    );
  }

  const branchId = staff.branch_id;

  if (!branchId) {
    return NextResponse.json(
      {
        ok: false,
        code: "STAFF_NOT_FOUND",
        message: "No branch associated with this staff account.",
      },
      { status: 403, headers: { "Cache-Control": "no-store" } }
    );
  }

  // 2. Parse JSON body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, code: "VALIDATION_ERROR", message: "Invalid JSON payload." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { ok: false, code: "VALIDATION_ERROR", message: "Request body must be a JSON object." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const { action, payload } = body as { action?: unknown; payload?: unknown };

  if (typeof action !== "string" || !VALID_ACTIONS.has(action)) {
    return NextResponse.json(
      {
        ok: false,
        code: "VALIDATION_ERROR",
        message: `Unknown or missing action. Valid actions: ${[...VALID_ACTIONS].join(", ")}.`,
      },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  // 3. Build actor from server-resolved operator (never from client-supplied fields)
  const actor: ScheduleMutationActor = {
    staffId: staff.id,
    branchId,
    role: staffRole,
  };

  // 4. Dispatch to shared mutation function
  try {
    let result: ScheduleMutationFailure | { ok: true; [key: string]: unknown };

    switch (action as ScheduleMutationAction) {
      case "replace_weekly_schedule":
        result = await replaceStaffWeeklySchedule(client, actor, payload);
        break;
      case "replace_weekly_window_schedule":
        result = await replaceStaffWeeklyWindowSchedule(client, actor, payload);
        break;
      case "upsert_override":
        result = await upsertScheduleOverride(client, actor, payload);
        break;
      case "delete_override":
        result = await deleteScheduleOverride(client, actor, payload);
        break;
      case "create_blocked_time":
        result = await createBlockedTime(client, actor, payload);
        break;
      case "delete_blocked_time":
        result = await deleteBlockedTime(client, actor, payload);
        break;
    }

    if (!result.ok) {
      const failure = result as ScheduleMutationFailure;
      const status = domainCodeToHttpStatus(failure.code);
      return NextResponse.json(
        { ok: false, code: failure.code, message: failure.message },
        { status, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(result, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    logError("api.desktop.v1.schedule.mutations.failed", {
      error: err,
      action,
      branchId,
      staffId: staff.id,
    });
    return NextResponse.json(
      {
        ok: false,
        code: "UNKNOWN_ERROR",
        message: "The schedule mutation could not be completed. Please try again.",
      },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
