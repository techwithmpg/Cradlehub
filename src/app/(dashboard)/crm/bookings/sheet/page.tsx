import Link from "next/link";

import { getFrontDeskContext } from "@/lib/queries/crm-context";

import {
  readActiveSheetProjection,
  type LiveSheetProjectionRow,
  type LiveSheetProjectionSnapshot,
} from "@/lib/integrations/google-sheets/sheet-projection";

import type { SheetAccountingDisposition } from "@/lib/integrations/google-sheets/sheet-accounting";

import type { SheetRowType } from "@/lib/integrations/google-sheets/sheet-parser";

type SearchParams = {
  date?: string;
  disposition?: string;
  rowType?: string;
  q?: string;
};

const moneyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});

const dispositionOptions: Array<{
  value: "" | SheetAccountingDisposition;
  label: string;
}> = [
  {
    value: "",
    label: "All review states",
  },
  {
    value: "match_candidate",
    label: "Match candidate",
  },
  {
    value: "needs_review",
    label: "Needs review",
  },
  {
    value: "derived_informational",
    label: "Informational",
  },
];

const rowTypeOptions: Array<{
  value: "" | SheetRowType;
  label: string;
}> = [
  {
    value: "",
    label: "All row types",
  },
  {
    value: "service_candidate",
    label: "Service",
  },
  {
    value: "staff_duty",
    label: "Staff duty",
  },
  {
    value: "financial_or_note",
    label: "Financial / note",
  },
  {
    value: "aggregate_summary",
    label: "Summary",
  },
  {
    value: "informational",
    label: "Informational",
  },
  {
    value: "header",
    label: "Header",
  },
  {
    value: "unknown",
    label: "Unknown",
  },
];

function normalizeDisposition(value: string | undefined): "" | SheetAccountingDisposition {
  if (
    value === "match_candidate" ||
    value === "needs_review" ||
    value === "derived_informational"
  ) {
    return value;
  }

  return "";
}

function normalizeRowType(value: string | undefined): "" | SheetRowType {
  if (
    value === "header" ||
    value === "aggregate_summary" ||
    value === "staff_duty" ||
    value === "service_candidate" ||
    value === "financial_or_note" ||
    value === "informational" ||
    value === "unknown"
  ) {
    return value;
  }

  return "";
}

function dispositionLabel(disposition: SheetAccountingDisposition): string {
  switch (disposition) {
    case "match_candidate":
      return "Match candidate";

    case "needs_review":
      return "Needs review";

    case "derived_informational":
      return "Informational";
  }
}

