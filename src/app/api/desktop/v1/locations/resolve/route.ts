import { NextRequest } from "next/server";
import { z } from "zod";
import { verifyDesktopBearerAuth } from "@/lib/auth/desktop-bearer-auth";
import { desktopFailure, desktopJson } from "@/lib/bookings/desktop-booking-contract";
import { logError } from "@/lib/logger";

const resolveSchema = z.object({
  placeId: z.string().trim().min(1, "Place ID is required").max(300),
  sessionToken: z.string().trim().max(100).optional(),
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

  const parsed = resolveSchema.safeParse(body);
  if (!parsed.success) {
    return desktopFailure(
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message || "Invalid input.",
      400
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
    const { placeId, sessionToken } = parsed.data;
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
  } catch (error) {
    logError("api.desktop.locations.resolve.failed", { error });
    return desktopFailure("SERVER_ERROR", "Could not resolve location.", 500);
  }
}
