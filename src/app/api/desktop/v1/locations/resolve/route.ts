import { NextRequest } from "next/server";
import { z } from "zod";
import { verifyDesktopBearerAuth } from "@/lib/auth/desktop-bearer-auth";
import { desktopFailure, desktopJson } from "@/lib/bookings/desktop-booking-contract";
import {
  checkLocationRateLimit,
  verifyLocationBranchAccess,
  GOOGLE_PLACES_TIMEOUT_MS,
} from "@/lib/locations/location-security";
import { logError } from "@/lib/logger";

const resolveSchema = z.object({
  placeId: z.string().trim().min(1, "Place ID is required").max(300),
  branchId: z.string().uuid("Invalid branch ID").optional(),
  sessionToken: z.string().trim().min(1).max(100).optional(),
});

export async function POST(req: NextRequest) {
  const auth = await verifyDesktopBearerAuth(req);
  if (!auth.ok) {
    return desktopFailure(auth.code, auth.message, auth.status);
  }

  // Rate limiting per operator/user and branch
  const branchScope = auth.operator.staff?.branch_id || "any";
  const rateLimitKey = `resolve:${branchScope}:${auth.operator.authUserId || auth.user.id}`;
  const rateLimit = await checkLocationRateLimit(rateLimitKey, 60);
  if (!rateLimit.allowed) {
    if (rateLimit.code === "RATE_LIMITER_UNAVAILABLE") {
      return desktopFailure(
        "RATE_LIMITER_UNAVAILABLE",
        rateLimit.error || "Distributed rate limiter is unavailable.",
        503
      );
    }
    return desktopFailure(
      "RATE_LIMIT_EXCEEDED",
      rateLimit.error || "Too many location resolution requests. Please wait a moment and try again.",
      429
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return desktopFailure("VALIDATION_ERROR", "Invalid JSON payload.", 400);
  }

  const parsed = resolveSchema.safeParse(body);
  if (!parsed.success) {
    return desktopFailure(
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message || "Invalid input.",
      400
    );
  }

  const { placeId, branchId, sessionToken } = parsed.data;

  // Enforce staff branch authorization if branchId provided
  if (branchId && !verifyLocationBranchAccess(auth.operator, branchId)) {
    return desktopFailure(
      "CRM_BRANCH_FORBIDDEN",
      "You can only resolve locations for your assigned branch.",
      403
    );
  }

  const apiKey = process.env.GOOGLE_MAPS_SERVER_API_KEY;
  if (!apiKey) {
    return desktopFailure(
      "LOCATION_SERVICE_NOT_CONFIGURED",
      "Google Places API is not configured on the hosted server.",
      503
    );
  }

  try {
    const url = new URL(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`);
    if (sessionToken) {
      url.searchParams.set("sessionToken", sessionToken);
    }

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "id,displayName,formattedAddress,location,addressComponents,googleMapsURI",
      },
      signal: AbortSignal.timeout(GOOGLE_PLACES_TIMEOUT_MS),
    });

    if (!res.ok) {
      logError("api.desktop.locations.resolve.upstream_error", { status: res.status });
      return desktopFailure(
        "LOCATION_RESOLVE_FAILED",
        "Failed to resolve place details from provider.",
        502
      );
    }

    const data = (await res.json()) as {
      id?: string;
      displayName?: { text?: string };
      formattedAddress?: string;
      location?: { latitude?: number; longitude?: number };
      addressComponents?: Array<{
        longText?: string;
        shortText?: string;
        types?: string[];
      }>;
      googleMapsURI?: string;
    };

    const lat = Number(data.location?.latitude);
    const lng = Number(data.location?.longitude);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return desktopFailure(
        "LOCATION_RESOLVE_FAILED",
        "The selected place did not return valid geographic coordinates.",
        422
      );
    }

    const formattedAddress = data.formattedAddress?.trim() || data.displayName?.text?.trim() || "";
    if (!formattedAddress) {
      return desktopFailure(
        "LOCATION_RESOLVE_FAILED",
        "The selected place did not return a valid formatted address.",
        422
      );
    }

    const addressComponents = (data.addressComponents || []).map((c) => ({
      long_name: c.longText ?? "",
      short_name: c.shortText ?? "",
      types: c.types ?? [],
    }));

    const mapUrl =
      data.googleMapsURI || `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

    return desktopJson({
      ok: true,
      location: {
        placeId: data.id || placeId,
        formattedAddress,
        lat,
        lng,
        addressComponents,
        mapUrl,
      },
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "TimeoutError") {
      logError("api.desktop.locations.resolve.timeout");
      return desktopFailure(
        "LOCATION_RESOLVE_TIMEOUT",
        "Location provider timed out while resolving place details. Please try again.",
        504
      );
    }
    logError("api.desktop.locations.resolve.failed", { error });
    return desktopFailure("SERVER_ERROR", "Could not resolve location.", 500);
  }
}
