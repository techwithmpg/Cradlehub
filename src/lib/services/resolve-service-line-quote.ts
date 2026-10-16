import "server-only";
import { createHash } from "node:crypto";

import { createAdminClient } from "@/lib/supabase/admin";
import { validateBranchServiceEligibility } from "@/lib/services/service-catalog";
import type { ServiceDeliveryMode } from "@/lib/services/service-types";
import {
  calculateServiceLineQuote,
  serviceLineQuoteOptions,
  ServiceLineQuoteError,
  type ServiceLineQuote,
} from "./service-line-quote";

export type ServiceLineQuoteRequest = {
  branchId: string;
  serviceId: string;
  requestedDurationMinutes?: number | null;
  audience: "public" | "crm";
  deliveryMode: Exclude<ServiceDeliveryMode, "any">;
};

export function quoteVersionFor(branchId: string, quote: ServiceLineQuote): string {
  return createHash("sha256").update(JSON.stringify([
    branchId, quote.serviceId, quote.durationPolicy, quote.baseDurationMinutes,
    quote.selectedDurationMinutes, quote.basePrice, quote.extensionIncrementMinutes,
    quote.extensionPrice, quote.maximumDurationMinutes, quote.extensionUnits,
    quote.calculatedPrice,
  ])).digest("hex");
}

async function loadAuthoritativeTerms(input: ServiceLineQuoteRequest) {
  const eligibility = await validateBranchServiceEligibility({
    branchId: input.branchId,
    serviceIds: [input.serviceId],
    audience: input.audience,
    deliveryMode: input.deliveryMode,
    useAdminClient: true,
  });
  if (!eligibility.ok) throw new ServiceLineQuoteError("SERVICE_INELIGIBLE");

  const admin = createAdminClient();
  const [serviceResult, branchResult] = await Promise.all([
    admin.from("services")
      .select("id, duration_policy, duration_minutes, price, extension_increment_minutes, extension_price, maximum_duration_minutes")
      .eq("id", input.serviceId).maybeSingle(),
    admin.from("branch_services")
      .select("custom_duration_minutes, custom_price")
      .eq("branch_id", input.branchId).eq("service_id", input.serviceId).eq("is_active", true).maybeSingle(),
  ]);
  if (serviceResult.error || branchResult.error || !serviceResult.data || !branchResult.data) {
    throw new ServiceLineQuoteError("SERVICE_DURATION_CONFIGURATION_INVALID");
  }
  return { service: serviceResult.data, branch: branchResult.data };
}

/** Authoritative server boundary. Never accept price or policy from the browser. */
export async function resolveServiceLineQuote(input: ServiceLineQuoteRequest): Promise<ServiceLineQuote> {
  const terms = await loadAuthoritativeTerms(input);
  const quote = calculateServiceLineQuote({ ...terms, requestedDurationMinutes: input.requestedDurationMinutes });
  return { ...quote, quoteVersion: quoteVersionFor(input.branchId, quote) };
}

export async function resolveServiceLineQuoteOptions(input: ServiceLineQuoteRequest): Promise<ServiceLineQuote[]> {
  const terms = await loadAuthoritativeTerms(input);
  return serviceLineQuoteOptions(terms).map((quote) => ({ ...quote,
    quoteVersion: quoteVersionFor(input.branchId, quote) }));
}
