export type SheetNativeSource = {
  sheetName: string;
  startRow: number;
  endRow: number;
  sourceKey: string;
  contentFingerprint: string;
};

type ExternalReference = {
  sourceType: "MASTER_SHEET";
  readOnly: true;
  canonicalLink: "UNLINKED";
  branchId: string;
  branchLabel: string;
  branchDecisionStatus: "PROVISIONAL";
  businessDate: string;
  source: SheetNativeSource;
  observedAt: string;
  reviewWarnings: string[];
};

export type SheetBookingReference = ExternalReference & {
  kind: "sheet_booking_reference";
  timeText: string | null;
  sortMinute: number | null;
  customerDisplay: string | null;
  attendantDisplay: string | null;
  services: { name: string; hours: number | null }[];
  possibleMatch: "POSSIBLE_MATCH" | "NEEDS_REVIEW" | null;
};

export type SheetTransactionReference = ExternalReference & {
  kind: "sheet_transaction_reference";
  evidenceKey: string;
  timeText: string | null;
  sortMinute: number | null;
  customerDisplay: string | null;
  channel: "Cash" | "GCash" | "Bank / QR" | "Card / terminal";
  amount: number | null;
  ambiguous: boolean;
};

export type SheetNativeReferencesState =
  | {
      status: "available";
      observedAt: string;
      branchLabel: string;
      bookings: SheetBookingReference[];
      payments: SheetTransactionReference[];
    }
  | {
      status: "available_empty";
      observedAt: string;
      branchLabel: string;
      bookings: [];
      payments: [];
    }
  | {
      status: "outside_loaded_window" | "unavailable" | "forbidden";
      observedAt: string;
      bookings?: never;
      payments?: never;
    };
