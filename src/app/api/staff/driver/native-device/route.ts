import { nativeDriverPushReady } from "@/lib/driver/native-push";
import { NextRequest } from "next/server";
import { z } from "zod";
import { requireDriver, DriverApiError } from "@/lib/driver/server";
import { driverJson, driverError, readDriverBody, validDriverMutation } from "@/lib/driver/http";
const device = z
  .object({
    installationId: z.guid(),
    enabled: z.boolean(),
    token: z.string().min(80).max(4096).optional(),
  })
  .strict();
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  if (!validDriverMutation(request)) return driverJson({ ok: false }, 403);
  try {
    if (!nativeDriverPushReady())
      throw new DriverApiError(503, "native_push_inactive", "Native alerts are not enabled.");
    const { db } = await requireDriver();
    const parsed = device.safeParse(await readDriverBody(request));
    if (!parsed.success || (parsed.data.enabled && !parsed.data.token))
      return driverJson({ ok: false }, 400);
    const result = await db.rpc(
      "driver_native_register" as never,
      { p_device: parsed.data } as never
    );
    if (result.error || result.data !== true)
      throw new DriverApiError(
        503,
        "registration_unavailable",
        "Device alerts were not registered."
      );
    return driverJson({ ok: true, channel: parsed.data.enabled ? "native_preferred" : "revoked" });
  } catch (e) {
    return driverError(e);
  }
}
