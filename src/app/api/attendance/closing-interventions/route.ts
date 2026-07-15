import { NextRequest, NextResponse } from "next/server";

import {
  isClosingInterventionStage,
  runClosingAttendanceInterventions,
  type ClosingInterventionStage,
} from "@/lib/attendance/closing-interventions";
import { logError } from "@/lib/logger";

function bearerToken(request: NextRequest): string | null {
  const match = (request.headers.get("authorization") ?? "").match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

function isAuthorized(request: NextRequest): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    logError("attendance.closing_interventions.missing_cron_secret");
    return false;
  }
  return bearerToken(request) === secret;
}

async function requestedStage(
  request: NextRequest
): Promise<ClosingInterventionStage | null> {
  let value: unknown = request.nextUrl.searchParams.get("stage") ?? "catch_up";
  if (request.method === "POST" && !request.nextUrl.searchParams.has("stage")) {
    const body = await request.json().catch(() => null);
    if (body && typeof body === "object" && "stage" in body) {
      value = body.stage;
    }
  }
  return isClosingInterventionStage(value) ? value : null;
}

async function handle(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stage = await requestedStage(request);
  if (!stage) {
    return NextResponse.json(
      { ok: false, error: "Unsupported closing intervention stage." },
      { status: 400 }
    );
  }

  try {
    const result = await runClosingAttendanceInterventions(stage);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    logError("attendance.closing_interventions.failed", { error });
    return NextResponse.json(
      { ok: false, error: "Closing Attendance intervention run failed." },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
