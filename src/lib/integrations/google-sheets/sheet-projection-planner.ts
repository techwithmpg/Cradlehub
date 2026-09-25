import type { ParsedSheetRow } from "./sheet-parser";
import type {
  SheetCapturedRow,
  SheetDeliveryEvidence,
  SheetFinancialEvidence,
  SheetProjection,
  SheetRowProjectionPlan,
} from "./sheet-ingestion-types";
import { normalizeSheetText } from "./sheet-source-identity";

export function getSheetDeliveryEvidence(row: ParsedSheetRow): SheetDeliveryEvidence {
  const location =
    row.location &&
    !/^(monday|tuesday|wednesday|thursday|friday|saturday|sunday|(?:january|february|march|april|may|june|july|august|september|october|november|december) \d{1,2}, \d{4})$/i.test(
      row.location
    )
      ? row.location
      : null;
  const rawFuel = String(row.fuelOrTravelRaw ?? "").trim();
  const marker = rawFuel && row.fuelOrTravel === null && !/^-+$/.test(rawFuel) ? rawFuel : null;
  const explicit = [location, marker].some((value) => /^(home[ -]service|hs)$/i.test(value ?? ""));
  const fuel = row.fuelOrTravel !== null && row.fuelOrTravel > 0;
  return {
    state: explicit
      ? "explicit_home_service"
      : marker
        ? "ambiguous"
        : location && fuel
          ? "location_and_fuel"
          : location
            ? "location_only"
            : fuel
              ? "fuel_only"
              : "none",
    location,
    numericFuel: row.fuelOrTravel,
    marker,
    // Even explicit text needs validated destination and branch/service support.
    confirmedDelivery: null,
  };
}
export function getSheetFinancialEvidence(row: ParsedSheetRow): SheetFinancialEvidence {
  const total = row.payments.reduce((sum, component) => sum + (component.amount ?? 0), 0);
  const hasPayment = row.payments.some((component) => component.amount !== null);
  return {
    rate: row.rate,
    rateRaw: row.rateRaw,
    payments: row.payments.map((component) => ({ ...component })),
    splitPayment: row.hasSplitPayment,
    numericPaymentTotal: total,
    difference: row.rate !== null && hasPayment ? Math.round((total - row.rate) * 100) / 100 : null,
    fuelOrTravel: row.fuelOrTravel,
    fuelOrTravelRaw: row.fuelOrTravelRaw,
    commission: row.commission,
    commissionRaw: row.commissionRaw,
  };
}
export function planSheetRow(row: SheetCapturedRow): SheetRowProjectionPlan {
  const parsed = row.parsed;
  const label = normalizeSheetText(parsed.rawValues[0]);
  const aggregateLabel =
    /^(total sales|total expense for the day|total gross sales|total weekly income|net profit:?|total no\.?\s*of hours)$/.test(
      label
    );
  const incompleteService =
    !parsed.service && Boolean(parsed.time && parsed.attendant && parsed.client);
  const intent: SheetRowProjectionPlan["intent"] =
    aggregateLabel || parsed.rowType === "aggregate_summary"
      ? "aggregate"
      : parsed.rowType === "staff_duty"
        ? "duty"
        : parsed.rowType === "service_candidate" || incompleteService
          ? "service"
          : parsed.rowType === "financial_or_note"
            ? "financial"
            : parsed.rowType === "unknown"
              ? "unknown"
              : "context";
  const delivery = getSheetDeliveryEvidence(parsed);
  const financial = getSheetFinancialEvidence(parsed);
  const projections: SheetProjection[] = [];
  if (intent === "service") {
    projections.push({
      module: "bookings",
      kind: "canonical_write_candidate",
      dependsOn: [],
      reason: "Booking owns the appointment and service transaction.",
    });
    projections.push({
      module: "schedule",
      kind: "derived_visibility",
      dependsOn: ["bookings"],
      reason: "Booked workload, never a second appointment.",
    });
    if (
      parsed.payments.some((p) => p.amount !== null || p.marker) ||
      parsed.rateRaw ||
      parsed.fuelOrTravelRaw ||
      parsed.commissionRaw
    ) {
      projections.push({
        module: "cash_flow",
        kind: "canonical_write_candidate",
        dependsOn: ["bookings"],
        reason: "Preserve components; future financial records depend on the canonical booking.",
      });
    }
    if (delivery.state !== "none")
      projections.push({
        module: "home_service",
        kind: "pending_confirmation",
        dependsOn: ["bookings"],
        reason:
          "Delivery evidence requires confirmation; location/fuel is not a proven assignment rule.",
      });
  } else if (intent === "duty") {
    projections.push({
      module: "schedule",
      kind: "canonical_write_candidate",
      dependsOn: [],
      reason: "Duty assignment only; no invented shift times.",
    });
  } else if (intent === "financial") {
    projections.push({
      module: "cash_flow",
      kind: "pending_confirmation",
      dependsOn: [],
      reason: "Financial meaning and subtype must be validated.",
    });
  } else if (intent === "aggregate") {
    projections.push({
      module: "cash_flow",
      kind: "evidence_only",
      dependsOn: [],
      reason: "Reconciliation evidence; never an independent transaction.",
    });
  }
  const informational = intent === "aggregate" || intent === "context";
  return {
    source: row.source,
    rowType: parsed.rowType,
    intent,
    decision: informational ? "informational" : "needs_attention",
    severity: informational ? "low" : "high",
    reasons: informational ? ["EVIDENCE_ONLY"] : ["VALIDATION_PENDING"],
    projections,
    parserIssues: [...parsed.issues],
    delivery,
    financial,
  };
}
