"use client";

import { useState } from "react";
import { CrmStatusBadge } from "@/components/features/crm/premium/crm-status-badge";
import {
  type SheetReviewRecord,
  type SheetReviewState,
} from "@/lib/integrations/google-sheets/sheet-review-projection";
import {
  filterSheetReviewRecords,
  type SheetReviewFilters,
} from "@/lib/integrations/google-sheets/sheet-review-filter";
import type { SheetReviewReason } from "@/lib/integrations/google-sheets/sheet-review";

const REASON_LABELS: Record<SheetReviewReason, string> = {
  MISSING_BUSINESS_DATE: "Missing business date",
  MISSING_TIME: "Missing time",
  MISSING_CUSTOMER: "Missing customer",
  MISSING_ATTENDANT: "Missing attendant",
  MISSING_STAFF: "Missing staff",
  AMBIGUOUS_PAYMENT_MARKER: "Ambiguous payment marker",
  AMBIGUOUS_SERVICE_VALUE: "Ambiguous service value",
  ORPHAN_CONTINUATION: "Orphan service continuation",
  CONFLICTING_CONTINUATION: "Conflicting continuation",
  UNASSIGNED_FINANCIAL_NOTE: "Unassigned financial note",
  OUT_OF_WEEK_DATE: "Out-of-week date",
  DATE_BOUNDARY_AMBIGUOUS: "Date boundary ambiguous",
  UNKNOWN_ROW: "Unknown row",
  OTHER: "Needs review",
};

const peso = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });
const observedTime = (value: string) =>
  new Date(value).toLocaleString("en-PH", { timeZone: "Asia/Manila" });

function SourceLine({ record, observedAt }: { record: SheetReviewRecord; observedAt: string }) {
  const start = record.source.startRow;
  const end = record.source.endRow;
  return (
    <p className="mt-3 break-words text-xs text-[var(--cs-text-muted)]">
      {record.source.sheetName} · {start === end ? `Row ${start}` : `Rows ${start}–${end}`} ·
      Observed {observedTime(observedAt)} PHT
    </p>
  );
}