function dispositionClass(disposition: SheetAccountingDisposition): string {
  switch (disposition) {
    case "match_candidate":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";

    case "needs_review":
      return "border-amber-200 bg-amber-50 text-amber-900";

    case "derived_informational":
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

function rowTypeLabel(type: SheetRowType): string {
  switch (type) {
    case "service_candidate":
      return "Service";

    case "staff_duty":
      return "Staff duty";

    case "financial_or_note":
      return "Financial / note";

    case "aggregate_summary":
      return "Summary";

    case "informational":
      return "Informational";

    case "header":
      return "Header";

    case "unknown":
      return "Unknown";
  }
}

function formatDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-PH", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatPayment(row: LiveSheetProjectionRow): string {
  const labels = {
    cash: "Cash",
    gcash: "GCash",
    bank_qr: "Bank/QR",
    card_terminal: "Card",
  } as const;

  const parts = row.payments.flatMap((payment) => {
    if (payment.amount !== null && Number.isFinite(payment.amount) && payment.amount !== 0) {
      return [`${labels[payment.method]} ${moneyFormatter.format(payment.amount)}`];
    }

    if (payment.marker) {
      return [`${labels[payment.method]}: ${payment.marker}`];
    }

    return [];
  });

  return parts.length > 0 ? parts.join(" · ") : "—";
}

function issueLabel(issue: string): string {
  switch (issue) {
    case "MISSING_BLOCK_DATE":
      return "Date unresolved";

    case "MISSING_OR_CONTINUATION_TIME":
      return "Time needs review";

    case "MISSING_OR_CONTINUATION_ATTENDANT":
      return "Attendant needs review";

    case "MISSING_OR_CONTINUATION_CLIENT":
      return "Client needs review";

    case "PAYMENT_MARKER_REQUIRES_REVIEW":
      return "Payment marker";

    case "NON_NUMERIC_FUEL_OR_TRAVEL_NOTE":
      return "Fuel / travel note";

    default:
      return issue.toLowerCase().replaceAll("_", " ");
  }
}

function matchesSearch(row: LiveSheetProjectionRow, query: string): boolean {
  if (!query) {
    return true;
  }

  const payment = formatPayment(row);

  return [
    row.sourceRow.toString(),
    row.businessDate,
    row.location,
    row.time,
    row.attendant,
    row.client,
    row.service,
    payment,
    ...row.parserIssues,
  ]
    .filter((value): value is string => Boolean(value))
    .some((value) => value.toLowerCase().includes(query));
}

export default async function LiveSheetBookingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const [params, frontDesk] = await Promise.all([searchParams, getFrontDeskContext()]);

  let snapshot: LiveSheetProjectionSnapshot;

  try {
    snapshot = await readActiveSheetProjection();
  } catch (error) {
    console.error("[live-sheet-projection]", error);

    return (
      <div className="grid gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Bookings
            </p>

            <h1 className="text-2xl font-bold tracking-tight">Live Sheet</h1>
          </div>

          <Link
            href="/crm/bookings"
            className="inline-flex h-10 items-center rounded-lg border border-border bg-background px-4 text-sm font-semibold shadow-sm hover:bg-muted"
          >
            Canonical bookings
          </Link>
        </div>

        <section className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="font-bold text-amber-950">Live Sheet is unavailable</h2>

          <p className="mt-2 text-sm text-amber-900">
            The read-only Google Sheet projection could not be loaded. Existing CradleHub bookings
            are unaffected.
          </p>
        </section>
      </div>
    );
  }

  const disposition = normalizeDisposition(params.disposition);

  const rowType = normalizeRowType(params.rowType);

  const query = params.q?.trim().toLowerCase() ?? "";

  const latestDate = snapshot.businessDates.at(-1) ?? "";

  const requestedDate = params.date?.trim() || latestDate;

  const selectedDate =
    requestedDate === "all" ||
    requestedDate === "undated" ||
    snapshot.businessDates.includes(requestedDate)
      ? requestedDate
      : latestDate;

  const rows = snapshot.rows.filter((row) => {
    if (selectedDate === "undated") {
      if (row.businessDate !== null) {
        return false;
      }
    } else if (selectedDate !== "all" && row.businessDate !== selectedDate) {
      return false;
    }

    if (disposition && row.disposition !== disposition) {
      return false;
    }

    if (rowType && row.rowType !== rowType) {
      return false;
    }

    return matchesSearch(row, query);
  });

  const selectedDateLabel =
    selectedDate === "all"
      ? "All dates"
      : selectedDate === "undated"
        ? "Undated / unresolved"
        : selectedDate
          ? formatDate(selectedDate)
          : "No dated rows";

  return (
    <div className="grid gap-5">
      <header className="grid gap-4 rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                Bookings
              </p>

              <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-sky-800">
                Read only
              </span>
            </div>

            <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">Live Sheet</h1>

            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Current Google Sheet activity projected into CradleHub without creating or modifying
              canonical bookings.
            </p>
          </div>

          <Link
            href="/crm/bookings"
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-semibold shadow-sm hover:bg-muted"
          >
            Canonical bookings
          </Link>
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <strong>Evidence view only.</strong> Sheet rows are not yet canonical bookings and branch
          ownership has not yet been resolved. No actions from this screen write to Supabase or
          Google Sheets.
        </div>

        <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-lg border border-border bg-background p-3">
            <p className="text-xs font-semibold text-muted-foreground">Active sheet</p>

            <p className="mt-1 font-bold">{snapshot.sheetName}</p>
          </div>

          <div className="rounded-lg border border-border bg-background p-3">
            <p className="text-xs font-semibold text-muted-foreground">Meaningful rows</p>

            <p className="mt-1 text-xl font-bold tabular-nums">
              {snapshot.normalizedMeaningfulRowCount}
            </p>
          </div>

          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
            <p className="text-xs font-semibold text-emerald-800">Match candidates</p>

            <p className="mt-1 text-xl font-bold tabular-nums text-emerald-950">
              {snapshot.countsByDisposition.match_candidate}
            </p>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs font-semibold text-amber-800">Needs review</p>

            <p className="mt-1 text-xl font-bold tabular-nums text-amber-950">
              {snapshot.countsByDisposition.needs_review}
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-600">Informational</p>

            <p className="mt-1 text-xl font-bold tabular-nums text-slate-900">
              {snapshot.countsByDisposition.derived_informational}
            </p>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          CRM context: {frontDesk.branchName}. Sheet rows are currently shown independently of
          branch assignment.
        </p>
      </header>

      <form
        method="get"
        className="grid gap-3 rounded-xl border border-border bg-card p-4 shadow-sm md:grid-cols-4"
      >
        <label className="grid gap-1.5">
          <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Sheet date
          </span>

          <select
            name="date"
            defaultValue={selectedDate}
            className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
          >
            <option value="all">All dates</option>

            {[...snapshot.businessDates].reverse().map((date) => (
              <option key={date} value={date}>
                {formatDate(date)}
              </option>
            ))}

            <option value="undated">Undated / unresolved</option>
          </select>
        </label>

        <label className="grid gap-1.5">
          <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Review state
          </span>

          <select
            name="disposition"
            defaultValue={disposition}
            className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
          >
            {dispositionOptions.map((option) => (
              <option key={option.value || "all"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1.5">
          <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Row type
          </span>

          <select
            name="rowType"
            defaultValue={rowType}
            className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
          >
            {rowTypeOptions.map((option) => (
              <option key={option.value || "all"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1.5">
          <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Search
          </span>

          <div className="flex gap-2">
            <input
              name="q"
              defaultValue={params.q ?? ""}
              placeholder="Client, service, staff..."
              className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-sm"
            />

            <button
              type="submit"
              className="h-10 rounded-lg bg-foreground px-4 text-sm font-semibold text-background"
            >
              Apply
            </button>
          </div>
        </label>
      </form>

      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div>
            <h2 className="font-bold">{selectedDateLabel}</h2>

            <p className="text-xs text-muted-foreground">
              {rows.length} projected row
              {rows.length === 1 ? "" : "s"}
            </p>
          </div>

          <p className="text-xs text-muted-foreground">
            Source: Google Sheet · row numbers preserved
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] border-collapse text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-3">Time</th>

                <th className="px-3 py-3">Client / note</th>

                <th className="px-3 py-3">Service</th>

                <th className="px-3 py-3">Attendant</th>

                <th className="px-3 py-3">Location</th>

                <th className="px-3 py-3">Rate</th>

                <th className="px-3 py-3">Payment evidence</th>

                <th className="px-3 py-3">Review</th>

                <th className="px-3 py-3">Sheet row</th>
              </tr>
            </thead>

            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-5 py-12 text-center text-sm text-muted-foreground">
                    No Sheet rows match the current filters.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.sourceRow} className="border-t border-border align-top">
                    <td className="whitespace-nowrap px-3 py-3 font-semibold">{row.time ?? "—"}</td>

                    <td className="max-w-[220px] px-3 py-3">
                      <p className="font-semibold text-foreground">
                        {row.client ?? String(row.rawValues[3] ?? "—")}
                      </p>

                      <p className="mt-1 text-xs text-muted-foreground">
                        {rowTypeLabel(row.rowType)}
                      </p>
                    </td>

                    <td className="max-w-[240px] px-3 py-3">{row.service ?? "—"}</td>

                    <td className="whitespace-nowrap px-3 py-3">{row.attendant ?? "—"}</td>

                    <td className="max-w-[180px] px-3 py-3">{row.location ?? "—"}</td>

                    <td className="whitespace-nowrap px-3 py-3 tabular-nums">
                      {row.rate !== null ? moneyFormatter.format(row.rate) : "—"}
                    </td>

                    <td className="max-w-[280px] px-3 py-3">
                      <p>{formatPayment(row)}</p>

                      {row.fuelOrTravel !== null ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Fuel / travel: {moneyFormatter.format(row.fuelOrTravel)}
                        </p>
                      ) : null}
                    </td>

                    <td className="max-w-[240px] px-3 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${dispositionClass(
                          row.disposition
                        )}`}
                      >
                        {dispositionLabel(row.disposition)}
                      </span>

                      {row.parserIssues.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {row.parserIssues.map((issue) => (
                            <span
                              key={issue}
                              title={issue}
                              className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900"
                            >
                              {issueLabel(issue)}
                            </span>
                          ))}
                        </div>
                      ) : null}

                      {row.restoredColumns.length > 0 ? (
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          Merge-backed fields restored: {row.restoredColumns.join(", ")}
                        </p>
                      ) : null}
                    </td>

                    <td className="whitespace-nowrap px-3 py-3 font-mono text-xs">
                      {row.sourceRow}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
