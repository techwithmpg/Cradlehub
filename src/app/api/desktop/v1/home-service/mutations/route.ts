import { z } from "zod";
import { assignHomeServiceDriver } from "@/lib/home-service/dispatch-operations";
import {
  assignBookingTherapist,
  prepareHomeServiceDispatch,
  assignBookingTherapistSchema,
  prepareHomeServiceDispatchSchema,
} from "@/lib/bookings/crm-booking-operations";
import {
  withDesktopBookingContext,
  desktopFailure,
  desktopJson,
  bookingOperationResponse,
} from "@/lib/bookings/desktop-booking-contract";
const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("assign_driver"),
    bookingId: z.guid(),
    driverId: z.guid().nullable(),
  }),
  assignBookingTherapistSchema.extend({ action: z.literal("assign_therapist") }),
  prepareHomeServiceDispatchSchema.extend({ action: z.literal("prepare_dispatch") }),
]);
export async function POST(request: Request) {
  return withDesktopBookingContext(request, async (ctx) => {
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success)
      return desktopFailure("VALIDATION_ERROR", "Invalid Home Service mutation payload.", 400);
    const input = parsed.data;
    if (input.action === "assign_driver") {
      const result = await assignHomeServiceDriver(
        ctx.supabase,
        {
          staffId: ctx.me.id,
          branchId: ctx.me.branch_id,
          role: ctx.me.system_role,
          allowOwnerCrossBranch: false,
        },
        input
      );
      if (result.ok) return desktopJson({ ok: true, data: {} });
      const status =
        result.code === "BOOKING_NOT_FOUND"
          ? 404
          : ["BRANCH_FORBIDDEN", "FORBIDDEN"].includes(result.code)
            ? 403
            : ["SAVE_FAILED", "SERVER_ERROR"].includes(result.code)
              ? 500
              : 400;
      return desktopFailure(result.code, result.message, status);
    }
    const homeContext = { ...ctx, homeServiceOnly: true as const };
    return bookingOperationResponse(
      input.action === "assign_therapist"
        ? await assignBookingTherapist(homeContext, input)
        : await prepareHomeServiceDispatch(homeContext, input)
    );
  });
}
