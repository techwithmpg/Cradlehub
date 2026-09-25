import Link from "next/link";

import { loadSheetContext } from "@/lib/integrations/google-sheets/sheet-context";
import { readSheetIngestionDryRun } from "@/lib/integrations/google-sheets/sheet-live-dry-run";
import type { SheetContext } from "@/lib/integrations/google-sheets/sheet-resolution-context";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ContextTarget = NonNullable<SheetContext["target"]>;
type DryRunResult = Awaited<ReturnType<typeof readSheetIngestionDryRun>>;
type DryRunSummary = DryRunResult["summary"];

type LoadResult =
  | {
      ok: true;
      summary: DryRunSummary;
    }
  | {
      ok: false;
      message: string;
    };

function resolveContextTarget(): ContextTarget {
  if (process.env.VERCEL_ENV === "production") {
    return "PRODUCTION";
  }

  if (process.env.VERCEL_ENV === "preview") {
    return "STAGING";
  }

  if (process.env.NODE_ENV === "test") {
    return "TEST";
  }

  return "LOCAL";
}

async function loadAuthenticatedDryRun(sheetName: string): Promise<LoadResult> {
  const target = resolveContextTarget();

  try {
    const { summary } = await readSheetIngestionDryRun({
      sheetName,
      loadContext: (needs) => loadSheetContext(needs, target),
    });

    // Aggregate/privacy-safe report only.
    // Never log the full run because it contains row-level source/customer evidence.
    console.info("[smart-sheet-authenticated-dry-run]", JSON.stringify(summary));

    return {
      ok: true,
      summary,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Authenticated Sheet dry run failed.";

    console.error("[smart-sheet-authenticated-dry-run]", message);

    return {
      ok: false,
      message,
    };
  }
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

function MissingSheetConfiguration() {
  return (
    <div className="grid gap-5">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
          C5 Sheet Assimilation
        </p>

        <h1 className="mt-1 text-2xl font-bold tracking-tight">
          Authenticated Smart Sheet Dry Run
        </h1>
      </header>

      <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
        GOOGLE_SHEETS_ACTIVE_SHEET_NAME is not configured.
      </section>
    </div>
  );
}

function DryRunUnavailable({ message }: { message: string }) {
  return (
    <div className="grid gap-5">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
          C5 Sheet Assimilation
        </p>

        <h1 className="mt-1 text-2xl font-bold tracking-tight">
          Authenticated Smart Sheet Dry Run
        </h1>
      </header>

      <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
        <h2 className="font-bold">Dry run could not load canonical context</h2>

        <p className="mt-2 text-sm">{message}</p>

        <p className="mt-2 text-sm">No Sheet rows or canonical CradleHub records were modified.</p>
      </section>

      <Link
        href="/crm/bookings/sheet"
        className="inline-flex h-10 w-fit items-center rounded-lg border border-border bg-background px-4 text-sm font-semibold shadow-sm hover:bg-muted"
      >
        Return to raw Sheet view
      </Link>
    </div>
  );
}

function DryRunReport({ summary }: { summary: DryRunSummary }) {
  const decisionTotal =
    summary.decisions.ready +
    summary.decisions.warning +
    summary.decisions.needs_attention +
    summary.decisions.informational;

  const writeTotal =
    summary.writes.bookings +
    summary.writes.cash_flow +
    summary.writes.schedule +
    summary.writes.home_service +
    summary.writes.googleSheet +
    summary.writes.supabase +
    summary.writes.notifications +
    summary.writes.migrations;

  return (
    <div className="grid gap-5">
      <header className="grid gap-4 rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                C5 Sheet Assimilation
              </p>

              <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-sky-800">
                Read only
              </span>

              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-emerald-800">
                Authenticated context
              </span>
            </div>

            <h1 className="mt-1 text-2xl font-bold tracking-tight">Smart Master Sheet Dry Run</h1>

            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Google Sheet data is parsed against authenticated CradleHub branch, staff, service,
              customer, schedule and booking context. This page has no writer capability.
            </p>
          </div>

          <div className="flex gap-2">
            <Link
              href="/crm/bookings/sheet"
              className="inline-flex h-10 items-center rounded-lg border border-border bg-background px-4 text-sm font-semibold shadow-sm hover:bg-muted"
            >
              Raw Sheet view
            </Link>

            <Link
              href="/crm/bookings"
              className="inline-flex h-10 items-center rounded-lg border border-border bg-background px-4 text-sm font-semibold shadow-sm hover:bg-muted"
            >
              Canonical bookings
            </Link>
          </div>
        </div>

        <div
          className={
            summary.context.status === "available"
              ? "rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950"
              : "rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          }
        >
          <strong>Canonical context:</strong> {summary.context.status} · target{" "}
          {summary.context.target ?? "none"}
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <Metric label="Rows read" value={summary.rowsRead} />
          <Metric label="Meaningful" value={summary.parsing.meaningful} />
          <Metric label="Normalized" value={summary.parsing.normalizedMeaningful} />
          <Metric label="Silent drops" value={summary.parsing.silentDrops} />
          <Metric label="Decision total" value={decisionTotal} />
        </div>
      </header>

      <section className="grid gap-3 rounded-xl border border-border bg-card p-5 shadow-sm">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Decisions
          </p>

          <h2 className="mt-1 text-lg font-bold">Operational readiness</h2>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Ready" value={summary.decisions.ready} />
          <Metric label="Warning" value={summary.decisions.warning} />
          <Metric label="Needs attention" value={summary.decisions.needs_attention} />
          <Metric label="Informational" value={summary.decisions.informational} />
        </div>
      </section>

      <section className="grid gap-3 rounded-xl border border-border bg-card p-5 shadow-sm">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Routing
          </p>

          <h2 className="mt-1 text-lg font-bold">Module projections</h2>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Bookings" value={summary.moduleRouting.bookings} />
          <Metric label="Cash Flow" value={summary.moduleRouting.cash_flow} />
          <Metric label="Schedule" value={summary.moduleRouting.schedule} />
          <Metric label="Home Service" value={summary.moduleRouting.home_service} />
        </div>
      </section>

      <section className="grid gap-3 rounded-xl border border-border bg-card p-5 shadow-sm">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Canonical resolution
          </p>

          <h2 className="mt-1 text-lg font-bold">Resolver results</h2>
        </div>

        <pre className="overflow-x-auto rounded-lg border border-border bg-muted/30 p-4 text-xs leading-5">
          {JSON.stringify(summary.resolution, null, 2)}
        </pre>
      </section>

      <section className="grid gap-3 rounded-xl border border-border bg-card p-5 shadow-sm">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Attention
          </p>

          <h2 className="mt-1 text-lg font-bold">Actual remaining review reasons</h2>
        </div>

        <Metric label="Rows requiring review" value={summary.attention.rows} />

        <pre className="overflow-x-auto rounded-lg border border-border bg-muted/30 p-4 text-xs leading-5">
          {JSON.stringify(summary.attention.byReason, null, 2)}
        </pre>
      </section>

      <section className="grid gap-3 rounded-xl border border-border bg-card p-5 shadow-sm">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Conflicts / evidence
          </p>

          <h2 className="mt-1 text-lg font-bold">Diagnostic aggregates</h2>
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          <pre className="overflow-x-auto rounded-lg border border-border bg-muted/30 p-4 text-xs leading-5">
            {JSON.stringify(summary.conflicts, null, 2)}
          </pre>

          <pre className="overflow-x-auto rounded-lg border border-border bg-muted/30 p-4 text-xs leading-5">
            {JSON.stringify(summary.homeService, null, 2)}
          </pre>

          <pre className="overflow-x-auto rounded-lg border border-border bg-muted/30 p-4 text-xs leading-5">
            {JSON.stringify(summary.financial, null, 2)}
          </pre>
        </div>
      </section>

      <section
        className={
          writeTotal === 0
            ? "rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-950"
            : "rounded-xl border border-red-300 bg-red-50 p-5 text-red-950"
        }
      >
        <h2 className="font-bold">Write safety</h2>

        <p className="mt-1 text-sm">Total recorded writes: {writeTotal}</p>

        <pre className="mt-3 overflow-x-auto text-xs leading-5">
          {JSON.stringify(summary.writes, null, 2)}
        </pre>
      </section>

      <section className="grid gap-3 rounded-xl border border-border bg-card p-5 shadow-sm">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Privacy-safe evidence
          </p>

          <h2 className="mt-1 text-lg font-bold">Complete aggregate report</h2>
        </div>

        <pre className="max-h-[700px] overflow-auto rounded-lg border border-border bg-muted/30 p-4 text-xs leading-5">
          {JSON.stringify(summary, null, 2)}
        </pre>
      </section>
    </div>
  );
}

export default async function AuthenticatedSmartSheetDryRunPage() {
  const sheetName = process.env.GOOGLE_SHEETS_ACTIVE_SHEET_NAME?.trim();

  if (!sheetName) {
    return <MissingSheetConfiguration />;
  }

  const result = await loadAuthenticatedDryRun(sheetName);

  if (!result.ok) {
    return <DryRunUnavailable message={result.message} />;
  }

  return <DryRunReport summary={result.summary} />;
}
