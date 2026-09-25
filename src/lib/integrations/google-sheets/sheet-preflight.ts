import { parseBookingTime } from "@/lib/bookings/booking-clock-time";
import { rangesOverlap } from "@/lib/engine/slot-time";
import type {
  SheetCapturedRow,
  SheetCheck,
  SheetConflictCandidate,
  SheetRowProjectionPlan,
} from "./sheet-ingestion-types";
import { normalizeSheetText } from "./sheet-source-identity";

export function sheetDurationMinutes(value: string | null): number | null {
  if (!value || !/^\d+(?:\.\d+)?(?:\s*(?:h|hr|hrs|hours?))?$/i.test(value.trim())) return null;
  const minutes = Number.parseFloat(value) * 60;
  return Number.isInteger(minutes) && minutes > 0 && minutes <= 1440 ? minutes : null;
}
export function sheetIssue(
  code: string,
  field: string,
  message: string,
  evidence: Record<string, unknown> = {},
  impact: SheetCheck["impact"] = "needs_attention"
): SheetCheck {
  return {
    code,
    phase: "preflight",
    passed: false,
    severity: impact === "warning" ? "medium" : "high",
    impact,
    field,
    message,
    requiredAction: message,
    evidence,
  };
}
export function preflightSheetRow(
  row: SheetCapturedRow,
  plan: SheetRowProjectionPlan
): SheetCheck[] {
  if (plan.intent === "context" || plan.intent === "aggregate") return [];
  const parsed = row.parsed;
  const checks: SheetCheck[] = [];
  if (!row.source.spreadsheetId || !row.source.sheetName || row.source.sourceRow < 1)
    checks.push(
      sheetIssue(
        "SOURCE_IDENTITY_MISSING",
        "source",
        "Confirm the source worksheet and row identity."
      )
    );
  if (!parsed.businessDate)
    checks.push(
      sheetIssue("DATE_MISSING", "businessDate", "Confirm the operational business date.")
    );
  if (plan.intent === "service") {
    for (const [field, code] of [
      ["time", "TIME_MISSING"],
      ["attendant", "STAFF_MISSING"],
      ["client", "CUSTOMER_MISSING"],
      ["service", "SERVICE_UNKNOWN"],
    ] as const) {
      if (!parsed[field]) checks.push(sheetIssue(code, field, `Supply the missing ${field}.`));
    }
    if (parsed.time && !parseBookingTime(parsed.time).ok)
      checks.push(
        sheetIssue(
          "TIME_INVALID",
          "time",
          "Confirm a valid appointment time, including AM/PM when needed."
        )
      );
    if (parsed.hours && sheetDurationMinutes(parsed.hours) === null)
      checks.push(
        sheetIssue("DURATION_INVALID", "hours", "Confirm the service duration in hours.")
      );
    if (plan.financial.difference !== null && plan.financial.difference !== 0)
      checks.push(
        sheetIssue(
          "PAYMENT_MISMATCH",
          "payments",
          "Explain the payment difference (for example partial payment, discount, voucher, or bundle) before financial application.",
          { difference: plan.financial.difference }
        )
      );
    if (plan.delivery.state !== "none")
      checks.push(
        sheetIssue(
          "HOME_SERVICE_UNCERTAIN",
          "delivery",
          "Confirm delivery type and destination; location or fuel alone is not an approved rule.",
          { state: plan.delivery.state },
          plan.delivery.state === "location_and_fuel" ? "warning" : "needs_attention"
        )
      );
  }
  if (plan.intent === "duty" && !parsed.attendant)
    checks.push(
      sheetIssue("STAFF_MISSING", "attendant", "Choose the staff member assigned to this duty.")
    );
  if (plan.intent === "unknown")
    checks.push({
      ...sheetIssue(
        "ROW_MEANING_UNKNOWN",
        "rowType",
        "Classify the operational meaning of this source row."
      ),
      severity: "critical",
    });
  for (const payment of parsed.payments) {
    if (payment.marker)
      checks.push(
        sheetIssue(
          "PAYMENT_MARKER_UNKNOWN",
          `payments.${payment.method}`,
          "Confirm the payment marker's meaning and amount without guessing its channel.",
          { marker: payment.marker }
        )
      );
    if (payment.amount !== null && payment.amount < 0)
      checks.push(
        sheetIssue(
          "PAYMENT_SIGN_REVIEW",
          `payments.${payment.method}`,
          "Confirm whether this negative amount is a refund or adjustment."
        )
      );
  }
  for (const [field, raw, amount] of [
    ["rate", parsed.rateRaw, parsed.rate],
    ["commission", parsed.commissionRaw, parsed.commission],
    ["fuelOrTravel", parsed.fuelOrTravelRaw, parsed.fuelOrTravel],
  ] as const) {
    if (
      raw !== undefined &&
      raw !== null &&
      String(raw).trim() &&
      !/^-+$/.test(String(raw).trim()) &&
      amount === null
    )
      checks.push(
        sheetIssue(
          "MONETARY_MARKER_REVIEW",
          field,
          `Confirm the meaning of the non-numeric ${field} value.`
        )
      );
  }
  // Preserve legacy parser warnings even when a more specific check also exists.
  for (const issue of parsed.issues)
    checks.push(
      sheetIssue(
        issue,
        "parserIssues",
        "Review the preserved parser issue and correct only the uncertain field.",
        { issue }
      )
    );
  return checks;
}