function RecordCard({ record, observedAt }: { record: SheetReviewRecord; observedAt: string }) {
  const label =
    record.kind === "visit"
      ? "Visit reference"
      : record.kind === "duty"
        ? "Staff duty reference"
        : record.classification === "FINANCIAL_NOTE"
          ? "Financial note for review"
          : "Sheet row for review";
  return (
    <article className="min-w-0 rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <CrmStatusBadge variant="neutral" label="Master Sheet" size="sm" />
        <CrmStatusBadge variant="info" label="Read only" size="sm" />
        {record.reviewReasons.length > 0 && (
          <CrmStatusBadge variant="warning" label="Needs review" size="sm" />
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold text-[var(--cs-text)]">{label}</h3>
        <span className="text-xs text-[var(--cs-text-muted)]">
          {record.businessDate ?? "Date unknown"}
          {record.kind === "visit" && record.time ? ` · ${record.time}` : ""}
        </span>
      </div>
      <p className="mt-1 text-xs font-medium text-[var(--cs-text-secondary)]">Branch: Unknown</p>
      {record.kind === "visit" && (
        <div className="mt-3 space-y-2 break-words text-sm text-[var(--cs-text-secondary)]">
          <p>
            <span className="font-medium text-[var(--cs-text)]">Customer:</span>{" "}
            {record.customerDisplay ?? "Not recorded"}
          </p>
          <p>
            <span className="font-medium text-[var(--cs-text)]">Attendant:</span>{" "}
            {record.staffDisplay ?? "Not recorded"}
          </p>
          <p>
            <span className="font-medium text-[var(--cs-text)]">Services:</span>{" "}
            {record.services
              .map(
                (service) =>
                  `${service.name}${service.hours !== null ? ` · ${service.hours} hr` : ""}`
              )
              .join(", ") || "Not recorded"}
          </p>
          {record.locationEvidence && (
            <p>
              <span className="font-medium text-[var(--cs-text)]">Location evidence:</span>{" "}
              {record.locationEvidence}
            </p>
          )}
          {record.financialEvidence.length > 0 && (
            <div className="rounded-lg border border-[var(--cs-border)] bg-[var(--cs-bg)] p-3">
              <p className="font-semibold text-[var(--cs-text)]">
                Sheet evidence only — not a recorded CradleHub payment
              </p>
              <ul className="mt-1 space-y-1 text-xs">
                {record.financialEvidence.map((evidence, index) => (
                  <li key={`${evidence.channel}-${index}`}>
                    {evidence.channel}:{" "}
                    {evidence.ambiguous
                      ? "Marker needs review"
                      : evidence.amount === null
                        ? "Amount not established"
                        : peso.format(evidence.amount)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      {record.kind === "duty" && (
        <div className="mt-3 space-y-1 break-words text-sm text-[var(--cs-text-secondary)]">
          <p>
            <span className="font-medium text-[var(--cs-text)]">Staff:</span>{" "}
            {record.staffDisplay ?? "Not recorded"}
          </p>
          <p>
            <span className="font-medium text-[var(--cs-text)]">Duty:</span>{" "}
            {record.dutyLabel ?? "Not recorded"}
          </p>
        </div>
      )}
      {record.kind === "review" && (
        <p className="mt-3 text-sm text-[var(--cs-text-secondary)]">
          Source row requires human review. No operational record was created.
        </p>
      )}
      {record.reviewReasons.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Review reasons">
          {record.reviewReasons.map((reason) => (
            <span
              key={reason}
              className="rounded-md bg-[var(--cs-warning-bg)] px-2 py-1 text-xs text-[var(--cs-warning-text)]"
            >
              {REASON_LABELS[reason]}
            </span>
          ))}
        </div>
      )}
      <SourceLine record={record} observedAt={observedAt} />
    </article>
  );
}

export function MasterSheetReview({ state }: { state: SheetReviewState }) {
  const [period, setPeriod] = useState<"current" | "previous">("current");
  const [type, setType] = useState<SheetReviewFilters["type"]>("all");
  const [date, setDate] = useState("");
  const [reason, setReason] = useState<SheetReviewFilters["reason"]>("all");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(40);

  if (state.status === "unavailable")
    return (
      <div
        role="status"
        className="rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-6"
      >
        <h2 className="text-lg font-semibold text-[var(--cs-text)]">
          Master Sheet temporarily unavailable
        </h2>
        <p className="mt-2 text-sm text-[var(--cs-text-secondary)]">
          CradleHub operational records are unaffected. Refresh this page to try again.
        </p>
      </div>
    );

  const tab = state[period];
  const records: SheetReviewRecord[] = [...tab.visits, ...tab.duties, ...tab.review];
  const dates = [
    ...new Set(
      records
        .map((record) => record.businessDate)
        .filter((value): value is string => Boolean(value))
    ),
  ].sort();
  const reasons = [...new Set(records.flatMap((record) => record.reviewReasons))].sort();
  const filtered = filterSheetReviewRecords(records, { type, date, reason, query });
  const isEmpty = records.length === 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2" aria-label="Workbook week">
        {(["current", "previous"] as const).map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={period === key}
            onClick={() => {
              setPeriod(key);
              setDate("");
              setReason("all");
              setLimit(40);
            }}
            className={`min-h-11 rounded-lg border px-4 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cs-sand)] ${period === key ? "border-[var(--cs-sand)] bg-[var(--cs-sand-mist)] text-[var(--cs-text)]" : "border-[var(--cs-border)] bg-[var(--cs-surface)] text-[var(--cs-text-secondary)]"}`}
          >
            {key === "current" ? "Current week" : "Previous week"}
          </button>
        ))}
      </div>
      <p className="break-words text-sm text-[var(--cs-text-secondary)]">
        {tab.sheetName} · Observed {observedTime(state.observedAt)} PHT ·{" "}
        {tab.review.length > 0 ? "Available with needs review" : "Available"} · Branch unknown for
        every record
      </p>
      <div className="grid gap-3 sm:grid-cols-3" aria-label="Sheet record counts">
        {[
          ["Visits", tab.visits.length],
          ["Staff duties", tab.duties.length],
          ["Needs review", tab.review.length],
        ].map(([label, count]) => (
          <div
            key={label}
            className="rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-4"
          >
            <p className="text-sm text-[var(--cs-text-secondary)]">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-[var(--cs-text)]">{count}</p>
          </div>
        ))}
      </div>
      {isEmpty ? (
        <p className="rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-6 text-sm text-[var(--cs-text-secondary)]">
          This week is available but has no Sheet visits, duties, or review items.
        </p>
      ) : (
        <>
          <div className="grid gap-3 rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-4 sm:grid-cols-2 xl:grid-cols-4">
            <label className="text-xs font-semibold text-[var(--cs-text-secondary)]">
              Search customer, staff, service
              <input
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setLimit(40);
                }}
                className="mt-1 min-h-11 w-full rounded-lg border border-[var(--cs-border)] bg-white px-3 text-sm text-[var(--cs-text)]"
              />
            </label>
            <label className="text-xs font-semibold text-[var(--cs-text-secondary)]">
              Record type
              <select
                value={type}
                onChange={(event) => {
                  setType(event.target.value as SheetReviewFilters["type"]);
                  setLimit(40);
                }}
                className="mt-1 min-h-11 w-full rounded-lg border border-[var(--cs-border)] bg-white px-3 text-sm text-[var(--cs-text)]"
              >
                <option value="all">All types</option>
                <option value="visit">Visits</option>
                <option value="duty">Staff duties</option>
                <option value="review">Review entries</option>
              </select>
            </label>
            <label className="text-xs font-semibold text-[var(--cs-text-secondary)]">
              Business date
              <select
                value={date}
                onChange={(event) => {
                  setDate(event.target.value);
                  setLimit(40);
                }}
                className="mt-1 min-h-11 w-full rounded-lg border border-[var(--cs-border)] bg-white px-3 text-sm text-[var(--cs-text)]"
              >
                <option value="">All dates</option>
                {dates.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold text-[var(--cs-text-secondary)]">
              Review reason
              <select
                value={reason}
                onChange={(event) => {
                  setReason(event.target.value as SheetReviewFilters["reason"]);
                  setLimit(40);
                }}
                className="mt-1 min-h-11 w-full rounded-lg border border-[var(--cs-border)] bg-white px-3 text-sm text-[var(--cs-text)]"
              >
                <option value="all">All reasons</option>
                <option value="BRANCH_UNKNOWN">Branch unknown</option>
                {reasons.map((item) => (
                  <option key={item} value={item}>
                    {REASON_LABELS[item]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="text-sm text-[var(--cs-text-secondary)]" role="status">
            Showing {Math.min(limit, filtered.length)} of {filtered.length} references
          </p>
          {filtered.length === 0 ? (
            <p className="rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-6 text-sm text-[var(--cs-text-secondary)]">
              No Sheet references match these filters.
            </p>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2" aria-label="Master Sheet references">
              {filtered.slice(0, limit).map((record) => (
                <RecordCard
                  key={`${record.kind}:${record.source.sourceKey}`}
                  record={record}
                  observedAt={state.observedAt}
                />
              ))}
            </div>
          )}
          {filtered.length > limit && (
            <button
              type="button"
              onClick={() => setLimit((current) => current + 40)}
              className="min-h-11 rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-4 text-sm font-semibold text-[var(--cs-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cs-sand)]"
            >
              Show more references
            </button>
          )}
        </>
      )}
    </div>
  );
}
