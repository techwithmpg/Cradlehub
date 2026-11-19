import { NextResponse } from "next/server";
import { DriverApiError } from "@/lib/driver/server";
import {
  issueDriverApkSignedDownload,
  requireDriverApkActor,
  resolveDriverApkReleaseState,
} from "@/lib/driver/apk-distribution";

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
};

function handleError(error: unknown) {
  if (error instanceof DriverApiError) {
    return NextResponse.json(
      { ok: false, code: error.code, error: error.message },
      { status: error.status, headers: NO_STORE_HEADERS }
    );
  }
  return NextResponse.json(
    {
      ok: false,
      code: "driver_apk_failed",
      error: "Driver App download request failed.",
    },
    { status: 500, headers: NO_STORE_HEADERS }
  );
}

export async function GET() {
  try {
    await requireDriverApkActor();
    const resolved = resolveDriverApkReleaseState();
    return NextResponse.json(
      { ok: true, release: resolved.publicInfo },
      { status: 200, headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    return handleError(error);
  }
}

export async function POST() {
  try {
    const signed = await issueDriverApkSignedDownload();
    return NextResponse.json(
      { ok: true, ...signed },
      { status: 200, headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    return handleError(error);
  }
}
