import "server-only";

import type { ServiceLineRequest } from "@/lib/validations/booking";
import type { ServiceDeliveryMode } from "./service-types";
import { resolveServiceLineQuote } from "./resolve-service-line-quote";
import { ServiceLineQuoteError, type ServiceLineQuote } from "./service-line-quote";

/** Aligns one guest's line requests to the existing ordered serviceIds contract. */
export async function resolveBookingLineQuotes(input: {
  branchId: string;
  serviceIds: string[];
  serviceLines?: ServiceLineRequest[];
  audience: "public" | "crm";
  deliveryMode: Exclude<ServiceDeliveryMode, "any">;
}): Promise<ServiceLineQuote[]> {
  if (input.serviceLines && (
    input.serviceLines.length !== input.serviceIds.length ||
    input.serviceLines.some((line, index) => line.serviceId !== input.serviceIds[index])
  )) throw new ServiceLineQuoteError("INVALID_SERVICE_DURATION");
  return Promise.all(input.serviceIds.map(async (serviceId, index) => {
    const quote = await resolveServiceLineQuote({
      branchId: input.branchId,
      serviceId,
      requestedDurationMinutes: input.serviceLines?.[index]?.requestedDurationMinutes,
      audience: input.audience,
      deliveryMode: input.deliveryMode,
    });
    const expected = input.serviceLines?.[index]?.expectedQuoteVersion;
    if (expected && expected !== quote.quoteVersion) {
      throw new ServiceLineQuoteError("SERVICE_QUOTE_CHANGED");
    }
    return quote;
  }));
}