export function findSheetConflictCandidates(
  rows: SheetCapturedRow[],
  plans: SheetRowProjectionPlan[]
): SheetConflictCandidate[] {
  const conflicts: SheetConflictCandidate[] = [];
  const sourceKeys = new Map<string, number>();
  const staffDays = new Map<string, { row: number; start: number; end: number }[]>();
  const appointments = new Map<string, number>();
  rows.forEach((row, i) => {
    const prior = sourceKeys.get(row.source.key);
    if (prior !== undefined)
      conflicts.push({
        type: "duplicate_source",
        sourceRows: [prior, row.source.sourceRow],
        severity: "critical",
        evidence: {
          sameFingerprint:
            rows.find((r) => r.source.sourceRow === prior)?.source.fingerprint ===
            row.source.fingerprint,
        },
      });
    sourceKeys.set(row.source.key, row.source.sourceRow);
    if (plans[i]?.intent !== "service") return;
    const parsed = row.parsed;
    const time = parseBookingTime(parsed.time ?? "");
    if (!parsed.businessDate || !time.ok) return;
    if (parsed.client && parsed.service) {
      const key = [
        parsed.businessDate,
        time.value.canonicalTime,
        normalizeSheetText(parsed.client),
        normalizeSheetText(parsed.service),
      ].join("|");
      const other = appointments.get(key);
      if (other !== undefined)
        conflicts.push({
          type: "possible_duplicate_booking",
          sourceRows: [other, row.source.sourceRow],
          severity: "high",
          evidence: { sameDateTimeClientService: true },
        });
      appointments.set(key, row.source.sourceRow);
    }
    const duration = sheetDurationMinutes(parsed.hours);
    if (!parsed.attendant || duration === null) return;
    const key = `${parsed.businessDate}|${normalizeSheetText(parsed.attendant)}`;
    const windows = staffDays.get(key) ?? [];
    const start = time.value.minutesIntoDay,
      end = start + duration;
    for (const other of windows)
      if (rangesOverlap(start, end, other.start, other.end))
        conflicts.push({
          type: "provider_overlap",
          sourceRows: [other.row, row.source.sourceRow],
          severity: "high",
          evidence: {
            date: parsed.businessDate,
            overlappingMinutes: Math.min(end, other.end) - Math.max(start, other.start),
            identityNotYetResolved: true,
          },
        });
    windows.push({ row: row.source.sourceRow, start, end });
    staffDays.set(key, windows);
  });
  return conflicts;
}
