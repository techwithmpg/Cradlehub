import { NextResponse, type NextRequest } from "next/server";
import { getAttendanceScanFeedRouteResult } from "@/lib/attendance/recent-scans-api";

export const dynamic = "force-dynamic";

const JSON_HEADERS = { "Cache-Control": "private, no-store" };

export async function GET(request: NextRequest) {
  const result = await getAttendanceScanFeedRouteResult(request.nextUrl.searchParams);
  return NextResponse.json(result.feed, {
    status: result.status,
    headers: JSON_HEADERS,
  });
}
