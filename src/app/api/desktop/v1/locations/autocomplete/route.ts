import { NextRequest } from "next/server";
import { z } from "zod";
import { verifyDesktopBearerAuth } from "@/lib/auth/desktop-bearer-auth";
import { desktopFailure, desktopJson } from "@/lib/bookings/desktop-booking-contract";
import { logError } from "@/lib/logger";

const autocompleteSchema = z.object({
  query: z.string().trim().min(2, "Search query must be at least 2 characters").max(200),
  branchId: z.string().uuid("Invalid branch ID").optional(),
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

  const parsed = autocompleteSchema.safeParse(body);
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
    const { query, branchId, sessionToken } = parsed.data;
    const bodyPayload: Record<string, unknown> = {
      input: query,
      includedRegionCodes: ["ph"],
    };

    if (sessionToken) {
      bodyPayload.sessionToken = sessionToken;
    }

    if (branchId) {
      const { data: branch } = await auth.client
        .from("branches")
        .select("latitude, longitude")
        .eq("id", branchId)
        .maybeSingle();

      const lat = Number(branch?.latitude);
      const lng = Number(branch?.longitude);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        bodyPayload.locationBias = {
          circle: {
            center: { latitude: lat, longitude: lng },
            radius: 50000.0,
          },
        };
      }
    }

    const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
      },
      body: JSON.stringify(bodyPayload),
    });

    if (!res.ok) {
      logError("api.desktop.locations.autocomplete.upstream_error", { status: res.status });
      return desktopFailure(
        "LOCATION_LOOKUP_FAILED",
        "Failed to retrieve location suggestions from provider.",
        502
      );
    }

    const data = (await res.json()) as {
      suggestions?: Array<{
        placePrediction?: {
          placeId?: string;
          text?: { text?: string };
          structuredFormat?: {
            mainText?: { text?: string };
            secondaryText?: { text?: string };
          };
        };
      }>;
    };

    const predictions = (data.suggestions || []).flatMap((s) => {
      const p = s.placePrediction;
      if (!p?.placeId) return [];
      return [
        {
          placeId: p.placeId,
          description: p.text?.text ?? "",
          mainText: p.structuredFormat?.mainText?.text ?? p.text?.text ?? "",
          secondaryText: p.structuredFormat?.secondaryText?.text ?? "",
        },
      ];
    });

    return desktopJson({ ok: true, predictions });
  } catch (error) {
    logError("api.desktop.locations.autocomplete.failed", { error });
    return desktopFailure("SERVER_ERROR", "Could not complete location search.", 500);
  }
}
