import { NextResponse } from "next/server";
import { DriverApiError } from "./server";
export function driverJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
export function driverError(e: unknown) {
  return e instanceof DriverApiError
    ? driverJson({ ok: false, code: e.code, message: e.message }, e.status)
    : driverJson(
        { ok: false, code: "unavailable", message: "Driver service is temporarily unavailable." },
        503
      );
}
export function validDriverMutation(request: Request) {
  return (
    request.headers.get("origin") === new URL(request.url).origin &&
    request.headers.get("content-type")?.startsWith("application/json")
  );
}
export async function readDriverBody(request: Request) {
  const body = await request.text();
  if (body.length > 8192) throw new DriverApiError(413, "body_too_large", "Request too large.");
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new DriverApiError(400, "invalid_json", "Invalid request.");
  }
}
