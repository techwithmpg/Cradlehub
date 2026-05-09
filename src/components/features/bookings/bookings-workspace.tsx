import Link from "next/link";
import { BookingsTable } from "./bookings-table";
import type { DailyCashSummaryData } from "@/components/features/dashboard/daily-cash-summary";
import { formatCurrency } from "@/lib/utils";

// ── Shared types ──────────────────────────────────────────────────────────────

export type WorkspaceContext = "owner" | "manager" | "crm";

type OneOrMany<T> = T | T[] | null;

export type WorkspaceBookingRow = {
  id:                 string;
  booking_date:       string;
  start_time:         string;
  end_time?:          string | null;
  type:               string;
  status:             string;
  travel_buffer_mins?: number | null;
  metadata?:          Record<string, unknown> | null;
  payment_method:     string;
  payment_status:     string;
  amount_paid:        number;
  branches?:          OneOrMany<{ id?: string; name: string }>;
  services?:          OneOrMany<{ id?: string; name: string; duration_minutes?: number }>;
  staff?:             OneOrMany<{ id?: string; full_name: string; tier?: string }>;
  customers?:         OneOrMany<{ id?: string; full_name: string; phone?: string | null; email?: string | null }>;
  branch_resources?:  OneOrMany<{ name: string }>;
};

export type Branch = { id: string; name: string };

type ActionFn = (input: unknown) => Promise<{ success: boolean; error?: string }>;

// ── Props ─────────────────────────────────────────────────────────────────────

type BookingsWorkspaceProps = {
  workspaceContext: WorkspaceContext;
  viewerRole:       string;
  branchName?:      string;
  branches?:        Branch[];        // owner cross-branch filter list
  date:             string;
  statusFilter?:    string;
  typeFilter?:      string;
  branchFilter?:    string;          // owner: selected branch id
  search?:          string;
  bookings:         WorkspaceBookingRow[];
  cashSummary?:     DailyCashSummaryData | null;
  statusAction?:    ActionFn;
  paymentAction?:   ActionFn;
};

// ── Subtitles ──────────────────────────────────────────────────────────────────

const SUBTITLES: Record<WorkspaceContext, string> = {
  owner:   "Manage and track all bookings across branches.",
  manager: "Manage and track bookings for your branch.",
  crm:     "Manage front-desk and walk-in bookings.",
};

// ── KPI helpers ───────────────────────────────────────────────────────────────

