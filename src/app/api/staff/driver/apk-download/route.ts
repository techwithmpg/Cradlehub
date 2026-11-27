import { NextRequest, NextResponse } from "next/server";
import { DriverApiError } from "@/lib/driver/server";
import {
  issueDriverApkDownloadLink,
  requireDriverApkActor,
  resolveDriverApkReleaseState,
} from "@/lib/driver/apk-distribution";

const PRIVATE_NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};

function handleError(error: unknown) {
  if (error instanceof DriverApiError) {
    return NextResponse.json(
      { ok: false, code: error.code, error: error.message },
      { status: error.status, headers: PRIVATE_NO_STORE_HEADERS }
    );
  }
  return NextResponse.json(
    {
      ok: false,
      code: "driver_apk_failed",
      error: "Driver App download request failed.",
    },
    { status: 500, headers: PRIVATE_NO_STORE_HEADERS }
  );
}

export async function GET() {
  try {
    await requireDriverApkActor();
    const resolved = resolveDriverApkReleaseState();
    return NextResponse.json(
      { ok: true, release: resolved.publicInfo },
      { status: 200, headers: PRIVATE_NO_STORE_HEADERS }
    );
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const origin = request.headers.get("origin");
    const secFetchSite = request.headers.get("sec-fetch-site");
    if (
      (origin && origin !== request.nextUrl.origin) ||
      secFetchSite === "cross-site"
    ) {
      return NextResponse.json(
        {
          ok: false,
          code: "invalid_request_origin",
          error: "Cross-origin download authorization requests are not permitted.",
        },
        { status: 403, headers: PRIVATE_NO_STORE_HEADERS }
      );
    }

    const issued = await issueDriverApkDownloadLink();
    return NextResponse.json(
      { ok: true, ...issued },
      { status: 200, headers: PRIVATE_NO_STORE_HEADERS }
    );
  } catch (error) {
    return handleError(error);
  }
}
