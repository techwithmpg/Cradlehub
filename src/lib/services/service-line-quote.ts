/** Commercial terms for one purchased service line. Prices are PHP, stored at cent precision. */
export type ServiceLineQuote = {
  serviceId: string;
  durationPolicy: "fixed" | "extendable";
  baseDurationMinutes: number;
  selectedDurationMinutes: number;
  basePrice: number;
  extensionIncrementMinutes: number | null;
  extensionPrice: number | null;
  maximumDurationMinutes: number | null;
  extensionUnits: number;
  calculatedPrice: number;
  /** Opaque comparison token issued by the server; never used as price authority. */
  quoteVersion?: string;
};

export type ServiceLineCommercialSnapshot = {
  service_id: string;
  duration_policy_snapshot: "fixed" | "extendable";
  base_duration_minutes_snapshot: number;
  selected_duration_minutes: number;
  base_price_snapshot: number;
  extension_increment_minutes_snapshot: number | null;
  extension_price_snapshot: number | null;
  extension_units: number;
  calculated_price: number;
};

export class ServiceLineQuoteError extends Error {
  constructor(public readonly code:
    | "INVALID_SERVICE_DURATION"
    | "SERVICE_DURATION_CONFIGURATION_INVALID"
    | "SERVICE_DURATION_OVERRIDE_UNSUPPORTED"
    | "SERVICE_INELIGIBLE"
    | "SERVICE_QUOTE_CHANGED",
  ) {
    super(code);
    this.name = "ServiceLineQuoteError";
  }
}

export type ServiceLineCatalogTerms = {
  id: string;
  duration_policy: string;
  duration_minutes: number;
  price: number | string;
  extension_increment_minutes: number | null;
  extension_price: number | string | null;
  maximum_duration_minutes: number | null;
};

export type ServiceLineBranchTerms = {
  custom_duration_minutes: number | null;
  custom_price: number | string | null;
};

function cents(value: number | string | null): number {
  if (value === null || !/^\d+(?:\.\d{1,2})?$/.test(String(value))) {
    throw new ServiceLineQuoteError("SERVICE_DURATION_CONFIGURATION_INVALID");
  }
  const amount = Number(value);
  const result = Math.round(amount * 100);
  if (!Number.isSafeInteger(result) || result < 0) {
    throw new ServiceLineQuoteError("SERVICE_DURATION_CONFIGURATION_INVALID");
  }
  return result;
}

export function calculateServiceLineQuote(input: {
  service: ServiceLineCatalogTerms;
  branch: ServiceLineBranchTerms;
  requestedDurationMinutes?: number | null;
}): ServiceLineQuote {
  const { service, branch } = input;
  const baseDuration = service.duration_minutes;
  if (!Number.isSafeInteger(baseDuration) || baseDuration <= 0) {
    throw new ServiceLineQuoteError("SERVICE_DURATION_CONFIGURATION_INVALID");
  }
  const canonicalBaseCents = cents(service.price);
  if (service.duration_policy === "fixed") {
    const selectedDuration = branch.custom_duration_minutes ?? baseDuration;
    if (!Number.isSafeInteger(selectedDuration) || selectedDuration <= 0) {
      throw new ServiceLineQuoteError("SERVICE_DURATION_CONFIGURATION_INVALID");
    }
    if (input.requestedDurationMinutes != null && input.requestedDurationMinutes !== selectedDuration) {
      throw new ServiceLineQuoteError("INVALID_SERVICE_DURATION");
    }
    return {
      serviceId: service.id,
      durationPolicy: "fixed",
      baseDurationMinutes: baseDuration,
      selectedDurationMinutes: selectedDuration,
      basePrice: cents(branch.custom_price ?? service.price) / 100,
      extensionIncrementMinutes: null,
      extensionPrice: null,
      maximumDurationMinutes: null,
      extensionUnits: 0,
      calculatedPrice: cents(branch.custom_price ?? service.price) / 100,
    };
  }
  if (service.duration_policy !== "extendable") {
    throw new ServiceLineQuoteError("SERVICE_DURATION_CONFIGURATION_INVALID");
  }
  if (branch.custom_duration_minutes !== null || branch.custom_price !== null) {
    throw new ServiceLineQuoteError("SERVICE_DURATION_OVERRIDE_UNSUPPORTED");
  }
  const increment = service.extension_increment_minutes;
  const max = service.maximum_duration_minutes;
  if (!Number.isSafeInteger(increment) || increment === null || increment <= 0 ||
      !Number.isSafeInteger(max) || max === null || max <= baseDuration ||
      (max - baseDuration) % increment !== 0) {
    throw new ServiceLineQuoteError("SERVICE_DURATION_CONFIGURATION_INVALID");
  }
  const extensionCents = cents(service.extension_price);
  if (extensionCents <= 0) {
    throw new ServiceLineQuoteError("SERVICE_DURATION_CONFIGURATION_INVALID");
  }
  const selectedDuration = input.requestedDurationMinutes ?? baseDuration;
  if (!Number.isSafeInteger(selectedDuration) || selectedDuration < baseDuration ||
      selectedDuration > max || (selectedDuration - baseDuration) % increment !== 0) {
    throw new ServiceLineQuoteError("INVALID_SERVICE_DURATION");
  }
  const extensionUnits = (selectedDuration - baseDuration) / increment;
  const calculatedCents = canonicalBaseCents + extensionUnits * extensionCents;
  if (!Number.isSafeInteger(calculatedCents)) {
    throw new ServiceLineQuoteError("SERVICE_DURATION_CONFIGURATION_INVALID");
  }
  return {
    serviceId: service.id,
    durationPolicy: "extendable",
    baseDurationMinutes: baseDuration,
    selectedDurationMinutes: selectedDuration,
    basePrice: canonicalBaseCents / 100,
    extensionIncrementMinutes: increment,
    extensionPrice: extensionCents / 100,
    maximumDurationMinutes: max,
    extensionUnits,
    calculatedPrice: calculatedCents / 100,
  };
}

export function serviceLineQuoteOptions(input: {
  service: ServiceLineCatalogTerms;
  branch: ServiceLineBranchTerms;
}): ServiceLineQuote[] {
  const base = calculateServiceLineQuote(input);
  if (base.durationPolicy === "fixed") return [base];
  const options: ServiceLineQuote[] = [];
  for (let duration = base.baseDurationMinutes; duration <= base.maximumDurationMinutes!;
    duration += base.extensionIncrementMinutes!) {
    options.push(calculateServiceLineQuote({ ...input, requestedDurationMinutes: duration }));
  }
  for (let i = 1; i < options.length; i++) {
    const current = options[i]!;
    const previous = options[i - 1]!;
    if (current.selectedDurationMinutes <= previous.selectedDurationMinutes ||
        current.calculatedPrice <= previous.calculatedPrice) {
      throw new ServiceLineQuoteError("SERVICE_DURATION_CONFIGURATION_INVALID");
    }
  }
  return options;
}

export function toServiceLineCommercialSnapshot(quote: ServiceLineQuote): ServiceLineCommercialSnapshot {
  return {
    service_id: quote.serviceId,
    duration_policy_snapshot: quote.durationPolicy,
    base_duration_minutes_snapshot: quote.baseDurationMinutes,
    selected_duration_minutes: quote.selectedDurationMinutes,
    base_price_snapshot: quote.basePrice,
    extension_increment_minutes_snapshot: quote.extensionIncrementMinutes,
    extension_price_snapshot: quote.extensionPrice,
    extension_units: quote.extensionUnits,
    calculated_price: quote.calculatedPrice,
  };
}