function readPricePaid(metadata: Record<string, unknown> | null | undefined): number {
  if (!metadata) return 0;
  const n = Number(metadata["price_paid"] ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function computeKpi(bookings: WorkspaceBookingRow[], cashSummary?: DailyCashSummaryData | null) {
  const total      = bookings.length;
  const confirmed  = bookings.filter((b) => b.status === "confirmed").length;
  const inProgress = bookings.filter((b) => b.status === "in_progress").length;
  const collection = cashSummary != null
    ? cashSummary.total_collected
    : bookings
        .filter((b) => b.payment_status === "paid" && !["cancelled", "no_show"].includes(b.status))
        .reduce((s, b) => s + (b.amount_paid ?? 0), 0);
  const active = bookings.filter((b) => !["cancelled", "no_show"].includes(b.status));
  const expected = cashSummary != null
    ? cashSummary.total_expected
    : active.reduce((s, b) => s + readPricePaid(b.metadata), 0);
  return { total, confirmed, inProgress, collection, expected };
}

// ── Components ────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  accent,
}: {
  label:   string;
  value:   string;
  sub?:    string;
  accent?: boolean;
}) {
  return (
    <div style={{
      backgroundColor: "var(--cs-surface)",
      border:          "1px solid var(--cs-border)",
      borderRadius:    10,
      padding:         "1rem 1.125rem",
      flex:            "1 1 160px",
      minWidth:        0,
    }}>
      <div style={{ fontSize: "0.6875rem", fontWeight: 600, color: "var(--cs-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.375rem" }}>
        {label}
      </div>
      <div style={{ fontSize: "1.5rem", fontWeight: 700, color: accent ? "var(--cs-sand)" : "var(--cs-text)", fontFamily: "var(--font-playfair, serif)", lineHeight: 1.1 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: "0.6875rem", color: "var(--cs-text-muted)", marginTop: "0.25rem" }}>
          {sub}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function BookingsWorkspace({
  workspaceContext,
  viewerRole,
  branchName,
  branches,
  date,
  statusFilter,
  typeFilter,
  branchFilter,
  search,
  bookings,
  cashSummary,
  statusAction,
  paymentAction,
}: BookingsWorkspaceProps) {
  const basePath   = `/${workspaceContext === "owner" ? "owner" : workspaceContext === "manager" ? "manager" : "crm"}/bookings`;
  const kpi        = computeKpi(bookings, cashSummary);
  const dateLabel  = new Date(date + "T00:00:00").toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric" });
  const isOwner    = workspaceContext === "owner";
  const isCrm      = workspaceContext === "crm";
  const hasFilters = !!(statusFilter || typeFilter || branchFilter || search);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: "1.375rem", fontWeight: 700, color: "var(--cs-text)", fontFamily: "var(--font-display)", margin: 0 }}>
            Bookings
          </h1>
          <p style={{ fontSize: "0.875rem", color: "var(--cs-text-muted)", margin: "0.25rem 0 0" }}>
            {SUBTITLES[workspaceContext]}
            {branchName && !isOwner && (
              <span style={{ color: "var(--cs-sand)", fontWeight: 500 }}> · {branchName}</span>
            )}
          </p>
        </div>
      </div>

      {/* ── Filter bar ──────────────────────────────────────────────────── */}
      <div style={{ backgroundColor: "var(--cs-surface)", border: "1px solid var(--cs-border)", borderRadius: 10, padding: "0.75rem 1rem" }}>
        <form
          method="get"
          style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}
        >
          {/* Search */}
          <input
            type="search"
            name="search"
            defaultValue={search ?? ""}
            placeholder="Search by ID, name, or phone…"
            aria-label="Search bookings"
            style={inputStyle}
          />

          {/* Date */}
          <input
            type="date"
            name="date"
            defaultValue={date}
            aria-label="Select date"
            style={{ ...inputStyle, width: 148 }}
          />

          {/* Branch — owner only */}
          {isOwner && branches && branches.length > 0 && (
            <select name="branch" defaultValue={branchFilter ?? ""} aria-label="Filter by branch" style={inputStyle}>
              <option value="">All Branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          )}

          {/* Status */}
          <select name="status" defaultValue={statusFilter ?? ""} aria-label="Filter by status" style={inputStyle}>
            <option value="">All Statuses</option>
            <option value="confirmed">Confirmed</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="no_show">No Show</option>
          </select>

          {/* Type */}
          <select name="type" defaultValue={typeFilter ?? ""} aria-label="Filter by type" style={inputStyle}>
            <option value="">All Types</option>
            <option value="walkin">Walk-in</option>
            <option value="online">Online</option>
            <option value="home_service">Home Service</option>
          </select>

          <button type="submit" style={filterButtonStyle}>Filter</button>

          {hasFilters && (
            <Link href={basePath} style={clearLinkStyle}>Clear</Link>
          )}

          {isCrm && (
            <Link
              href="/crm/bookings/new"
              style={{ ...filterButtonStyle, marginLeft: "auto", textDecoration: "none", display: "inline-flex", alignItems: "center" }}
            >
              + New Booking
            </Link>
          )}
        </form>

        <div style={{ marginTop: "0.5rem", fontSize: "0.8125rem", color: "var(--cs-text-muted)" }}>
          {bookings.length} booking{bookings.length !== 1 ? "s" : ""} · {dateLabel}
        </div>
      </div>

      {/* ── KPI cards ───────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        <KpiCard label="Total Bookings"    value={String(kpi.total)}     sub={`${kpi.total} for the day`} />
        <KpiCard label="Confirmed"         value={String(kpi.confirmed)} sub="awaiting service" />
        <KpiCard label="Checked In"         value={String(kpi.inProgress)} sub="currently serving" />
        <KpiCard
          label="Today's Collection"
          value={formatCurrency(kpi.collection)}
          sub={kpi.expected > 0 ? `of ${formatCurrency(kpi.expected)} expected` : undefined}
          accent
        />
      </div>

      {/* ── Bookings table + details panel ──────────────────────────────── */}
      <BookingsTable
        bookings={bookings}
        viewerRole={viewerRole}
        search={search}
        statusAction={statusAction}
        paymentAction={paymentAction}
      />
    </div>
  );
}

// ── Shared input/button styles ────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  height:          36,
  borderRadius:    6,
  border:          "1px solid var(--cs-border)",
  padding:         "0 0.75rem",
  fontSize:        "0.875rem",
  backgroundColor: "var(--cs-surface)",
  color:           "var(--cs-text)",
  minWidth:        120,
};

const filterButtonStyle: React.CSSProperties = {
  height:          36,
  padding:         "0 1rem",
  borderRadius:    6,
  border:          "none",
  backgroundColor: "var(--cs-sand)",
  color:           "#fff",
  fontSize:        "0.875rem",
  fontWeight:      600,
  cursor:          "pointer",
  whiteSpace:      "nowrap",
};

const clearLinkStyle: React.CSSProperties = {
  height:          36,
  padding:         "0 1rem",
  borderRadius:    6,
  border:          "1px solid var(--cs-border)",
  backgroundColor: "var(--cs-surface-warm)",
  color:           "var(--cs-text-muted)",
  fontSize:        "0.875rem",
  textDecoration:  "none",
  display:         "inline-flex",
  alignItems:      "center",
  whiteSpace:      "nowrap",
};
