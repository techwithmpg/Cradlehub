import { NextRequest } from "next/server";
import { z } from "zod";
import { verifyDesktopBearerAuth } from "@/lib/auth/desktop-bearer-auth";
import { desktopFailure, desktopJson } from "@/lib/bookings/desktop-booking-contract";
import { calculateHomeServiceDistanceQuote } from "@/lib/home-service/distance-service";
import { logError } from "@/lib/logger";

const distanceQuoteSchema = z.object({
  branchId: z.string().uuid("Invalid branch ID"),
  destination: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }),
});

export async function POST(req: NextRequest) {
  const auth = await verifyDesktopBearerAuth(req);
  if (!auth.ok) {
    return desktopFailure(auth.code, auth.message, auth.status);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return desktopFailure("VALIDATION_ERROR", "Invalid JSON payload.", 400);
  }

  const parsed = distanceQuoteSchema.safeParse(body);
  if (!parsed.success) {
    return desktopFailure(
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message || "Invalid input.",
      400
    );
  }

  const { branchId, destination } = parsed.data;

  // Enforce staff branch authorization
  if (auth.operator.staffRole !== "owner" && auth.operator.staff?.branch_id !== branchId) {
    return desktopFailure(
      "CRM_BRANCH_FORBIDDEN",
      "You can only calculate distance for your assigned branch.",
      403
    );
  }

  try {
    const result = await calculateHomeServiceDistanceQuote({
      branchId,
      destination,
    });

    if (!result.ok) {
      return desktopFailure(result.code, result.message, 400);
    }

    return desktopJson({
      ok: true,
      quote: result.quote,
    });
  } catch (error) {
    logError("api.desktop.locations.distance_quote.failed", { error });
    return desktopFailure("SERVER_ERROR", "Could not calculate transportation quote.", 500);
  }
}
