import { NextRequest } from "next/server";
import { z } from "zod";
import { recordAssignedDriverLiveLocationAction } from "@/app/(dashboard)/staff/driver/map/live-location-action";
import { requireDriver } from "@/lib/driver/server";
import { driverJson, driverError, readDriverBody, validDriverMutation } from "@/lib/driver/http";
const point = z
  .object({
    bookingId: z.guid(),
    lat: z.number().finite().min(-90).max(90),
    lng: z.number().finite().min(-180).max(180),
    accuracyMeters: z.number().positive().max(50),
    observedAt: z.iso.datetime({ offset: true }),
  })
  .strict();
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  if (!validDriverMutation(request)) return driverJson({ ok: false }, 403);
  if (process.env.CRADLEHUB_DRIVER_NATIVE_LOCATION_ENABLED !== "true")
    return driverJson({ ok: false, message: "Native location sharing is inactive." }, 503);
  try {
    await requireDriver();
    const parsed = point.safeParse(await readDriverBody(request));
    if (!parsed.success) return driverJson({ ok: false }, 400);
    const age = Date.now() - Date.parse(parsed.data.observedAt);
    if (age < -5000 || age > 30000)
      return driverJson({ ok: false, message: "Fresh GPS required." }, 422);
    const result = await recordAssignedDriverLiveLocationAction(parsed.data);
    return driverJson(result, result.ok ? 200 : 409);
  } catch (e) {
    return driverError(e);
  }
}
