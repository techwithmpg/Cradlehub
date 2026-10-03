export type SheetRowClassification =
  | "HEADER"
  | "SUMMARY"
  | "STAFF_DUTY"
  | "SERVICE"
  | "FINANCIAL_NOTE"
  | "INFORMATIONAL"
  | "UNKNOWN_NEEDS_REVIEW";

export type SheetConfidence = "recognized" | "needs_review";

export interface SheetSource {
  spreadsheetId: string;
  sheetName: string;
  startRow: number;
  endRow: number;
  sourceKey: string;
  contentFingerprint: string;
}

export interface SheetAmountEvidence {
  raw: string;
  amount: number | null;
  marker: string | null;
}

export interface SheetPaymentEvidence {
  cash: SheetAmountEvidence;
  gcash: SheetAmountEvidence;
  bankQr: SheetAmountEvidence;
  cardTerminal: SheetAmountEvidence;
}

export interface SheetService {
  sourceRow: number;
  rawName: string;
  hours: SheetAmountEvidence;
  quotedRate: SheetAmountEvidence;
}

export interface SheetVisit {
  sourceType: "MASTER_SHEET";
  readOnly: true;
  source: SheetSource;
  businessDate: string | null;
  timeRaw: string;
  customerRawName: string;
  locationRawValue: string;
  attendantRawNames: string;
  services: SheetService[];
  paymentEvidence: SheetPaymentEvidence[];
  fuel: SheetAmountEvidence[];
  commission: SheetAmountEvidence[];
  confidence: SheetConfidence;
  ambiguities: string[];
}

export interface SheetDuty {
  sourceType: "MASTER_SHEET";
  readOnly: true;
  source: SheetSource;
  businessDate: string | null;
  staffRawName: string;
  dutyRawValue: string;
  confidence: SheetConfidence;
  ambiguities: string[];
}

export interface ClassifiedSheetRow {
  sourceRow: number;
  classification: SheetRowClassification;
  rawCells: string[];
  reason?: string;
}

export interface SheetReviewRow {
  source: SheetSource;
  businessDate: string | null;
  rawCells: string[];
  reason: string;
}

export interface SheetProjection {
  spreadsheetId: string;
  sheetName: string;
  businessTimezone: "Asia/Manila";
  visits: SheetVisit[];
  duties: SheetDuty[];
  classifiedRows: ClassifiedSheetRow[];
  needsReview: SheetReviewRow[];
}
