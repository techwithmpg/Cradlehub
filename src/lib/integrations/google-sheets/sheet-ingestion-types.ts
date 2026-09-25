import type { ParsedSheetRow, SheetCell, SheetRowType } from "./sheet-parser";

export type SheetSyncDecision = "ready" | "warning" | "needs_attention" | "informational";
export type SheetSyncSeverity = "low" | "medium" | "high" | "critical";
export type SheetProjectionModule = "bookings" | "cash_flow" | "schedule" | "home_service";
export type SheetProjectionKind =
  | "canonical_write_candidate"
  | "derived_visibility"
  | "evidence_only"
  | "pending_confirmation";
export type SheetSourceIdentity = {
  spreadsheetId: string;
  sheetName: string;
  sourceRow: number;
  businessDate: string | null;
  key: string;
  fingerprint: string;
};
export type SheetCapturedRow = {
  source: SheetSourceIdentity;
  rawValues: SheetCell[];
  parsed: ParsedSheetRow;
  restorations: { column: number; ownerRow: number; ownerColumn: number }[];
};
export type SheetCheck = {
  code: string;
  phase: "schema" | "preflight" | "resolution" | "validation";
  passed: boolean | null;
  severity: SheetSyncSeverity;
  impact: "warning" | "needs_attention";
  field: string;
  message: string;
  requiredAction: string;
  evidence: Record<string, unknown>;
  candidates?: { id: string; label: string; reason?: string }[];
};
export type SheetResolution<T> = {
  status: "resolved" | "ambiguous" | "missing";
  value: T | null;
  candidates: T[];
  method:
    | "exact_name"
    | "normalized_name"
    | "nickname"
    | "approved_alias"
    | "service_capability_disambiguation"
    | "contact_identity"
    | "unavailable"
    | "none";
  reason: string;
  rejected?: { id: string; reason: string }[];
};
export type SheetApprovedAlias = {
  rawAlias: string;
  targetId: string;
  targetType: "staff" | "service" | "customer";
  branchId: string | null;
  approvedBy: string;
  approvedAt: string;
  status: "active" | "revoked";
};
export type SheetCorrection = {
  sourceKey: string;
  expectedFingerprint: string;
  field:
    | "staffId"
    | "customerId"
    | "serviceId"
    | "startTime"
    | "durationMinutes"
    | "deliveryType"
    | "paymentComponents";
  value: unknown;
  approvedBy: string;
  approvedAt: string;
  nextStep: "revalidate_before_apply";
};
export type SheetDeliveryEvidence = {
  state:
    | "none"
    | "location_only"
    | "fuel_only"
    | "location_and_fuel"
    | "explicit_home_service"
    | "ambiguous";
  location: string | null;
  numericFuel: number | null;
  marker: string | null;
  confirmedDelivery: "in_spa" | "home_service" | null;
};
export type SheetFinancialEvidence = {
  rate: number | null;
  rateRaw: SheetCell;
  payments: ParsedSheetRow["payments"];
  splitPayment: boolean;
  numericPaymentTotal: number;
  difference: number | null;
  fuelOrTravel: number | null;
  fuelOrTravelRaw: SheetCell;
  commission: number | null;
  commissionRaw: SheetCell;
};
export type SheetProjection = {
  module: SheetProjectionModule;
  kind: SheetProjectionKind;
  dependsOn: SheetProjectionModule[];
  reason: string;
  waitingFor?: string[];
};
export type SheetRowProjectionPlan = {
  source: SheetSourceIdentity;
  rowType: SheetRowType;
  intent: "service" | "duty" | "financial" | "aggregate" | "context" | "unknown";
  decision: SheetSyncDecision;
  severity: SheetSyncSeverity;
  reasons: string[];
  projections: SheetProjection[];
  parserIssues: string[];
  delivery: SheetDeliveryEvidence;
  financial: SheetFinancialEvidence;
};
export type SheetConflictCandidate = {
  type: "provider_overlap" | "possible_duplicate_booking" | "duplicate_source";
  sourceRows: number[];
  evidence: Record<string, unknown>;
  severity: SheetSyncSeverity;
};
export type SheetAttentionItem = {
  id: string;
  source: SheetSourceIdentity;
  decision: "warning" | "needs_attention";
  severity: SheetSyncSeverity;
  code: string;
  title: string;
  summary: string;
  field: string;
  rawValue: unknown;
  normalizedValue: unknown;
  candidates: NonNullable<SheetCheck["candidates"]>;
  validationEvidence: Record<string, unknown>;
  affectedModules: SheetProjectionModule[];
  requiredAction: string;
  afterCorrection: "revalidate_before_apply";
};
